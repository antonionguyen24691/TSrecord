import {
  createRecordedFile,
  createSessionWorkspaceName,
  saveRecordingToDevice,
} from './recordingService';
import { SavedDeviceFile } from '../types';
import { getAudioContext, encodeWav } from './utils/audioUtils';


export const getAudioDuration = async (file: File) =>
  new Promise<number>((resolve, reject) => {
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(objectUrl);
    };

    audio.preload = 'metadata';
    audio.src = objectUrl;

    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      cleanup();
      resolve(duration);
    };

    audio.onerror = () => {
      cleanup();
      reject(new Error('Không thể đọc metadata audio để mở trình chỉnh sửa.'));
    };
  });

export const trimAudioFile = async ({
  file,
  startSeconds,
  endSeconds,
}: {
  file: File;
  startSeconds: number;
  endSeconds: number;
}) => {
  const audioContext = getAudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const safeStart = Math.max(0, Math.min(decoded.duration, startSeconds));
    const safeEnd = Math.max(safeStart, Math.min(decoded.duration, endSeconds));

    if (safeEnd <= safeStart) {
      throw new Error('Khoảng cắt không hợp lệ. Điểm kết thúc phải lớn hơn điểm bắt đầu.');
    }

    const startFrame = Math.floor(safeStart * decoded.sampleRate);
    const endFrame = Math.floor(safeEnd * decoded.sampleRate);
    const frameLength = Math.max(1, endFrame - startFrame);

    const channels: Float32Array[] = [];
    for (let channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) {
      const source = decoded.getChannelData(channelIndex).subarray(startFrame, endFrame);
      const copied = new Float32Array(frameLength);
      copied.set(source.subarray(0, frameLength));
      channels.push(copied);
    }

    const blob = encodeWav(channels, decoded.sampleRate);
    const editedFile = createRecordedFile({
      blob,
      baseLabel: `${file.name.replace(/\.[^.]+$/, '')}-edited`,
    });

    return {
      blob,
      file: editedFile,
      durationSeconds: safeEnd - safeStart,
    };
  } finally {
    await audioContext.close();
  }
};

export const saveEditedAudioToDevice = async ({
  blob,
  fileName,
}: {
  blob: Blob;
  fileName: string;
}): Promise<SavedDeviceFile> => {
  const workspaceName = createSessionWorkspaceName('audio-editor');
  return saveRecordingToDevice({
    blob,
    fileName,
    workspaceName,
  });
};
