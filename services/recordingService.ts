import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { MicrophonePermission } from '../plugins/microphonePermission';
import { SavedDeviceFile } from '../types';
import {
  AiSettings,
  DEFAULT_AUTO_GAIN_LEVEL,
  DEFAULT_ECHO_CANCELLATION_LEVEL,
  DEFAULT_NOISE_SUPPRESSION_LEVEL,
  DEFAULT_PREFERRED_CHANNEL_COUNT,
  DEFAULT_PREFERRED_SAMPLE_RATE,
  DEFAULT_RECORDING_PROFILE,
  ProcessingStrength,
  RecordingProfile,
  loadAiSettings,
} from './aiSettingsService';

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

type RecordingConstraintSettings = Pick<
  AiSettings,
  | 'noiseSuppressionLevel'
  | 'echoCancellationLevel'
  | 'autoGainLevel'
  | 'preferredSampleRate'
  | 'preferredChannelCount'
>;

const profilePresets: Record<Exclude<RecordingProfile, 'CUSTOM'>, RecordingConstraintSettings> = {
  BALANCED: {
    noiseSuppressionLevel: 'MEDIUM',
    echoCancellationLevel: 'MEDIUM',
    autoGainLevel: 'LOW',
    preferredSampleRate: 48000,
    preferredChannelCount: 1,
  },
  VOICE_FOCUS: {
    noiseSuppressionLevel: 'HIGH',
    echoCancellationLevel: 'MEDIUM',
    autoGainLevel: 'MEDIUM',
    preferredSampleRate: 48000,
    preferredChannelCount: 1,
  },
  NOISY_ENV: {
    noiseSuppressionLevel: 'HIGH',
    echoCancellationLevel: 'HIGH',
    autoGainLevel: 'HIGH',
    preferredSampleRate: 24000,
    preferredChannelCount: 1,
  },
  RAW: {
    noiseSuppressionLevel: 'OFF',
    echoCancellationLevel: 'OFF',
    autoGainLevel: 'OFF',
    preferredSampleRate: 48000,
    preferredChannelCount: 2,
  },
};

const isProcessingEnabled = (value: ProcessingStrength) => value !== 'OFF';

const resolveRecordingSettings = (settings: AiSettings): RecordingConstraintSettings => {
  const profile =
    settings.recordingProfile && settings.recordingProfile !== 'CUSTOM'
      ? settings.recordingProfile
      : DEFAULT_RECORDING_PROFILE;
  const preset = profilePresets[profile as Exclude<RecordingProfile, 'CUSTOM'>];

  const constraints = {
    noiseSuppressionLevel:
      settings.recordingProfile === 'CUSTOM'
        ? settings.noiseSuppressionLevel || DEFAULT_NOISE_SUPPRESSION_LEVEL
        : preset.noiseSuppressionLevel,
    echoCancellationLevel:
      settings.recordingProfile === 'CUSTOM'
        ? settings.echoCancellationLevel || DEFAULT_ECHO_CANCELLATION_LEVEL
        : preset.echoCancellationLevel,
    autoGainLevel:
      settings.recordingProfile === 'CUSTOM'
        ? settings.autoGainLevel || DEFAULT_AUTO_GAIN_LEVEL
        : preset.autoGainLevel,
    preferredSampleRate:
      settings.recordingProfile === 'CUSTOM'
        ? settings.preferredSampleRate || DEFAULT_PREFERRED_SAMPLE_RATE
        : preset.preferredSampleRate,
    preferredChannelCount:
      settings.recordingProfile === 'CUSTOM'
        ? settings.preferredChannelCount || DEFAULT_PREFERRED_CHANNEL_COUNT
        : preset.preferredChannelCount,
  };

  return constraints;
};

const buildAudioConstraints = (
  settings: AiSettings
): MediaTrackConstraints => {
  const resolved = resolveRecordingSettings(settings);
  const voiceFocused =
    settings.recordingProfile === 'VOICE_FOCUS' || settings.recordingProfile === 'NOISY_ENV';

  const constraints = {
    echoCancellation: isProcessingEnabled(resolved.echoCancellationLevel),
    noiseSuppression: isProcessingEnabled(resolved.noiseSuppressionLevel),
    autoGainControl: isProcessingEnabled(resolved.autoGainLevel),
    channelCount: { ideal: resolved.preferredChannelCount },
    sampleRate: { ideal: resolved.preferredSampleRate },
    sampleSize: voiceFocused ? { ideal: 16 } : undefined,
    latency:
      settings.recordingProfile === 'NOISY_ENV'
        ? { ideal: 0.08 }
        : settings.recordingProfile === 'RAW'
          ? { ideal: 0.02 }
          : { ideal: 0.05 },
    advanced: [
      {
        channelCount: resolved.preferredChannelCount,
        sampleRate: resolved.preferredSampleRate,
      },
      {
        echoCancellation: isProcessingEnabled(resolved.echoCancellationLevel),
        noiseSuppression: isProcessingEnabled(resolved.noiseSuppressionLevel),
        autoGainControl: isProcessingEnabled(resolved.autoGainLevel),
      },
      {
        volume:
          resolved.autoGainLevel === 'HIGH'
            ? 1
            : resolved.autoGainLevel === 'MEDIUM'
              ? 0.92
              : 0.84,
      } as MediaTrackConstraintSet,
    ],
  };

  return constraints as unknown as MediaTrackConstraints;
};

const applyTrackEnhancements = async (
  stream: MediaStream,
  settings: AiSettings
) => {
  const [track] = stream.getAudioTracks();
  if (!track || typeof track.applyConstraints !== 'function') return;

  const resolved = resolveRecordingSettings(settings);
  const supports = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
  const patch: MediaTrackConstraintSet = {};

  if ('echoCancellation' in supports) {
    patch.echoCancellation = isProcessingEnabled(resolved.echoCancellationLevel);
  }
  if ('noiseSuppression' in supports) {
    patch.noiseSuppression = isProcessingEnabled(resolved.noiseSuppressionLevel);
  }
  if ('autoGainControl' in supports) {
    patch.autoGainControl = isProcessingEnabled(resolved.autoGainLevel);
  }
  if ('channelCount' in supports) {
    patch.channelCount = { ideal: resolved.preferredChannelCount };
  }
  if ('sampleRate' in supports) {
    patch.sampleRate = { ideal: resolved.preferredSampleRate };
  }
  if ('sampleSize' in supports) {
    patch.sampleSize = { ideal: 16 };
  }

  if (!Object.keys(patch).length) return;

  try {
    await track.applyConstraints(patch);
  } catch {
    // Keep the stream even if the device rejects advanced constraints.
  }
};

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
  const settings = await loadAiSettings();
  const audioConstraints = buildAudioConstraints(settings);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: audioConstraints,
  });
  await applyTrackEnhancements(stream, settings);

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
