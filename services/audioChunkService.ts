import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { AudioVad } from '../plugins/audioVad';
import { getAudioContext, encodeWav, downmixToMono, resampleMonoChannel } from './utils/audioUtils';

export interface AudioChunkPart {
  index: number;
  total: number;
  startSeconds: number;
  endSeconds: number;
  fileName: string;
  tempFileUri?: string;
  /**
   * Nạp nội dung chunk thành File MỘT cách lazy, ngay trước khi dùng.
   * Trên Android chunk đã nằm sẵn trên đĩa (tempFileUri); chỉ fetch về RAM
   * khi worker thực sự xử lý nó, rồi để GC thu hồi — tránh giữ toàn bộ
   * audio (~hàng trăm MB) trong heap WebView cùng lúc.
   */
  loadFile: () => Promise<File>;
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.flac'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.avi', '.mkv'];
const ANALYSIS_WINDOW_SECONDS = 0.25;
const SILENCE_SEARCH_RADIUS_SECONDS = 45;
const MIN_CHUNK_DURATION_SECONDS = 60;
const TARGET_CHUNK_SAMPLE_RATE = 16000;

const getBaseName = (fileName: string) => fileName.replace(/\.[^.]+$/, '') || 'audio';

const isAudioFile = (file: File) => {
  if (file.type.startsWith('audio/')) return true;
  if (Capacitor.getPlatform() === 'android' && isVideoFile(file)) return true;
  const lowerName = file.name.toLowerCase();
  return AUDIO_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
};

const isVideoFile = (file: File) => {
  if (file.type.startsWith('video/')) return true;
  const lowerName = file.name.toLowerCase();
  return VIDEO_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const slice = bytes.subarray(index, Math.min(bytes.length, index + chunkSize));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
};

