export interface AudioChunkPart {
  file: File;
  index: number;
  total: number;
  startSeconds: number;
  endSeconds: number;
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.flac'];

const getAudioContext = () => {
  const ContextClass =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!ContextClass) {
    throw new Error('Thiết bị hiện tại không hỗ trợ AudioContext để chia file dài.');
  }

  return new ContextClass();
};

const getBaseName = (fileName: string) => fileName.replace(/\.[^.]+$/, '') || 'audio';

const getAudioExtension = (file: File) => {
  if (file.type.includes('wav')) return 'wav';
  return 'wav';
};

const isAudioFile = (file: File) => {
  if (file.type.startsWith('audio/')) return true;
  const lowerName = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
};

const readDurationFromMediaElement = (file: File) =>
  new Promise<number>((resolve, reject) => {
    const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      media.removeAttribute('src');
      media.load();
      URL.revokeObjectURL(objectUrl);
    };

    media.preload = 'metadata';
    media.src = objectUrl;

    media.onloadedmetadata = () => {
      const duration = Number.isFinite(media.duration) ? media.duration : 0;
      cleanup();
      resolve(duration);
    };

    media.onerror = () => {
      cleanup();
      reject(new Error('Không thể đọc metadata duration của file media.'));
    };
  });

const encodeWav = (channelData: Float32Array[], sampleRate: number) => {
  const channelCount = channelData.length;
  const sampleCount = channelData[0]?.length || 0;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + sampleCount * blockAlign);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * blockAlign, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, sampleCount * blockAlign, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channelIndex][sampleIndex] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

export const getMediaDurationSeconds = async (file: File) => readDurationFromMediaElement(file);

export const canSplitFileIntoAudioChunks = (file: File) => isAudioFile(file);

export const splitAudioFileIntoChunks = async ({
  file,
  chunkDurationSeconds,
}: {
  file: File;
  chunkDurationSeconds: number;
}): Promise<AudioChunkPart[]> => {
  if (!isAudioFile(file)) {
    throw new Error('Chỉ hỗ trợ chia chunk tự động cho file audio.');
  }

  const audioContext = getAudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const totalChunks = Math.ceil(decoded.duration / chunkDurationSeconds);
    const parts: AudioChunkPart[] = [];
    const chunkFrameCount = Math.max(1, Math.floor(chunkDurationSeconds * decoded.sampleRate));
    const baseName = getBaseName(file.name);
    const extension = getAudioExtension(file);

    for (let index = 0; index < totalChunks; index += 1) {
      const startFrame = index * chunkFrameCount;
      const endFrame = Math.min(decoded.length, startFrame + chunkFrameCount);
      const frameLength = endFrame - startFrame;
      const channelData = Array.from({ length: decoded.numberOfChannels }, (_, channelIndex) =>
        decoded.getChannelData(channelIndex).slice(startFrame, endFrame)
      );

      const blob = encodeWav(channelData, decoded.sampleRate);
      const chunkFile = new File([blob], `${baseName}-part-${String(index + 1).padStart(2, '0')}.${extension}`, {
        type: 'audio/wav',
        lastModified: Date.now(),
      });

      parts.push({
        file: chunkFile,
        index,
        total: totalChunks,
        startSeconds: startFrame / decoded.sampleRate,
        endSeconds: (startFrame + frameLength) / decoded.sampleRate,
      });
    }

    return parts;
  } finally {
    await audioContext.close();
  }
};
