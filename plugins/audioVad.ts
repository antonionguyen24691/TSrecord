import { registerPlugin } from '@capacitor/core';

export interface AudioVadResult {
  sampleRate: number;
  durationSeconds: number;
  boundariesSeconds: number[];
}

interface AudioVadPlugin {
  detectSpeechBoundaries(options: {
    fileUri: string;
    chunkDurationSeconds: number;
  }): Promise<AudioVadResult>;
}

export const AudioVad = registerPlugin<AudioVadPlugin>('AudioVad');
