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

export const mergeAudioChunkFiles = async ({
  chunks,
  files,
  outputFileName,
}: {
  chunks?: Array<{ tempFileUri?: string }>;
  files: File[];
  outputFileName: string;
}): Promise<MergedAudioBatchFile> => {
  if (files.length === 0) {
    throw new Error('Không có audio chunk nào để gộp.');
  }

  const nativeChunkUris =
    Capacitor.getPlatform() === 'android'
      ? (chunks || []).map((chunk) => chunk.tempFileUri).filter((uri): uri is string => Boolean(uri))
      : [];

  if (nativeChunkUris.length === files.length && nativeChunkUris.length > 0) {
    const merged = await AudioVad.mergeWavFiles({
      fileUris: nativeChunkUris,
      outputFileName,
    });
    return {
      file: await nativeMergedUriToFile(merged.fileUri, merged.fileName),
      tempFileUri: merged.fileUri,
    };
  }

  const audioContext = getAudioContext();
  try {
    const decodedBuffers = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return audioContext.decodeAudioData(arrayBuffer.slice(0));
      })
    );

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