const createTempVadPath = (file: File) => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `audio-vad/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
};

const nativeUriToBrowserUrl = (uri: string) => Capacitor.convertFileSrc(uri);

const writeAudioFileToNativeCacheStreamingly = async (file: File, tempPath: string) => {
  const CHUNK_SIZE = 1047552; // Chia hết cho 3 để không hỏng padding Base64 (~1MB)
  let isFirst = true;

  for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await slice.arrayBuffer();
    const base64Chunk = bytesToBase64(new Uint8Array(buffer));

    if (isFirst) {
      await Filesystem.writeFile({
        path: tempPath,
        data: base64Chunk,
        directory: Directory.Cache,
        recursive: true,
      });
      isFirst = false;
    } else {
      await Filesystem.appendFile({
        path: tempPath,
        data: base64Chunk,
        directory: Directory.Cache,
      });
    }
  }
};

const nativeChunkUriToFile = async (fileUri: string, fileName: string) => {
  const response = await fetch(nativeUriToBrowserUrl(fileUri));
  if (!response.ok) {
    throw new Error(`Khong the doc chunk native: ${response.status}`);
  }

  const blob = await response.blob();
  return new File([blob], fileName, {
    type: blob.type || 'audio/wav',
    lastModified: Date.now(),
  });
};

const normalizeAudioBlobToMono16kWav = async (file: File) => {
  const audioContext = getAudioContext();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const originalChannels = Array.from({ length: decoded.numberOfChannels }, (_, channelIndex) =>
      decoded.getChannelData(channelIndex)
    );
    const monoChannel = downmixToMono(originalChannels);
    const resampledChannel = resampleMonoChannel(
      monoChannel,
      decoded.sampleRate,
      TARGET_CHUNK_SAMPLE_RATE
    );

    return encodeWav([resampledChannel], TARGET_CHUNK_SAMPLE_RATE);
  } finally {
    await audioContext.close();
  }
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


const computeRmsWindows = (audioBuffer: AudioBuffer) => {
  const channelData = audioBuffer.getChannelData(0);
  const windowSize = Math.max(1, Math.floor(audioBuffer.sampleRate * ANALYSIS_WINDOW_SECONDS));
  const rmsWindows: number[] = [];

  for (let start = 0; start < channelData.length; start += windowSize) {
    const end = Math.min(channelData.length, start + windowSize);
    let sumSquares = 0;

    for (let index = start; index < end; index += 1) {
      const sample = channelData[index];
      sumSquares += sample * sample;
    }

    const meanSquares = sumSquares / Math.max(1, end - start);
    rmsWindows.push(Math.sqrt(meanSquares));
  }

  return {
    rmsWindows,
    windowSize,
  };
};

const percentile = (values: number[], ratio: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
};

const pickBoundaryWindowIndex = ({
  rmsWindows,
  targetWindowIndex,
  previousBoundaryWindowIndex,
  totalWindowCount,
  minChunkWindows,
  searchRadiusWindows,
  silenceThreshold,
}: {
  rmsWindows: number[];
  targetWindowIndex: number;
  previousBoundaryWindowIndex: number;
  totalWindowCount: number;
  minChunkWindows: number;
  searchRadiusWindows: number;
  silenceThreshold: number;
}) => {
  const searchStart = Math.max(previousBoundaryWindowIndex + minChunkWindows, targetWindowIndex - searchRadiusWindows);
  const searchEnd = Math.min(totalWindowCount - minChunkWindows, targetWindowIndex + searchRadiusWindows);

  let bestSilentCandidate = -1;
  let bestSilentDistance = Number.POSITIVE_INFINITY;
  let bestFallbackCandidate = searchStart;
  let bestFallbackRms = Number.POSITIVE_INFINITY;

  for (let index = searchStart; index <= searchEnd; index += 1) {
    const rms = rmsWindows[index] ?? Number.POSITIVE_INFINITY;
    const distance = Math.abs(index - targetWindowIndex);

    if (rms <= silenceThreshold && distance < bestSilentDistance) {
      bestSilentCandidate = index;
      bestSilentDistance = distance;
    }

    if (rms < bestFallbackRms) {
      bestFallbackCandidate = index;
      bestFallbackRms = rms;
    }
  }

  return bestSilentCandidate >= 0 ? bestSilentCandidate : bestFallbackCandidate;
};

const buildChunkBoundaries = (audioBuffer: AudioBuffer, chunkDurationSeconds: number) => {
  const { rmsWindows, windowSize } = computeRmsWindows(audioBuffer);
  const totalWindowCount = rmsWindows.length;
  const totalDurationSeconds = audioBuffer.duration;
  const minChunkWindows = Math.max(
    1,
    Math.floor((Math.min(chunkDurationSeconds / 2, Math.max(MIN_CHUNK_DURATION_SECONDS, chunkDurationSeconds * 0.35))) / ANALYSIS_WINDOW_SECONDS)
  );
  const searchRadiusWindows = Math.max(1, Math.floor(SILENCE_SEARCH_RADIUS_SECONDS / ANALYSIS_WINDOW_SECONDS));
  const silenceThreshold = Math.max(percentile(rmsWindows, 0.1) * 1.8, 0.0035);

  const boundaries = [0];
  let previousBoundaryWindowIndex = 0;
  let targetSeconds = chunkDurationSeconds;

  while (targetSeconds < totalDurationSeconds - MIN_CHUNK_DURATION_SECONDS) {
    const targetWindowIndex = Math.floor(targetSeconds / ANALYSIS_WINDOW_SECONDS);
    const boundaryWindowIndex = pickBoundaryWindowIndex({
      rmsWindows,
      targetWindowIndex,
      previousBoundaryWindowIndex,
      totalWindowCount,
      minChunkWindows,
      searchRadiusWindows,
      silenceThreshold,
    });

    const boundaryFrame = Math.min(audioBuffer.length, boundaryWindowIndex * windowSize);
    const previousBoundaryFrame = boundaries[boundaries.length - 1];

    if (boundaryFrame <= previousBoundaryFrame + audioBuffer.sampleRate * MIN_CHUNK_DURATION_SECONDS) {
      targetSeconds += chunkDurationSeconds;
      continue;
    }

    boundaries.push(boundaryFrame);
    previousBoundaryWindowIndex = boundaryWindowIndex;
    targetSeconds = boundaryFrame / audioBuffer.sampleRate + chunkDurationSeconds;
  }

  boundaries.push(audioBuffer.length);
  return boundaries;
};

const buildChunkBoundariesFromSeconds = (audioBuffer: AudioBuffer, boundariesSeconds: number[]) => {
  const normalized = boundariesSeconds
    .map((value) => Math.max(0, Math.min(audioBuffer.duration, value)))
    .sort((left, right) => left - right);

  const frames = normalized.map((seconds) =>
    Math.min(audioBuffer.length, Math.round(seconds * audioBuffer.sampleRate))
  );

  const deduped: number[] = [];
  frames.forEach((frame) => {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== frame) {
      deduped.push(frame);
    }
  });

  if (deduped[0] !== 0) deduped.unshift(0);
  if (deduped[deduped.length - 1] !== audioBuffer.length) deduped.push(audioBuffer.length);
  return deduped;
};

const detectAndroidVadBoundaries = async (file: File, chunkDurationSeconds: number) => {
  if (Capacitor.getPlatform() !== 'android') return null;

  const tempPath = createTempVadPath(file);

  try {
    await writeAudioFileToNativeCacheStreamingly(file, tempPath);

    const fileUri = await Filesystem.getUri({
      path: tempPath,
      directory: Directory.Cache,
    });

    const result = await AudioVad.detectSpeechBoundaries({
      fileUri: fileUri.uri,
      chunkDurationSeconds,
    });

    return result.boundariesSeconds;
  } catch (error) {
    console.warn('Native Android VAD unavailable, fallback to local silence scan:', error);
    return null;
  } finally {
    try {
      await Filesystem.deleteFile({
        path: tempPath,
        directory: Directory.Cache,
      });
    } catch {
      // ignore cleanup errors
    }
  }
};

const splitAudioFileIntoNativeAndroidChunks = async (
  file: File,
  chunkDurationSeconds: number,
  speechOnlyUpload: boolean
): Promise<AudioChunkPart[] | null> => {
  if (Capacitor.getPlatform() !== 'android') return null;

  const tempPath = createTempVadPath(file);

  try {
    await writeAudioFileToNativeCacheStreamingly(file, tempPath);

    const fileUri = await Filesystem.getUri({
      path: tempPath,
      directory: Directory.Cache,
    });

    const result = await AudioVad.splitIntoSpeechChunks({
      fileUri: fileUri.uri,
      fileName: file.name,
      chunkDurationSeconds,
      speechOnlyUpload,
    });

    // KHÔNG fetch toàn bộ chunk về RAM ở đây. Chỉ giữ metadata + URI;
    // mỗi chunk sẽ được nạp lazy qua loadFile() ngay trước khi xử lý.
    return result.chunks.map((chunk) => ({
      index: chunk.index,
      total: chunk.total,
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
      fileName: chunk.fileName,
      tempFileUri: chunk.fileUri,
      loadFile: () => nativeChunkUriToFile(chunk.fileUri, chunk.fileName),
    }));
  } catch (error) {
    console.warn('Native Android chunk split unavailable, fallback to web audio split:', error);
    return null;
  } finally {
    try {
      await Filesystem.deleteFile({
        path: tempPath,
        directory: Directory.Cache,
      });
    } catch {
      // ignore cleanup errors
    }
  }
};

export const getMediaDurationSeconds = async (file: File) => readDurationFromMediaElement(file);

export const canSplitFileIntoAudioChunks = (file: File) =>
  isAudioFile(file) || (Capacitor.getPlatform() === 'android' && isVideoFile(file));

export const splitAudioFileIntoChunks = async ({
  file,
  chunkDurationSeconds,
  speechOnlyUpload = false,
}: {
  file: File;
  chunkDurationSeconds: number;
  speechOnlyUpload?: boolean;
}): Promise<AudioChunkPart[]> => {
  const isAndroidExtractableMedia =
    Capacitor.getPlatform() === 'android' && (isAudioFile(file) || isVideoFile(file));
  if (!isAudioFile(file) && !isAndroidExtractableMedia) {
    throw new Error('Chỉ hỗ trợ chia chunk tự động cho file audio.');
  }

  const nativeAndroidParts = isAndroidExtractableMedia
    ? await splitAudioFileIntoNativeAndroidChunks(file, chunkDurationSeconds, speechOnlyUpload)
    : null;
  if (nativeAndroidParts && nativeAndroidParts.length > 0) {
    return nativeAndroidParts;
  }

  if (Capacitor.getPlatform() === 'android' && isVideoFile(file)) {
    throw new Error('Không thể tách audio track từ video này trên Android.');
  }

  // Guard: prevent WebView OOM for large files on mobile platforms.
  // The native streaming path (above) should handle these; this is the
  // last-resort web fallback which loads the entire file into RAM.
  const MAX_WEB_DECODE_BYTES = 25 * 1024 * 1024;
  if (Capacitor.getPlatform() !== 'web' && file.size > MAX_WEB_DECODE_BYTES) {
    throw new Error(
      `File quá lớn (${Math.round(file.size / 1024 / 1024)}MB) để xử lý qua WebView. ` +
        'Vui lòng cập nhật app hoặc thử file nhỏ hơn 25MB.'
    );
  }

  const audioContext = getAudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const nativeBoundariesSeconds = await detectAndroidVadBoundaries(file, chunkDurationSeconds);
    const boundaries = nativeBoundariesSeconds && nativeBoundariesSeconds.length >= 2
      ? buildChunkBoundariesFromSeconds(decoded, nativeBoundariesSeconds)
      : buildChunkBoundaries(decoded, chunkDurationSeconds);
    const totalChunks = boundaries.length - 1;
    const baseName = getBaseName(file.name);
    const parts: AudioChunkPart[] = [];

    for (let index = 0; index < totalChunks; index += 1) {
      const startFrame = boundaries[index];
      const endFrame = boundaries[index + 1];
      const originalChannels = Array.from({ length: decoded.numberOfChannels }, (_, channelIndex) =>
        decoded.getChannelData(channelIndex).slice(startFrame, endFrame)
      );
      const monoChannel = downmixToMono(originalChannels);
      const resampledChannel = resampleMonoChannel(
        monoChannel,
        decoded.sampleRate,
        TARGET_CHUNK_SAMPLE_RATE
      );

      const blob = encodeWav([resampledChannel], TARGET_CHUNK_SAMPLE_RATE);
      const fileName = `${baseName}-part-${String(index + 1).padStart(2, '0')}.wav`;
      const chunkFile = new File([blob], fileName, {
        type: 'audio/wav',
        lastModified: Date.now(),
      });

      parts.push({
        index,
        total: totalChunks,
        startSeconds: startFrame / decoded.sampleRate,
        endSeconds: endFrame / decoded.sampleRate,
        fileName,
        loadFile: () => Promise.resolve(chunkFile),
      });
    }

    return parts;
  } finally {
    await audioContext.close();
  }
};

export const cleanupNativeAudioChunkTemps = async (chunks: AudioChunkPart[]) => {
  const fileUris = chunks.map((chunk) => chunk.tempFileUri).filter((uri): uri is string => Boolean(uri));
  if (fileUris.length === 0 || Capacitor.getPlatform() !== 'android') return;

  try {
    await AudioVad.deleteTempFiles({ fileUris });
  } catch (error) {
    console.warn('Native Android chunk temp cleanup failed:', error);
  }
};

export const prepareAudioFileForTranscription = async (
  file: File,
  options?: { skipNormalization?: boolean }
) => {
  if (
    options?.skipNormalization ||
    file.name.includes('-part-') ||
    file.name.includes('-batch-') ||
    file.name.includes('-normalized.wav') ||
    !isAudioFile(file) ||
    isVideoFile(file)
  ) {
    return file;
  }

  try {
    const normalizedBlob = await normalizeAudioBlobToMono16kWav(file);
    return new File(
      [normalizedBlob],
      `${getBaseName(file.name)}-normalized.wav`,
      {
        type: 'audio/wav',
        lastModified: Date.now(),
      }
    );
  } catch (error) {
    console.warn('Audio normalization failed, using original file for transcription:', error);
    return file;
  }
};
