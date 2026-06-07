import { registerPlugin } from '@capacitor/core';

export interface PendingBackgroundResumeState {
  jobId: string | null;
  workspacePath: string | null;
  state: string | null;
  scheduledAt: string | null;
  lastTriggeredAt: string | null;
}

export interface BackgroundProcessingSchedulerPlugin {
  scheduleProcessingResume(options: {
    jobId: string;
    workspacePath: string;
    delaySeconds?: number;
  }): Promise<void>;
  cancelProcessingResume(options: { jobId: string }): Promise<void>;
  getPendingResumeState(): Promise<PendingBackgroundResumeState>;
  clearPendingResumeState(options?: { jobId?: string }): Promise<void>;
}

export const BackgroundProcessingScheduler =
  registerPlugin<BackgroundProcessingSchedulerPlugin>('BackgroundProcessingScheduler');
