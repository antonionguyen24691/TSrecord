import { Capacitor } from '@capacitor/core';
import { Encoding, Filesystem } from '@capacitor/filesystem';
import {
  ExtractionMode,
  InputSource,
  SessionContext,
  TranscriptBatchRecord,
  TranscriptProcessingBatchCheckpoint,
  TranscriptProcessingJob,
} from '../types';
import { getAppStorageDirectory, STORAGE_ROOT } from './storagePaths';
import { createSessionWorkspaceName, sanitizeFileSegment } from './recordingService';
import { ProcessingCheckpointStore } from '../plugins/processingCheckpointStore';

const PROCESSING_DIRECTORY = 'processing';
const JOB_FILE_NAME = 'job.json';
const BATCH_DIRECTORY = 'batches';
const SOURCE_DIRECTORY = 'media';
const SOURCE_FILE_NAME = 'source-upload';
const APPEND_FILE_NAME = 'transcript-append.json';
const COMBINED_FILE_NAME = 'transcript-progress.txt';

const ensureDirectory = async (path: string) => {
  try {
    await Filesystem.mkdir({
      path,
      directory: getAppStorageDirectory(),
      recursive: true,
    });
  } catch (error: any) {
    const message = `${error?.message || ''}`.toLowerCase();
    if (!message.includes('exist')) {
      throw error;
    }
  }
};

const writeJsonFile = async (path: string, value: unknown) => {
  await Filesystem.writeFile({
    path,
    data: JSON.stringify(value, null, 2),
    directory: getAppStorageDirectory(),
    encoding: Encoding.UTF8,
    recursive: true,
  });
};

const readJsonFile = async <T>(path: string): Promise<T | null> => {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: getAppStorageDirectory(),
      encoding: Encoding.UTF8,
    });
    if (typeof result.data !== 'string' || !result.data.trim()) return null;
    return JSON.parse(result.data) as T;
  } catch {
    return null;
  }
};

const writeTextFile = async (path: string, content: string) => {
  await Filesystem.writeFile({
    path,
    data: content,
    directory: getAppStorageDirectory(),
    encoding: Encoding.UTF8,
    recursive: true,
  });
};

const readTextFile = async (path: string) => {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: getAppStorageDirectory(),
      encoding: Encoding.UTF8,
    });
    return typeof result.data === 'string' ? result.data : '';
  } catch {
    return '';
  }
};

const blobToBase64 = async (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const getJobRoot = (workspacePath: string) => `${workspacePath}/${PROCESSING_DIRECTORY}`;
const getJobFilePath = (workspacePath: string) => `${getJobRoot(workspacePath)}/${JOB_FILE_NAME}`;
const getBatchFilePath = (workspacePath: string, batchIndex: number) =>
  `${getJobRoot(workspacePath)}/${BATCH_DIRECTORY}/batch-${String(batchIndex).padStart(3, '0')}.json`;

const nowIso = () => new Date().toISOString();
const SQLITE_CHECKPOINT_SUPPORTED = Capacitor.getPlatform() === 'android';

const safeInvokeCheckpointStore = async <T>(run: () => Promise<T>, fallback: T) => {
  if (!SQLITE_CHECKPOINT_SUPPORTED) return fallback;
  try {
    return await run();
  } catch {
    return fallback;
  }
};

export const createWorkspacePathForUpload = (baseLabel: string) =>
  `${STORAGE_ROOT}/${createSessionWorkspaceName(baseLabel)}`;

export const persistSourceFileToWorkspace = async ({
  file,
  workspacePath,
}: {
  file: File;
  workspacePath: string;
}) => {
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.bin';
  const path = `${workspacePath}/${SOURCE_DIRECTORY}/${SOURCE_FILE_NAME}${extension}`;
  await ensureDirectory(`${workspacePath}/${SOURCE_DIRECTORY}`);
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(file),
    directory: getAppStorageDirectory(),
    recursive: true,
  });
  const uri = await Filesystem.getUri({
    path,
    directory: getAppStorageDirectory(),
  });
  return {
    path,
    uri: Capacitor.convertFileSrc(uri.uri),
  };
};

