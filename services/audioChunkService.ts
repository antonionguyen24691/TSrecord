export interface AudioChunkPart {
  file: File;
  index: number;
  total: number;
  startSeconds: number;
  endSeconds: number;
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.flac'];
const ANALYSIS_WINDOW_SECONDS = 0.25;
const SILENCE_SEARCH_RADIUS_SECONDS = 45;
const MIN_CHUNK_DURATION_SECONDS = 60;

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
    const boundaries = buildChunkBoundaries(decoded, chunkDurationSeconds);
    const totalChunks = boundaries.length - 1;
    const baseName = getBaseName(file.name);
    const parts: AudioChunkPart[] = [];

    for (let index = 0; index < totalChunks; index += 1) {
      const startFrame = boundaries[index];
      const endFrame = boundaries[index + 1];
      const channelData = Array.from({ length: decoded.numberOfChannels }, (_, channelIndex) =>
        decoded.getChannelData(channelIndex).slice(startFrame, endFrame)
      );

      const blob = encodeWav(channelData, decoded.sampleRate);
      const chunkFile = new File(
        [blob],
        `${baseName}-part-${String(index + 1).padStart(2, '0')}.wav`,
        {
          type: 'audio/wav',
          lastModified: Date.now(),
        }
      );

      parts.push({
        file: chunkFile,
        index,
        total: totalChunks,
        startSeconds: startFrame / decoded.sampleRate,
        endSeconds: endFrame / decoded.sampleRate,
      });
    }

    return parts;
  } finally {
    await audioContext.close();
  }
};
