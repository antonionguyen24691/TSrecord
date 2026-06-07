export const getAudioContext = (errorLabel = 'xử lý audio') => {
  const ContextClass =
    window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!ContextClass) {
    throw new Error(`Thiết bị hiện tại không hỗ trợ AudioContext để ${errorLabel}.`);
  }

  return new ContextClass();
};

export const encodeWav = (channelData: Float32Array[], sampleRate: number): Blob => {
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

export const downmixToMono = (channelData: Float32Array[]): Float32Array => {
  if (channelData.length <= 1) return channelData[0] || new Float32Array();

  const length = channelData[0].length;
  const mono = new Float32Array(length);

  for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
    let sum = 0;
    for (let channelIndex = 0; channelIndex < channelData.length; channelIndex += 1) {
      sum += channelData[channelIndex][sampleIndex] || 0;
    }
    mono[sampleIndex] = sum / channelData.length;
  }

  return mono;
};

export const resampleMonoChannel = (
  source: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array => {
  if (sourceSampleRate === targetSampleRate) return source;

  const ratio = sourceSampleRate / targetSampleRate;
  const targetLength = Math.max(1, Math.round(source.length / ratio));
  const resampled = new Float32Array(targetLength);

  for (let targetIndex = 0; targetIndex < targetLength; targetIndex += 1) {
    const start = Math.floor(targetIndex * ratio);
    const end = Math.min(source.length, Math.floor((targetIndex + 1) * ratio));

    if (end <= start) {
      resampled[targetIndex] = source[Math.min(source.length - 1, start)] || 0;
      continue;
    }

    let sum = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      sum += source[sourceIndex] || 0;
    }
    resampled[targetIndex] = sum / (end - start);
  }

  return resampled;
};

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Content = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