export const createTranscriptProcessingJob = async ({
  workspacePath,
  sourceAudioPath,
  sourceAudioFileName,
  provider,
  mode,
  source,
  context,
  microChunkMinutes,
  macroBatchMinutes,
}: {
  workspacePath: string;
  sourceAudioPath: string;
  sourceAudioFileName: string;
  provider: string;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  microChunkMinutes: number;
  macroBatchMinutes: number;
}) => {
  await ensureDirectory(`${getJobRoot(workspacePath)}/${BATCH_DIRECTORY}`);

  const job: TranscriptProcessingJob = {
    id: `job-${sanitizeFileSegment(sourceAudioFileName)}-${Date.now().toString(36)}`,
    workspacePath,
    sourceAudioPath,
    sourceAudioFileName,
    status: 'pending',
    provider,
    mode,
    source,
    context,
    currentBatch: 0,
    totalBatches: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    transcriptTextPath: `${getJobRoot(workspacePath)}/${COMBINED_FILE_NAME}`,
    transcriptBatchesPath: `${getJobRoot(workspacePath)}/${APPEND_FILE_NAME}`,
    microChunkMinutes,
    macroBatchMinutes,
  };

  await writeJsonFile(getJobFilePath(workspacePath), job);
  await writeTextFile(job.transcriptTextPath, '');
  await writeJsonFile(job.transcriptBatchesPath, [] satisfies TranscriptBatchRecord[]);
  await safeInvokeCheckpointStore(
    () => ProcessingCheckpointStore.upsertJob({ job }),
    undefined
  );
  return job;
};

export const loadTranscriptProcessingJob = async (workspacePath: string) => {
  const sqliteJob = await safeInvokeCheckpointStore(
    async () => (await ProcessingCheckpointStore.getJob({ workspacePath })).job,
    null as TranscriptProcessingJob | null
  );
  if (sqliteJob) return sqliteJob;
  return readJsonFile<TranscriptProcessingJob>(getJobFilePath(workspacePath));
};

export const updateTranscriptProcessingJob = async (
  workspacePath: string,
  updates: Partial<TranscriptProcessingJob>
) => {
  const current = await loadTranscriptProcessingJob(workspacePath);
  if (!current) return null;

  const nextJob: TranscriptProcessingJob = {
    ...current,
    ...updates,
    updatedAt: nowIso(),
  };
  await writeJsonFile(getJobFilePath(workspacePath), nextJob);
  await safeInvokeCheckpointStore(
    () => ProcessingCheckpointStore.upsertJob({ job: nextJob }),
    undefined
  );
  return nextJob;
};

export const saveTranscriptBatchCheckpoint = async ({
  workspacePath,
  checkpoint,
}: {
  workspacePath: string;
  checkpoint: TranscriptProcessingBatchCheckpoint;
}) => {
  await writeJsonFile(getBatchFilePath(workspacePath, checkpoint.batchIndex), checkpoint);
  await safeInvokeCheckpointStore(
    () => ProcessingCheckpointStore.upsertBatchCheckpoint({ workspacePath, checkpoint }),
    undefined
  );
};

export const loadTranscriptBatchCheckpoint = async ({
  workspacePath,
  batchIndex,
}: {
  workspacePath: string;
  batchIndex: number;
}) => {
  const sqliteCheckpoint = await safeInvokeCheckpointStore(
    async () => (await ProcessingCheckpointStore.getBatchCheckpoint({ workspacePath, batchIndex })).checkpoint,
    null as TranscriptProcessingBatchCheckpoint | null
  );
  if (sqliteCheckpoint) return sqliteCheckpoint;
  return readJsonFile<TranscriptProcessingBatchCheckpoint>(getBatchFilePath(workspacePath, batchIndex));
};

