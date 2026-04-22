import { registerPlugin } from '@capacitor/core';

export interface AudioVadResult {
  sampleRate: number;
  durationSeconds: number;
  boundariesSeconds: number[];
}

export interface AudioVadChunkResult {
  sampleRate: number;
  durationSeconds: number;
  chunks: Array<{
    index: number;
    total: number;
    startSeconds: number;
    endSeconds: number;
    fileUri: string;
    fileName: string;
  }>;
}

interface AudioVadPlugin {
  detectSpeechBoundaries(options: {
    fileUri: string;
    chunkDurationSeconds: number;
  }): Promise<AudioVadResult>;
  splitIntoSpeechChunks(options: {
    fileUri: string;
    fileName: string;
    chunkDurationSeconds: number;
  }): Promise<AudioVadChunkResult>;
}

export const AudioVad = registerPlugin<AudioVadPlugin>('AudioVad');
