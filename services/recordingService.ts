import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { MicrophonePermission } from '../plugins/microphonePermission';
import { SavedDeviceFile } from '../types';

const STORAGE_ROOT = 'TSrecord';
const AUDIO_DIRECTORY = 'media';
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

const stripDiacritics = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const sanitizeFileSegment = (value: string) =>
  stripDiacritics(value)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'session';

const getTimestamp = () => {
  const now = new Date();
  const pad = (part: number) => String(part).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
};

const guessExtension = (mimeType: string) => {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
};

const blobToBase64 = async (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const ensureFilesystemPermission = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Filesystem.requestPermissions();
  } catch {
    // Ignore on platforms that do not expose permission prompts here.
  }
};

const ensureMicrophonePermission = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const current = await MicrophonePermission.check();
    if (current.granted) return;

    const requested = await MicrophonePermission.request();
    if (!requested.granted) {
      throw new Error('Microphone permission denied.');
    }
  } catch (error: any) {
    const message = `${error?.message || ''}`.toLowerCase();
    if (message.includes('denied')) {
      throw new Error(
        'Microphone đang bị từ chối. Vào Cài đặt ứng dụng > Quyền > Microphone, bật quyền rồi thử lại.'
      );
    }
    throw new Error('Không thể xác nhận quyền microphone trên thiết bị.');
  }
};

const ensureDirectory = async (path: string) => {
  try {
    await Filesystem.mkdir({
      path,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch (error: any) {
    const message = `${error?.message || ''}`.toLowerCase();
    if (!message.includes('exist')) {
      throw error;
    }
  }
};

export const createSessionWorkspaceName = (label: string) =>
  `${sanitizeFileSegment(label)}-${getTimestamp()}`;

export const getSupportedRecordingMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  if (typeof MediaRecorder.isTypeSupported !== 'function') {
    return PREFERRED_MIME_TYPES[0];
  }

  return PREFERRED_MIME_TYPES.find((mimeType) =>
    MediaRecorder.isTypeSupported(mimeType)
  ) || '';
};

export const startRecordingStream = async () => {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  ) {
    throw new Error(
      'Thiết bị hiện tại chưa hỗ trợ MediaRecorder hoặc quyền microphone trong trình duyệt.'
    );
  }

  await ensureMicrophonePermission();

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeType = getSupportedRecordingMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);

  return {
    recorder,
    stream,
    mimeType: recorder.mimeType || mimeType || 'audio/webm',
  };
};

export const createRecordedFile = ({
  blob,
  baseLabel,
}: {
  blob: Blob;
  baseLabel: string;
}) => {
  const mimeType = blob.type || getSupportedRecordingMimeType() || 'audio/webm';
  const fileName = `${sanitizeFileSegment(baseLabel)}-${getTimestamp()}.${guessExtension(
    mimeType
  )}`;

  return new File([blob], fileName, {
    type: mimeType,
    lastModified: Date.now(),
  });
};

export const saveRecordingToDevice = async ({
  blob,
  fileName,
  workspaceName,
}: {
  blob: Blob;
  fileName: string;
  workspaceName: string;
}): Promise<SavedDeviceFile> => {
  await ensureFilesystemPermission();

  const workspacePath = `${STORAGE_ROOT}/${workspaceName}`;
  const mediaPath = `${workspacePath}/${AUDIO_DIRECTORY}`;
  const filePath = `${mediaPath}/${fileName}`;

  await ensureDirectory(mediaPath);

  const data = await blobToBase64(blob);

  await Filesystem.writeFile({
    path: filePath,
    data,
    directory: Directory.Documents,
    recursive: true,
  });

  const uriResult = await Filesystem.getUri({
    path: filePath,
    directory: Directory.Documents,
  });

  return {
    fileName,
    path: filePath,
    uri: uriResult.uri,
    workspacePath,
    directoryLabel: `Documents/${STORAGE_ROOT}`,
    webPath: Capacitor.convertFileSrc(uriResult.uri),
  };
};