export const listTranscriptBatchCheckpoints = async (workspacePath: string) => {
  const sqliteCheckpoints = await safeInvokeCheckpointStore(
    async () => (await ProcessingCheckpointStore.listBatchCheckpoints({ workspacePath })).checkpoints,
    [] as TranscriptProcessingBatchCheckpoint[]
  );
  if (sqliteCheckpoints.length > 0) {
    return sqliteCheckpoints;
  }

  try {
    const directory = await Filesystem.readdir({
      path: `${getJobRoot(workspacePath)}/${BATCH_DIRECTORY}`,
      directory: getAppStorageDirectory(),
    });
    const fileNames = directory.files
      .map((entry: any) => (typeof entry === 'string' ? entry : (entry?.name as string | undefined)))
      .filter((name): name is string => typeof name === 'string' && name.endsWith('.json'))
      .sort();

    const checkpoints = await Promise.all(
      fileNames.map((fileName) =>
        readJsonFile<TranscriptProcessingBatchCheckpoint>(
          `${getJobRoot(workspacePath)}/${BATCH_DIRECTORY}/${fileName}`
        )
      )
    );

    return checkpoints.filter(
      (checkpoint): checkpoint is TranscriptProcessingBatchCheckpoint => Boolean(checkpoint)
    );
  } catch {
    return [] as TranscriptProcessingBatchCheckpoint[];
  }
};

export const summarizeTranscriptProcessingProgress = async (workspacePath: string) => {
  const sqliteSummary = await safeInvokeCheckpointStore(
    () => ProcessingCheckpointStore.summarizeProgress({ workspacePath }),
    null as {
      savedBatchCount: number;
      failedBatchCount: number;
      lastFailedBatchIndex: number | null;
      lastErrorMessage: string | null;
    } | null
  );
  if (sqliteSummary) {
    return sqliteSummary;
  }

  const checkpoints = await listTranscriptBatchCheckpoints(workspacePath);
  const savedCheckpoints = checkpoints.filter((checkpoint) => checkpoint.saveStatus === 'saved');
  const failedCheckpoints = checkpoints.filter((checkpoint) => checkpoint.saveStatus === 'failed');
  const lastFailedCheckpoint =
    [...failedCheckpoints].sort((left, right) => right.batchIndex - left.batchIndex)[0] || null;

  return {
    savedBatchCount: savedCheckpoints.length,
    failedBatchCount: failedCheckpoints.length,
    lastFailedBatchIndex: lastFailedCheckpoint?.batchIndex ?? null,
    lastErrorMessage: lastFailedCheckpoint?.errorMessage ?? null,
  };
};

export const appendTranscriptBatch = async ({
  workspacePath,
  batch,
}: {
  workspacePath: string;
  batch: TranscriptBatchRecord;
}) => {
  const job = await loadTranscriptProcessingJob(workspacePath);
  if (!job) {
    throw new Error('Transcript processing job not found.');
  }

  const currentBatches =
    (await readJsonFile<TranscriptBatchRecord[]>(job.transcriptBatchesPath)) || [];
  const nextBatches = currentBatches
    .filter((entry) => entry.batchIndex !== batch.batchIndex)
    .concat(batch)
    .sort((left, right) => left.batchIndex - right.batchIndex);

  await writeJsonFile(job.transcriptBatchesPath, nextBatches);
  await writeTextFile(
    job.transcriptTextPath,
    nextBatches.map((entry) => entry.text.trim()).filter(Boolean).join('\n\n').trim()
  );
  await safeInvokeCheckpointStore(
    () => ProcessingCheckpointStore.upsertTranscriptBatch({ workspacePath, batch }),
    undefined
  );
  return nextBatches;
};

export const readTranscriptAppendOnlyBatches = async (workspacePath: string) => {
  const sqliteBatches = await safeInvokeCheckpointStore(
    async () => (await ProcessingCheckpointStore.listTranscriptBatches({ workspacePath })).batches,
    [] as TranscriptBatchRecord[]
  );
  if (sqliteBatches.length > 0) {
    return sqliteBatches;
  }

  const job = await loadTranscriptProcessingJob(workspacePath);
  if (!job) return [];
  return (await readJsonFile<TranscriptBatchRecord[]>(job.transcriptBatchesPath)) || [];
};

export const readCombinedTranscriptText = async (workspacePath: string) => {
  const job = await loadTranscriptProcessingJob(workspacePath);
  if (!job) return '';
  return readTextFile(job.transcriptTextPath);
};
