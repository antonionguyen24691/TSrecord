import { Capacitor } from '@capacitor/core';
import {
  BackgroundProcessingScheduler,
  PendingBackgroundResumeState,
} from '../plugins/backgroundProcessingScheduler';

const NATIVE_SCHEDULER_SUPPORTED = ['android', 'ios'].includes(Capacitor.getPlatform());

export const scheduleProcessingResume = async ({
  jobId,
  workspacePath,
  delaySeconds = 60,
}: {
  jobId: string;
  workspacePath: string;
  delaySeconds?: number;
}) => {
  if (!NATIVE_SCHEDULER_SUPPORTED) return;
  try {
    await BackgroundProcessingScheduler.scheduleProcessingResume({
      jobId,
      workspacePath,
      delaySeconds,
    });
  } catch (error) {
    console.warn('Background resume scheduling unavailable:', error);
  }
};

export const cancelProcessingResume = async (jobId: string) => {
  if (!NATIVE_SCHEDULER_SUPPORTED) return;
  try {
    await BackgroundProcessingScheduler.cancelProcessingResume({ jobId });
  } catch (error) {
    console.warn('Background resume cancellation unavailable:', error);
  }
};

export const clearPendingProcessingResume = async (jobId?: string) => {
  if (!NATIVE_SCHEDULER_SUPPORTED) return;
  try {
    await BackgroundProcessingScheduler.clearPendingResumeState(jobId ? { jobId } : {});
  } catch (error) {
    console.warn('Background resume state cleanup unavailable:', error);
  }
};

export const getPendingProcessingResumeState = async (): Promise<PendingBackgroundResumeState> => {
  if (!NATIVE_SCHEDULER_SUPPORTED) {
    return {
      jobId: null,
      workspacePath: null,
      state: null,
      scheduledAt: null,
      lastTriggeredAt: null,
    };
  }

  try {
    return await BackgroundProcessingScheduler.getPendingResumeState();
  } catch (error) {
    console.warn('Background resume state read unavailable:', error);
    return {
      jobId: null,
      workspacePath: null,
      state: null,
      scheduledAt: null,
      lastTriggeredAt: null,
    };
  }
};
