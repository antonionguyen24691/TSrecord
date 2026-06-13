import { Capacitor } from '@capacitor/core';
import { AudioVad } from '../plugins/audioVad';
import { getAudioContext, encodeWav, downmixToMono } from './utils/audioUtils';


export interface MergedAudioBatchFile {
  file: File;
  tempFileUri?: string;
}

const nativeUriToBrowserUrl = (uri: string) => Capacitor.convertFileSrc(uri);

const nativeMergedUriToFile = async (fileUri: string, fileName: string) => {
  const response = await fetch(nativeUriToBrowserUrl(fileUri));
  if (!response.ok) {
    throw new Error(`Khong the doc merged chunk native: ${response.status}`);
  }

  const blob = await response.blob();
  return new File([blob], fileName, {
    type: blob.type || 'audio/wav',
    lastModified: Date.now(),
  });
};

export interface MergeableAudioChunk {
  tempFileUri?: string;
  loadFile: () => Promise<File>;
}

export const mergeAudioChunkFiles = async ({
  chunks,
  outputFileName,
}: {
  chunks: MergeableAudioChunk[];
  outputFileName: string;
}): Promise<MergedAudioBatchFile> => {
  if (chunks.length === 0) {
    throw new Error('Không có audio chunk nào để gộp.');
  }

  const nativeChunkUris =
    Capacitor.getPlatform() === 'android'
      ? chunks.map((chunk) => chunk.tempFileUri).filter((uri): uri is string => Boolean(uri))
      : [];

  // Đường nhanh trên Android: gộp trực tiếp từ các file WAV trên đĩa qua
  // native plugin, KHÔNG nạp chunk nào vào RAM của WebView.
  if (nativeChunkUris.length === chunks.length && nativeChunkUris.length > 0) {
    const merged = await AudioVad.mergeWavFiles({
      fileUris: nativeChunkUris,
      outputFileName,
    });
    return {
      file: await nativeMergedUriToFile(merged.fileUri, merged.fileName),
      tempFileUri: merged.fileUri,
    };
  }

  // Fallback web: nạp từng chunk lazy rồi decode tuần tự (chunk web vốn đã
  // nằm sẵn trong RAM nên đây chỉ là trả về reference, không nhân đôi bộ nhớ).
  const audioContext = getAudioContext();
  try {
    const decodedBuffers: AudioBuffer[] = [];
    for (const chunk of chunks) {
      const file = await chunk.loadFile();
      const arrayBuffer = await file.arrayBuffer();
      decodedBuffers.push(await audioContext.decodeAudioData(arrayBuffer.slice(0)));
    }

    const sampleRate = decodedBuffers[0].sampleRate;
    const totalLength = decodedBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const mergedMono = new Float32Array(totalLength);

    let offset = 0;
    decodedBuffers.forEach((buffer) => {
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, channelIndex) =>
        buffer.getChannelData(channelIndex)
      );
      const mono = downmixToMono(channels);
      mergedMono.set(mono, offset);
      offset += mono.length;
    });

    const wavBlob = encodeWav([mergedMono], sampleRate);
    return {
      file: new File([wavBlob], outputFileName, {
        type: 'audio/wav',
        lastModified: Date.now(),
      }),
    };
  } finally {
    await audioContext.close();
  }
};

export const cleanupMergedAudioBatchTemp = async (tempFileUri?: string) => {
  if (!tempFileUri || Capacitor.getPlatform() !== 'android') return;
  try {
    await AudioVad.deleteTempFiles({ fileUris: [tempFileUri] });
  } catch (error) {
    console.warn('Native Android merged batch temp cleanup failed:', error);
  }
};
