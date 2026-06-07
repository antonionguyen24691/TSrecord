import { registerPlugin } from '@capacitor/core';
import type {
  TranscriptBatchRecord,
  TranscriptProcessingBatchCheckpoint,
  TranscriptProcessingJob,
} from '../types';

export interface ProcessingCheckpointStorePlugin {
  upsertJob(options: { job: TranscriptProcessingJob }): Promise<void>;
  getJob(options: { workspacePath: string }): Promise<{ job: TranscriptProcessingJob | null }>;
  upsertBatchCheckpoint(options: {
    workspacePath: string;
    checkpoint: TranscriptProcessingBatchCheckpoint;
  }): Promise<void>;
  getBatchCheckpoint(options: {
    workspacePath: string;
    batchIndex: number;
  }): Promise<{ checkpoint: TranscriptProcessingBatchCheckpoint | null }>;
  listBatchCheckpoints(options: {
    workspacePath: string;
  }): Promise<{ checkpoints: TranscriptProcessingBatchCheckpoint[] }>;
  upsertTranscriptBatch(options: {
    workspacePath: string;
    batch: TranscriptBatchRecord;
  }): Promise<void>;
  listTranscriptBatches(options: {
    workspacePath: string;
  }): Promise<{ batches: TranscriptBatchRecord[] }>;
  summarizeProgress(options: {
    workspacePath: string;
  }): Promise<{
    savedBatchCount: number;
    failedBatchCount: number;
    lastFailedBatchIndex: number | null;
    lastErrorMessage: string | null;
  }>;
}

export const ProcessingCheckpointStore = registerPlugin<ProcessingCheckpointStorePlugin>(
  'ProcessingCheckpointStore'
);
