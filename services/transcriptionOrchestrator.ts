import { Capacitor } from '@capacitor/core';
import {
  ExtractionMode,
  InputSource,
  SavedDeviceFile,
  SessionAnalysis,
  SessionContext,
  TranscriptProcessingJob,
} from '../types';
import { loadAiSettings, TranscriptionProvider, getDeviceId } from './aiSettingsService';
import { fileToBase64 } from './utils/audioUtils';

import {
  canSplitFileIntoAudioChunks,
  cleanupNativeAudioChunkTemps,
  getMediaDurationSeconds,
  prepareAudioFileForTranscription,
  splitAudioFileIntoChunks,
} from './audioChunkService';
import { cleanupMergedAudioBatchTemp, mergeAudioChunkFiles } from './audioBatchService';
import { analyzeTranscriptWithGemini, transcribeAudioWithGemini } from './geminiService';
import { transcribeWithAssemblyAI } from './assemblyaiService';
import { transcribeWithGroq } from './groqService';
import { transcribeWithOpenAI } from './openaiService';
import { logWarning } from './utils/logging';
import {
  appendTranscriptBatch,
  createTranscriptProcessingJob,
  createWorkspacePathForUpload,
  loadTranscriptBatchCheckpoint,
  loadTranscriptProcessingJob,
  persistSourceFileToWorkspace,
  readCombinedTranscriptText,
  readTranscriptAppendOnlyBatches,
  saveTranscriptBatchCheckpoint,
  summarizeTranscriptProcessingProgress,
  updateTranscriptProcessingJob,
} from './transcriptionJobStore';
import { getSpeechRecognitionLanguage, translateServiceMessage } from './utils/serviceMessages';
import { withTimeout } from './utils/timeout';
import { extractTextFromFile, isClientSideExtractable, isPdfFile } from './utils/fileExtractor';
import {
  cancelProcessingResume,
  clearPendingProcessingResume,
  scheduleProcessingResume,
} from './backgroundProcessingScheduler';

export interface OrchestratorProgress {
  stageLabel?: string;
  phase?: 'preparing' | 'transcribing' | 'analyzing' | 'saving' | 'complete';
  progressCurrent?: number;
  progressTotal?: number;
  progressLabel?: string;
  transcriptPreview?: string;
  completedBatchCount?: number;
  chunkStatuses?: Array<{
    id: string;
    label: string;
    status: 'pending' | 'waiting' | 'processing' | 'done' | 'error';
    detail?: string;
  }>;
}

export interface OrchestratorOptions {
  file: File;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  savedRecording?: SavedDeviceFile | null;
  additionalFiles?: File[];
  onStageChange?: (stage: string) => void;
  onProgress?: (progress: OrchestratorProgress) => void;
}

export interface AnalyzeDraftOptions {
  draft: SessionAnalysis;
  file?: File | null;
  additionalFiles?: File[];
  onStageChange?: (stage: string) => void;
  onProgress?: (progress: OrchestratorProgress) => void;
}

const PROVIDER_LABELS: Record<TranscriptionProvider, string> = {
  gemini: 'Google Gemini',
  assemblyai: 'AssemblyAI',
  groq: 'Groq Whisper',
  openai: 'OpenAI Whisper',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const VIDEO_FILE_PATTERN = /\.(mp4|mov|m4v|avi|mkv|webm)$/i;
const TRANSCRIPTION_TIMEOUT_MS = 120000;
const ANALYSIS_TIMEOUT_MS = 120000;
const BATCH_RETRY_DELAYS_MS = [3000, 8000, 20000];

const runWithConcurrency = async <T>(
  taskFactories: Array<() => Promise<T>>,
  concurrency: number
) => {
  const safeConcurrency = Math.max(1, Math.min(concurrency, taskFactories.length || 1));
  const results: T[] = new Array(taskFactories.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const taskIndex = cursor;
      cursor += 1;
      if (taskIndex >= taskFactories.length) return;
      results[taskIndex] = await taskFactories[taskIndex]();
    }
  };

  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
  return results;
};

const formatTimecode = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const offsetTimelineTranscript = (transcriptText: string, offsetSeconds: number) =>
  transcriptText
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\[(\d{2}):(\d{2}):(\d{2})\](.*)$/);
      if (!match) return line;

      const [, hours, minutes, seconds, rest] = match;
      const originalSeconds =
        Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
      return `[${formatTimecode(originalSeconds + offsetSeconds)}]${rest}`;
    })
    .join('\n');

const mergeChunkTranscripts = (
  transcripts: Array<{ text: string; startSeconds: number }>,
  mode: ExtractionMode
) => {
  if (mode === ExtractionMode.TIMELINE) {
    return transcripts
      .map(({ text, startSeconds }) => offsetTimelineTranscript(text, startSeconds))
      .join('\n')
      .trim();
  }

  return transcripts
    .map(({ text }) => text.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
};

const normalizeTimelineTranscriptText = (value: string, mode: ExtractionMode) => {
  if (mode !== ExtractionMode.TIMELINE) {
    return value.trim();
  }

  return value
    .replace(/\s*(\[\d{2}:\d{2}:\d{2}\])\s*/g, '\n$1 ')
    .replace(/\n{2,}/g, '\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
};

const requiresAudioExtractionBeforeTranscription = (file: File) =>
  Capacitor.getPlatform() === 'android' &&
  (file.type.startsWith('video/') || VIDEO_FILE_PATTERN.test(file.name));

const withTranscriptionTimeout = <T>(provider: TranscriptionProvider, promise: Promise<T>) =>
  withTimeout(
    promise,
    TRANSCRIPTION_TIMEOUT_MS,
    translateServiceMessage('orchestrator.providerTimeout', {
      provider: PROVIDER_LABELS[provider],
    })
  );

const transcribeWithProvider = async ({
  provider,
  file,
  mode,
  assemblyaiApiKey,
  groqApiKey,
  openaiApiKey,
  onStageChange,
  settings: passedSettings,
  durationSeconds,
  context,
}: {
  provider: TranscriptionProvider;
  file: File;
  mode: ExtractionMode;
  assemblyaiApiKey: string;
  groqApiKey: string;
  openaiApiKey: string;
  onStageChange?: (stage: string) => void;
  settings?: any;
  durationSeconds?: number;
  context?: string;
}) => {
  const settings = passedSettings || (await loadAiSettings());
  const preparedFile = await prepareAudioFileForTranscription(file);
  if (settings.useAdminKey) {
    onStageChange?.('processing');
    const deviceId = await getDeviceId();
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
    const fileBase64 = await fileToBase64(preparedFile);
    const response = await fetch(`${backendUrl}/api/client/proxy/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        provider,
        fileBase64,
        fileName: preparedFile.name,
        fileType: preparedFile.type,
        mode,
        language: getSpeechRecognitionLanguage(),
        durationSeconds,
        context,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Proxy transcription error (${response.status})`);
    }

    const data = await response.json();
    return normalizeTimelineTranscriptText(data.transcript, mode);
  }

  let transcriptPromise: Promise<string>;

  if (provider === 'gemini') {
    transcriptPromise = transcribeAudioWithGemini({ file: preparedFile, mode, settings });
  } else if (provider === 'assemblyai') {
    transcriptPromise = transcribeWithAssemblyAI(preparedFile, assemblyaiApiKey, onStageChange);
  } else if (provider === 'groq') {
    transcriptPromise = transcribeWithGroq(preparedFile, groqApiKey, onStageChange, mode);
  } else {
    transcriptPromise = transcribeWithOpenAI(preparedFile, openaiApiKey, onStageChange, mode);
  }

  return normalizeTimelineTranscriptText(
    await withTranscriptionTimeout(provider, transcriptPromise),
    mode
  );
};

const transcribeLongAudioIfNeeded = async ({
  file,
  mode,
  provider,
  settings,
  onStageChange,
  onProgress,
  context,
}: {
  file: File;
  mode: ExtractionMode;
  provider: TranscriptionProvider;
  settings: Awaited<ReturnType<typeof loadAiSettings>>;
  onStageChange?: (stage: string) => void;
  onProgress?: (progress: OrchestratorProgress) => void;
  context?: string;
}) => {
  if (!canSplitFileIntoAudioChunks(file)) return null;

  let durationSeconds: number;
  try {
    durationSeconds = await getMediaDurationSeconds(file);
  } catch {
    return null;
  }

  const chunkDurationMinutes = (provider === 'gemini' || provider === 'groq' || provider === 'openai')
    ? Math.min(5, settings.chunkDurationMinutes)
    : settings.chunkDurationMinutes;
  const chunkDurationSeconds = chunkDurationMinutes * 60;
  const shouldForcePreparedAudio = requiresAudioExtractionBeforeTranscription(file);
  if (
    !shouldForcePreparedAudio &&
    (!Number.isFinite(durationSeconds) || durationSeconds <= chunkDurationSeconds)
  ) {
    return null;
  }

  onProgress?.({
    phase: 'preparing',
    stageLabel: translateServiceMessage('orchestrator.chunkPreparing', {
      provider: PROVIDER_LABELS[provider],
    }),
    progressLabel: translateServiceMessage('orchestrator.chunkPreparingDetails'),
    chunkStatuses: [],
  });
  onStageChange?.(
    translateServiceMessage('orchestrator.fileLongSplitting', {
      minutes: Math.ceil(durationSeconds / 60),
      chunkMinutes: chunkDurationMinutes,
    })
  );

  try {
    const chunks = await splitAudioFileIntoChunks({
      file,
      chunkDurationSeconds,
    });

    const chunkStatuses: NonNullable<OrchestratorProgress['chunkStatuses']> = chunks.map((chunk) => ({
      id: `chunk-${chunk.index + 1}`,
      label: translateServiceMessage('orchestrator.chunkLabel', {
        index: chunk.index + 1,
        total: chunk.total,
      }),
      status: 'pending' as const,
      detail: `${formatTimecode(chunk.startSeconds)} - ${formatTimecode(chunk.endSeconds)}`,
    }));

    let completedCount = 0;
    let dispatchCounter = 0;
    const safeConcurrency = Math.max(1, Math.min(settings.chunkConcurrency, chunks.length));
    const syncProgress = (stageLabel?: string) => {
      onProgress?.({
        phase: 'transcribing',
        stageLabel,
        progressCurrent: completedCount,
        progressTotal: chunks.length,
        progressLabel: translateServiceMessage('orchestrator.chunkProgress', {
          completed: completedCount,
          total: chunks.length,
        }),
        chunkStatuses: [...chunkStatuses],
      });
    };

    syncProgress(
      translateServiceMessage('orchestrator.chunkSplitComplete', {
        count: chunks.length,
        concurrency: safeConcurrency,
      })
    );

    const transcripts = await runWithConcurrency(
      chunks.map((chunk) => async () => {
        const dispatchOrder = dispatchCounter++;
        const staggerDelayMs = dispatchOrder * settings.chunkStaggerSeconds * 1000;
        if (staggerDelayMs > 0) {
          chunkStatuses[chunk.index] = {
            ...chunkStatuses[chunk.index],
            status: 'waiting',
            detail: translateServiceMessage('orchestrator.chunkWaitingBeforeSend', {
              seconds: Math.round(staggerDelayMs / 1000),
            }),
          };
          syncProgress();
          await sleep(staggerDelayMs);
        }

        let attempt = 0;
        const maxChunkRetries = 3;
        let lastError: any = null;

        while (attempt < maxChunkRetries) {
          try {
            if (attempt > 0) {
              chunkStatuses[chunk.index] = {
                ...chunkStatuses[chunk.index],
                status: 'waiting',
                detail: translateServiceMessage('orchestrator.chunkRetry', {
                  attempt,
                  maxRetries: maxChunkRetries - 1,
                }),
              };
              syncProgress();
              await sleep(3000);
            }

            chunkStatuses[chunk.index] = {
              ...chunkStatuses[chunk.index],
              status: 'processing',
              detail: `${formatTimecode(chunk.startSeconds)} - ${formatTimecode(chunk.endSeconds)}`,
            };
            syncProgress(
              translateServiceMessage('orchestrator.chunkProcessing', {
                index: chunk.index + 1,
                total: chunk.total,
                concurrency: safeConcurrency,
              })
            );
            onStageChange?.(
              translateServiceMessage('orchestrator.chunkStarting', {
                index: chunk.index + 1,
                total: chunk.total,
                start: formatTimecode(chunk.startSeconds),
                end: formatTimecode(chunk.endSeconds),
              })
            );

            const text = await transcribeWithProvider({
              provider,
              file: chunk.file,
              mode,
              assemblyaiApiKey: settings.assemblyaiApiKey,
              groqApiKey: settings.groqApiKey,
              openaiApiKey: settings.openaiApiKey,
              onStageChange: (status: string) =>
                onStageChange?.(`Phần ${chunk.index + 1}/${chunk.total}: ${status}`),
              durationSeconds: chunk.endSeconds - chunk.startSeconds,
              context,
            });

            completedCount += 1;
            chunkStatuses[chunk.index] = {
              ...chunkStatuses[chunk.index],
              status: 'done',
              detail: translateServiceMessage('orchestrator.chunkDone', {
                start: formatTimecode(chunk.startSeconds),
                end: formatTimecode(chunk.endSeconds),
              }),
            };
            syncProgress();

            return {
              index: chunk.index,
              text,
              startSeconds: chunk.startSeconds,
            };
          } catch (error) {
            lastError = error;
            attempt += 1;
          }
        }

        chunkStatuses[chunk.index] = {
          ...chunkStatuses[chunk.index],
          status: 'error',
          detail: lastError instanceof Error ? lastError.message : String(lastError),
        };
        syncProgress();
        throw lastError;
      }),
      safeConcurrency
    );

    onProgress?.({
      phase: 'transcribing',
      stageLabel: translateServiceMessage('orchestrator.chunkCompleteMerging'),
      progressCurrent: chunks.length,
      progressTotal: chunks.length,
      progressLabel: '100%',
      chunkStatuses: [...chunkStatuses],
    });

    return normalizeTimelineTranscriptText(
      mergeChunkTranscripts(
      transcripts.sort((left, right) => left.index - right.index),
      mode
      ),
      mode
    );
  } catch (error) {
    logWarning('Chunked transcription fallback to direct transcription:', error);
    onProgress?.({
      phase: 'transcribing',
      stageLabel: translateServiceMessage('orchestrator.chunkFallbackDirect'),
      chunkStatuses: [],
    });
    return null;
  }
};

interface MacroBatchPlan {
  batchIndex: number;
  chunks: Array<{
    file: File;
    index: number;
    startSeconds: number;
    endSeconds: number;
    tempFileUri?: string;
  }>;
  chunkIndexes: number[];
  files: File[];
  startSeconds: number;
  endSeconds: number;
}

const buildMacroBatchPlans = ({
  chunks,
  targetBatchMinutes,
}: {
  chunks: Array<{
    file: File;
    index: number;
    startSeconds: number;
    endSeconds: number;
    tempFileUri?: string;
  }>;
  targetBatchMinutes: number;
}) => {
  const targetSeconds = Math.max(300, Math.floor(targetBatchMinutes * 60));
  const plans: MacroBatchPlan[] = [];
  let currentFiles: File[] = [];
  let currentIndexes: number[] = [];
  let currentStartSeconds = 0;
  let currentEndSeconds = 0;

  const chunkMap = new Map(chunks.map((chunk) => [chunk.index, chunk]));

  const flush = () => {
    if (currentFiles.length === 0) return;
    plans.push({
      batchIndex: plans.length + 1,
      chunks: currentIndexes.map((chunkIndex, index) => {
        const foundChunk = chunkMap.get(chunkIndex);
        return {
          file: currentFiles[index],
          index: chunkIndex,
          startSeconds: foundChunk?.startSeconds || currentStartSeconds,
          endSeconds: foundChunk?.endSeconds || currentEndSeconds,
          tempFileUri: foundChunk?.tempFileUri,
        };
      }),
      chunkIndexes: [...currentIndexes],
      files: [...currentFiles],
      startSeconds: currentStartSeconds,
      endSeconds: currentEndSeconds,
    });
    currentFiles = [];
    currentIndexes = [];
    currentStartSeconds = 0;
    currentEndSeconds = 0;
  };

  chunks.forEach((chunk) => {
    if (currentFiles.length === 0) {
      currentStartSeconds = chunk.startSeconds;
    }

    currentFiles.push(chunk.file);
    currentIndexes.push(chunk.index);
    currentEndSeconds = chunk.endSeconds;

    if (currentEndSeconds - currentStartSeconds >= targetSeconds) {
      flush();
    }
  });

  flush();
  return plans;
};

const estimateMacroBatchMinutes = ({
  provider,
  settings,
}: {
  provider: TranscriptionProvider;
  settings: Awaited<ReturnType<typeof loadAiSettings>>;
}) => {
  const configured = settings.macroBatchMinutes;
  const connection = typeof navigator !== 'undefined' ? (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection : undefined;
  const effectiveType = connection?.effectiveType || '';
  const saveData = Boolean(connection?.saveData);
  const deviceMemory =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0
      : 0;

  let adaptiveTarget = configured;

  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
    adaptiveTarget = Math.min(adaptiveTarget, 10);
  } else if (effectiveType === '3g') {
    adaptiveTarget = Math.min(adaptiveTarget, 15);
  } else if (effectiveType === '4g') {
    adaptiveTarget = Math.min(adaptiveTarget, 20);
  }

  if (deviceMemory > 0 && deviceMemory <= 4) {
    adaptiveTarget = Math.min(adaptiveTarget, 12);
  } else if (deviceMemory > 0 && deviceMemory <= 6) {
    adaptiveTarget = Math.min(adaptiveTarget, 15);
  }

  if (provider === 'gemini') {
    adaptiveTarget = Math.min(adaptiveTarget, settings.useAdminKey ? 15 : 12);
  }
  if (provider === 'groq' || provider === 'openai') {
    adaptiveTarget = Math.min(adaptiveTarget, 10);
  }
  return Math.max(5, adaptiveTarget);
};

const estimateMicroChunkMinutes = ({
  provider,
  settings,
}: {
  provider: TranscriptionProvider;
  settings: Awaited<ReturnType<typeof loadAiSettings>>;
}) => {
  const configured = Math.max(1, Math.min(settings.chunkDurationMinutes, 5));
  if (provider === 'gemini') {
    return Math.min(configured, settings.useAdminKey ? 4 : 3);
  }
  if (provider === 'groq' || provider === 'openai') {
    return Math.min(configured, 3);
  }
  return configured;
};

const shouldFallbackBatchImmediately = ({
  provider,
  error,
}: {
  provider: TranscriptionProvider;
  error: unknown;
}) => {
  if (provider !== 'gemini') return false;
  const message = `${error instanceof Error ? error.message : String(error)}`.toLowerCase();
  return /(400|413|429|resource_exhausted|invalid_argument|payload too large|request entity too large|file too large|quota|rate limit|too many requests)/i.test(
    message
  );
};

const isRetryableError = (error: unknown): boolean => {
  const message = `${error instanceof Error ? error.message : String(error)}`.toLowerCase();
  if (
    /apiKey|invalid api key|unauthorized|forbidden|credentials|payment|credit|401|403|402/i.test(
      message
    )
  ) {
    return false;
  }
  return true;
};

const prepareProcessingWorkspace = async ({
  file,
  savedRecording,
  provider,
  mode,
  source,
  context,
  settings,
}: {
  file: File;
  savedRecording?: SavedDeviceFile | null;
  provider: TranscriptionProvider;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  settings: Awaited<ReturnType<typeof loadAiSettings>>;
}) => {
  const workspacePath =
    savedRecording?.workspacePath ||
    createWorkspacePathForUpload(file.name.replace(/\.[^.]+$/, '') || 'session');

  let sourceAudioPath = savedRecording?.path || '';
  if (!sourceAudioPath) {
    const savedSource = await persistSourceFileToWorkspace({
      file,
      workspacePath,
    });
    sourceAudioPath = savedSource.path;
  }

  const existingJob = await loadTranscriptProcessingJob(workspacePath);
  const job =
    existingJob ||
    (await createTranscriptProcessingJob({
      workspacePath,
      sourceAudioPath,
      sourceAudioFileName: file.name,
      provider,
      mode,
      source,
      context,
      microChunkMinutes: settings.chunkDurationMinutes,
      macroBatchMinutes: estimateMacroBatchMinutes({ provider, settings }),
    }));

  return { workspacePath, sourceAudioPath, job };
};

export const processWithOrchestrator = async (
  options: OrchestratorOptions
): Promise<SessionAnalysis> => {
  const { file, mode, source, context, savedRecording, additionalFiles, onStageChange, onProgress } = options;
  let durationSeconds: number | undefined;
  try {
    durationSeconds = await getMediaDurationSeconds(file);
  } catch {
    // ignore
  }
  const settings = await loadAiSettings();
  const provider = settings.transcriptionProvider;
  const providerLabel = PROVIDER_LABELS[provider];

  onProgress?.({
    phase: 'preparing',
    stageLabel: translateServiceMessage('orchestrator.preparingPipeline'),
    progressLabel: translateServiceMessage('orchestrator.currentProvider', {
      provider: providerLabel,
    }),
    chunkStatuses: [],
  });

  const handleProviderProgress = (status: string) => {
    const statusMap: Record<string, string> = {
      uploading: translateServiceMessage('orchestrator.providerUploading', {
        provider: providerLabel,
      }),
      queued: translateServiceMessage('orchestrator.providerQueued', {
        provider: providerLabel,
      }),
      processing: translateServiceMessage('orchestrator.providerProcessingSpeech', {
        provider: providerLabel,
      }),
      completed: translateServiceMessage('orchestrator.providerProcessingDone'),
    };
    const nextLabel = statusMap[status] || `${providerLabel}: ${status}`;
    onStageChange?.(nextLabel);
    onProgress?.({
      phase: 'transcribing',
      stageLabel: nextLabel,
      progressLabel: `Provider: ${providerLabel}`,
    });
  };

  let transcriptText =
    (await transcribeLongAudioIfNeeded({
      file,
      mode,
      provider,
      settings,
      onStageChange,
      onProgress,
      context,
    })) || '';

  if (!transcriptText) {
    if (requiresAudioExtractionBeforeTranscription(file)) {
      throw new Error(
        translateServiceMessage('orchestrator.androidVideoPrepFailed')
      );
    }

    onProgress?.({
      phase: 'transcribing',
      stageLabel: translateServiceMessage('orchestrator.directTranscript', {
        provider: providerLabel,
      }),
      progressLabel: translateServiceMessage('orchestrator.directTranscriptShortFile'),
      chunkStatuses: [],
    });

    transcriptText = await transcribeWithProvider({
      provider,
      file,
      mode,
      assemblyaiApiKey: settings.assemblyaiApiKey,
      groqApiKey: settings.groqApiKey,
      openaiApiKey: settings.openaiApiKey,
      onStageChange: handleProviderProgress,
      settings,
      durationSeconds,
      context,
    });
  }

  if (!transcriptText) {
    throw new Error(
      translateServiceMessage('orchestrator.providerNoTranscript', {
        provider: providerLabel,
      })
    );
  }

  if (context === SessionContext.TRANSCRIPTION) {
    onProgress?.({
      phase: 'complete',
      stageLabel: translateServiceMessage('orchestrator.transcriptDone'),
      progressLabel: '100%',
      chunkStatuses: [],
    });
    onStageChange?.(translateServiceMessage('orchestrator.done'));

    const deriveTitle = (text: string, fallback: string) => {
      const cleaned = text
        .replace(/^\[[\d:]+\]\s*/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleaned) return fallback;
      const snippet = cleaned.slice(0, 80);
      const cutoff = snippet.lastIndexOf(' ');
      return (cutoff > 20 ? snippet.slice(0, cutoff) : snippet).trim() + (cleaned.length > 80 ? '...' : '');
    };

    const rawTitle = file.name.replace(/\.[^.]+$/, '') || 'Transcript';
    const title = deriveTitle(transcriptText, rawTitle);
    const folderName = rawTitle.replace(/\s+/g, '-') || 'transcript';

    return {
      title,
      mode,
      source,
      context,
      suggestedFolderName: folderName,
      artifacts: {
        transcript: transcriptText,
        summary: '',
        decisions: '',
        risks: '',
        folderTree: '',
        mindmap: '',
        actionItems: '',
      },
      savedRecording,
    };
  }

  // Trích xuất nội dung từ các file tài liệu đính kèm
  const additionalExtractedTexts: Array<{ fileName: string; content: string }> = [];
  const additionalPdfFiles: File[] = [];

  if (additionalFiles && additionalFiles.length > 0) {
    onStageChange?.(translateServiceMessage('orchestrator.extractingAttachments'));
    onProgress?.({
      phase: 'preparing',
      stageLabel: translateServiceMessage('orchestrator.extractingAttachments'),
      progressLabel: translateServiceMessage('orchestrator.readingSupportingFiles'),
      chunkStatuses: [],
    });

    for (const addFile of additionalFiles) {
      if (isPdfFile(addFile)) {
        additionalPdfFiles.push(addFile);
      } else if (isClientSideExtractable(addFile)) {
        try {
          const content = await extractTextFromFile(addFile);
          if (content.trim()) {
            additionalExtractedTexts.push({ fileName: addFile.name, content });
          }
        } catch (err) {
          logWarning(
            translateServiceMessage('orchestrator.extractingAttachmentFailed', {
              fileName: addFile.name,
            }),
            err
          );
        }
      }
    }
  }

  const analysisLabel =
    context === SessionContext.INTERVIEW
      ? translateServiceMessage('orchestrator.geminiInterviewAnalysis')
      : translateServiceMessage('orchestrator.geminiMeetingAnalysis');
  const analysisProgress =
    context === SessionContext.INTERVIEW
      ? translateServiceMessage('orchestrator.geminiInterviewProgress')
      : translateServiceMessage('orchestrator.geminiMeetingProgress');

  onProgress?.({
    phase: 'analyzing',
    stageLabel: analysisLabel,
    progressLabel: analysisProgress,
    chunkStatuses: [],
  });
  onStageChange?.(analysisLabel);

  return withTimeout(
    analyzeTranscriptWithGemini({
      transcriptText,
      file,
      mode,
      source,
      context,
      savedRecording,
      additionalExtractedTexts,
      additionalPdfFiles,
    }),
    ANALYSIS_TIMEOUT_MS,
    translateServiceMessage('orchestrator.geminiAnalysisTimeout')
  );
};

const deriveDraftTitle = (text: string, fallback: string) => {
  const cleaned = text
    .replace(/^\[[\d:]+\]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallback;
  const snippet = cleaned.slice(0, 80);
  const cutoff = snippet.lastIndexOf(' ');
  return (cutoff > 20 ? snippet.slice(0, cutoff) : snippet).trim() + (cleaned.length > 80 ? '...' : '');
};

const createDraftTranscriptAnalysis = ({
  transcriptText,
  rawTitle,
  mode,
  source,
  context,
  workspacePath,
  jobId,
  processingJobStatus,
  processingJobCurrentBatch,
  processingJobTotalBatches,
  processingSavedBatchCount,
  processingFailedBatchCount,
  processingLastFailedBatchIndex,
  processingLastErrorMessage,
  transcriptBatches,
  savedRecording,
  originalFileName,
}: {
  transcriptText: string;
  rawTitle: string;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  workspacePath: string;
  jobId: string;
  processingJobStatus: TranscriptProcessingJob['status'];
  processingJobCurrentBatch?: number;
  processingJobTotalBatches?: number;
  processingSavedBatchCount?: number;
  processingFailedBatchCount?: number;
  processingLastFailedBatchIndex?: number | null;
  processingLastErrorMessage?: string | null;
  transcriptBatches: Awaited<ReturnType<typeof readTranscriptAppendOnlyBatches>>;
  savedRecording?: SavedDeviceFile | null;
  originalFileName: string;
}): SessionAnalysis => ({
  title: context === SessionContext.TRANSCRIPTION ? deriveDraftTitle(transcriptText, rawTitle) : rawTitle,
  mode,
  source,
  context,
  suggestedFolderName: rawTitle.replace(/\s+/g, '-') || 'transcript',
  analysisStatus:
    processingJobStatus === 'complete' && context === SessionContext.TRANSCRIPTION
      ? 'complete'
      : 'draft_transcript',
  workspacePath,
  processingJobId: jobId,
  processingJobStatus,
  processingJobCurrentBatch,
  processingJobTotalBatches,
  processingSavedBatchCount,
  processingFailedBatchCount,
  processingLastFailedBatchIndex,
  processingLastErrorMessage,
  transcriptBatches,
  artifacts: {
    transcript: transcriptText,
    summary: '',
    decisions: '',
    risks: '',
    folderTree: '',
    mindmap: '',
    actionItems: '',
  },
  savedRecording,
  originalFileName,
});

const transcribeMacroPlanAsSmallerChunks = async ({
  plan,
  mode,
  provider,
  settings,
  onStageChange,
  context,
}: {
  plan: MacroBatchPlan;
  mode: ExtractionMode;
  provider: TranscriptionProvider;
  settings: Awaited<ReturnType<typeof loadAiSettings>>;
  onStageChange?: (stage: string) => void;
  context?: string;
}) => {
  const transcripts: Array<{ text: string; startSeconds: number }> = [];

  for (const chunk of plan.chunks) {
    onStageChange?.(
      translateServiceMessage('orchestrator.chunkStarting', {
        index: chunk.index + 1,
        total: plan.chunks.length,
        start: formatTimecode(chunk.startSeconds),
        end: formatTimecode(chunk.endSeconds),
      })
    );

    const text = await transcribeWithProvider({
      provider,
      file: chunk.file,
      mode,
      assemblyaiApiKey: settings.assemblyaiApiKey,
      groqApiKey: settings.groqApiKey,
      openaiApiKey: settings.openaiApiKey,
      onStageChange,
      settings,
      durationSeconds: chunk.endSeconds - chunk.startSeconds,
      context,
    });

    transcripts.push({
      text,
      startSeconds: chunk.startSeconds,
    });
  }

  return normalizeTimelineTranscriptText(
    mergeChunkTranscripts(transcripts, mode),
    mode
  );
};

export const transcribeSessionDraft = async (
  options: OrchestratorOptions
): Promise<SessionAnalysis> => {
  const { file, mode, source, context, savedRecording, onStageChange, onProgress } = options;
  let durationSeconds: number | undefined;
  try {
    durationSeconds = await getMediaDurationSeconds(file);
  } catch {
    // ignore
  }
  const settings = await loadAiSettings();
  const provider = settings.transcriptionProvider;
  const providerLabel = PROVIDER_LABELS[provider];
  const { workspacePath, job } = await prepareProcessingWorkspace({
    file,
    savedRecording,
    provider,
    mode,
    source,
    context,
    settings,
  });
  const macroBatchMinutes = estimateMacroBatchMinutes({ provider, settings });
  const rawTitle = file.name.replace(/\.[^.]+$/, '') || 'Transcript';

  onProgress?.({
    phase: 'preparing',
    stageLabel: translateServiceMessage('orchestrator.preparingPipeline'),
    progressLabel: translateServiceMessage('orchestrator.currentProvider', {
      provider: providerLabel,
    }),
    chunkStatuses: [],
  });

  const handleProviderProgress = (status: string) => {
    const statusMap: Record<string, string> = {
      uploading: translateServiceMessage('orchestrator.providerUploading', {
        provider: providerLabel,
      }),
      queued: translateServiceMessage('orchestrator.providerQueued', {
        provider: providerLabel,
      }),
      processing: translateServiceMessage('orchestrator.providerProcessingSpeech', {
        provider: providerLabel,
      }),
      completed: translateServiceMessage('orchestrator.providerProcessingDone'),
    };
    const nextLabel = statusMap[status] || `${providerLabel}: ${status}`;
    onStageChange?.(nextLabel);
    onProgress?.({
      phase: 'transcribing',
      stageLabel: nextLabel,
      progressLabel: `Provider: ${providerLabel}`,
    });
  };

  let transcriptText = '';

  if (canSplitFileIntoAudioChunks(file)) {
    try {
      const microChunks = await splitAudioFileIntoChunks({
        file,
        chunkDurationSeconds: estimateMicroChunkMinutes({ provider, settings }) * 60,
        speechOnlyUpload: provider === 'gemini' && mode !== ExtractionMode.TIMELINE,
      });
      try {
        const macroPlans = buildMacroBatchPlans({
          chunks: microChunks,
          targetBatchMinutes: macroBatchMinutes,
        });

        if (microChunks.length > 1 && macroPlans.length >= 1) {
          const existingTranscriptPreview = await readCombinedTranscriptText(workspacePath);
          const existingBatches = await readTranscriptAppendOnlyBatches(workspacePath);
          const savedBatchIndexes = new Set(existingBatches.map((batch) => batch.batchIndex));
          await updateTranscriptProcessingJob(workspacePath, {
            status: 'processing',
            totalBatches: macroPlans.length,
            currentBatch: 0,
          });

          const batchStatuses: NonNullable<OrchestratorProgress['chunkStatuses']> = macroPlans.map((plan) => ({
            id: `macro-batch-${plan.batchIndex}`,
            label: translateServiceMessage('orchestrator.chunkLabel', {
              index: plan.batchIndex,
              total: macroPlans.length,
            }),
            status: savedBatchIndexes.has(plan.batchIndex) ? 'done' : 'pending',
            detail: `${formatTimecode(plan.startSeconds)} - ${formatTimecode(plan.endSeconds)}`,
          }));

          onProgress?.({
            phase: 'preparing',
            stageLabel: translateServiceMessage('orchestrator.chunkSplitComplete', {
              count: macroPlans.length,
              concurrency: 1,
            }),
            progressCurrent: existingBatches.length,
            progressTotal: macroPlans.length,
            progressLabel: translateServiceMessage('orchestrator.chunkProgress', {
              completed: existingBatches.length,
              total: macroPlans.length,
            }),
            transcriptPreview: existingTranscriptPreview,
            completedBatchCount: existingBatches.length,
            chunkStatuses: batchStatuses,
          });

          let combinedTranscriptPreview = existingTranscriptPreview || '';

          for (const plan of macroPlans) {
          const checkpoint = await loadTranscriptBatchCheckpoint({
            workspacePath,
            batchIndex: plan.batchIndex,
          });

          if (checkpoint?.saveStatus === 'saved') {
            batchStatuses[plan.batchIndex - 1] = {
              ...batchStatuses[plan.batchIndex - 1],
              status: 'done',
            };
            continue;
          }

          batchStatuses[plan.batchIndex - 1] = {
            ...batchStatuses[plan.batchIndex - 1],
            status: 'processing',
          };

          onStageChange?.(
            translateServiceMessage('orchestrator.chunkStarting', {
              index: plan.batchIndex,
              total: macroPlans.length,
              start: formatTimecode(plan.startSeconds),
              end: formatTimecode(plan.endSeconds),
            })
          );
          onProgress?.({
            phase: 'transcribing',
            stageLabel: translateServiceMessage('orchestrator.chunkProcessing', {
              index: plan.batchIndex,
              total: macroPlans.length,
              concurrency: 1,
            }),
            progressCurrent: Math.max(0, plan.batchIndex - 1),
            progressTotal: macroPlans.length,
            progressLabel: translateServiceMessage('orchestrator.chunkProgress', {
              completed: Math.max(0, plan.batchIndex - 1),
              total: macroPlans.length,
            }),
              chunkStatuses: [...batchStatuses],
          });

          try {
            let batchTranscript = '';
            let batchTranscriptAlreadyOffset = false;
            let lastError: unknown = null;

            for (let attemptIndex = 0; attemptIndex <= BATCH_RETRY_DELAYS_MS.length; attemptIndex += 1) {
              try {
                await saveTranscriptBatchCheckpoint({
                  workspacePath,
                  checkpoint: {
                    batchIndex: plan.batchIndex,
                    microChunkIndexes: plan.chunkIndexes,
                    startMs: Math.round(plan.startSeconds * 1000),
                    endMs: Math.round(plan.endSeconds * 1000),
                    uploadStatus: 'pending',
                    transcribeStatus: 'pending',
                    saveStatus: 'pending',
                    retryCount: attemptIndex,
                    audioTempPath: null,
                    textPath: null,
                    errorMessage: null,
                    updatedAt: new Date().toISOString(),
                  },
                });

                const mergedBatchFile = await mergeAudioChunkFiles({
                  chunks: plan.chunks,
                  files: plan.files,
                  outputFileName: `${rawTitle || 'audio'}-batch-${String(
                    plan.batchIndex
                  ).padStart(2, '0')}.wav`,
                });

                try {
                  batchTranscript = await transcribeWithProvider({
                    provider,
                    file: mergedBatchFile.file,
                    mode,
                    assemblyaiApiKey: settings.assemblyaiApiKey,
                    groqApiKey: settings.groqApiKey,
                    openaiApiKey: settings.openaiApiKey,
                    onStageChange: handleProviderProgress,
                    settings,
                    durationSeconds: plan.endSeconds - plan.startSeconds,
                    context,
                  });
                } finally {
                  await cleanupMergedAudioBatchTemp(mergedBatchFile.tempFileUri);
                }
                lastError = null;
                break;
              } catch (error) {
                lastError = error;
                if (!isRetryableError(error)) {
                  throw error;
                }
                const retryDelayMs = BATCH_RETRY_DELAYS_MS[attemptIndex];
                await saveTranscriptBatchCheckpoint({
                  workspacePath,
                  checkpoint: {
                    batchIndex: plan.batchIndex,
                    microChunkIndexes: plan.chunkIndexes,
                    startMs: Math.round(plan.startSeconds * 1000),
                    endMs: Math.round(plan.endSeconds * 1000),
                    uploadStatus: 'failed',
                    transcribeStatus: 'failed',
                    saveStatus: 'failed',
                    retryCount: attemptIndex + 1,
                    audioTempPath: null,
                    textPath: null,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    updatedAt: new Date().toISOString(),
                  },
                });

                if (shouldFallbackBatchImmediately({ provider, error })) {
                  if (plan.chunks.length > 1) {
                    onStageChange?.(
                      translateServiceMessage('orchestrator.chunkFallbackDirect')
                    );
                    batchTranscript = await transcribeMacroPlanAsSmallerChunks({
                      plan,
                      mode,
                      provider,
                      settings,
                      onStageChange: handleProviderProgress,
                      context,
                    });
                    batchTranscriptAlreadyOffset = true;
                    lastError = null;
                    break;
                  }
                  throw error;
                }

                if (!retryDelayMs) {
                  if (plan.chunks.length > 1) {
                    onStageChange?.(
                      translateServiceMessage('orchestrator.chunkFallbackDirect')
                    );
                    batchTranscript = await transcribeMacroPlanAsSmallerChunks({
                      plan,
                      mode,
                      provider,
                      settings,
                      onStageChange: handleProviderProgress,
                      context,
                    });
                    batchTranscriptAlreadyOffset = true;
                    lastError = null;
                    break;
                  }
                  throw error;
                }

                batchStatuses[plan.batchIndex - 1] = {
                  ...batchStatuses[plan.batchIndex - 1],
                  status: 'waiting',
                  detail: translateServiceMessage('orchestrator.chunkRetry', {
                    attempt: attemptIndex + 1,
                    maxRetries: BATCH_RETRY_DELAYS_MS.length,
                  }),
                };
                onProgress?.({
                  phase: 'transcribing',
                  stageLabel: translateServiceMessage('orchestrator.chunkRetry', {
                    attempt: attemptIndex + 1,
                    maxRetries: BATCH_RETRY_DELAYS_MS.length,
                  }),
                  progressCurrent: Math.max(0, plan.batchIndex - 1),
                  progressTotal: macroPlans.length,
                  progressLabel: translateServiceMessage('orchestrator.chunkProgress', {
                    completed: Math.max(0, plan.batchIndex - 1),
                    total: macroPlans.length,
                  }),
                  chunkStatuses: [...batchStatuses],
                });
                await sleep(retryDelayMs);
              }
            }

            if (!batchTranscript.trim()) {
              throw lastError instanceof Error
                ? lastError
                : new Error(translateServiceMessage('orchestrator.providerNoTranscript', {
                    provider: providerLabel,
                  }));
            }

            const persistedBatchTranscript =
              batchTranscriptAlreadyOffset
                ? batchTranscript
                : mode === ExtractionMode.TIMELINE
                ? normalizeTimelineTranscriptText(
                    offsetTimelineTranscript(batchTranscript, plan.startSeconds),
                    mode
                  )
                : batchTranscript;

            await appendTranscriptBatch({
              workspacePath,
              batch: {
                batchIndex: plan.batchIndex,
                startMs: Math.round(plan.startSeconds * 1000),
                endMs: Math.round(plan.endSeconds * 1000),
                text: persistedBatchTranscript,
              },
            });
            const cleanPersisted = persistedBatchTranscript.trim();
            if (cleanPersisted) {
              if (combinedTranscriptPreview.trim()) {
                combinedTranscriptPreview += '\n\n' + cleanPersisted;
              } else {
                combinedTranscriptPreview = cleanPersisted;
              }
            }

            await saveTranscriptBatchCheckpoint({
              workspacePath,
              checkpoint: {
                batchIndex: plan.batchIndex,
                microChunkIndexes: plan.chunkIndexes,
                startMs: Math.round(plan.startSeconds * 1000),
                endMs: Math.round(plan.endSeconds * 1000),
                uploadStatus: 'uploaded',
                transcribeStatus: 'done',
                saveStatus: 'saved',
                retryCount: checkpoint?.retryCount || 0,
                audioTempPath: null,
                textPath: null,
                errorMessage: null,
                updatedAt: new Date().toISOString(),
              },
            });

            batchStatuses[plan.batchIndex - 1] = {
              ...batchStatuses[plan.batchIndex - 1],
              status: 'done',
              detail: translateServiceMessage('orchestrator.chunkDone', {
                start: formatTimecode(plan.startSeconds),
                end: formatTimecode(plan.endSeconds),
              }),
            };

            await updateTranscriptProcessingJob(workspacePath, {
              currentBatch: plan.batchIndex,
            });
            await scheduleProcessingResume({
              jobId: job.id,
              workspacePath,
              delaySeconds: 60,
            });
            onProgress?.({
              phase: 'transcribing',
              stageLabel: translateServiceMessage('orchestrator.chunkCompleteMerging'),
              progressCurrent: plan.batchIndex,
              progressTotal: macroPlans.length,
              progressLabel: translateServiceMessage('orchestrator.chunkProgress', {
                completed: plan.batchIndex,
                total: macroPlans.length,
              }),
              transcriptPreview: combinedTranscriptPreview,
              completedBatchCount: plan.batchIndex,
              chunkStatuses: [...batchStatuses],
            });
          } catch (error) {
            const partialTranscriptText = await readCombinedTranscriptText(workspacePath);
            const partialBatches = await readTranscriptAppendOnlyBatches(workspacePath);
            await saveTranscriptBatchCheckpoint({
              workspacePath,
              checkpoint: {
                batchIndex: plan.batchIndex,
                microChunkIndexes: plan.chunkIndexes,
                startMs: Math.round(plan.startSeconds * 1000),
                endMs: Math.round(plan.endSeconds * 1000),
                uploadStatus: 'failed',
                transcribeStatus: 'failed',
                saveStatus: 'failed',
                retryCount: (checkpoint?.retryCount || 0) + 1,
                audioTempPath: null,
                textPath: null,
                errorMessage: error instanceof Error ? error.message : String(error),
                updatedAt: new Date().toISOString(),
              },
            });
            await updateTranscriptProcessingJob(workspacePath, {
              status: 'failed',
              totalBatches: macroPlans.length,
              currentBatch: Math.max(0, plan.batchIndex - 1),
            });

            const progressSummary = await summarizeTranscriptProcessingProgress(workspacePath);
            const recoveryError = error instanceof Error ? error : new Error(String(error));
            (
              recoveryError as Error & {
                recoveryDraft?: SessionAnalysis;
              }
            ).recoveryDraft = createDraftTranscriptAnalysis({
              transcriptText: partialTranscriptText,
              rawTitle,
              mode,
              source,
              context,
              workspacePath,
              jobId: job.id,
              processingJobStatus: 'failed',
              processingJobCurrentBatch: Math.max(0, plan.batchIndex - 1),
              processingJobTotalBatches: macroPlans.length,
              processingSavedBatchCount: progressSummary.savedBatchCount,
              processingFailedBatchCount: progressSummary.failedBatchCount,
              processingLastFailedBatchIndex: progressSummary.lastFailedBatchIndex,
              processingLastErrorMessage: progressSummary.lastErrorMessage,
              transcriptBatches: partialBatches,
              savedRecording,
              originalFileName: file.name,
            });
            throw recoveryError;
          }
        }

          transcriptText = await readCombinedTranscriptText(workspacePath);
          await updateTranscriptProcessingJob(workspacePath, {
            status: 'complete',
            currentBatch: macroPlans.length,
            totalBatches: macroPlans.length,
          });
          await cancelProcessingResume(job.id);
          await clearPendingProcessingResume(job.id);
        }
      } finally {
        await cleanupNativeAudioChunkTemps(microChunks);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        'recoveryDraft' in (error as Error & { recoveryDraft?: SessionAnalysis })
      ) {
        throw error;
      }
      logWarning('Macro batch transcription failed, fallback to legacy chunk transcription:', error);
      transcriptText = '';
    }
  }

  if (!transcriptText) {
    transcriptText =
      (await transcribeLongAudioIfNeeded({
        file,
        mode,
        provider,
        settings,
        onStageChange,
        onProgress,
      })) || '';
  }

  if (!transcriptText) {
    if (requiresAudioExtractionBeforeTranscription(file)) {
      throw new Error(
        translateServiceMessage('orchestrator.androidVideoPrepFailed')
      );
    }

    onProgress?.({
      phase: 'transcribing',
      stageLabel: translateServiceMessage('orchestrator.directTranscript', {
        provider: providerLabel,
      }),
      progressLabel: translateServiceMessage('orchestrator.directTranscriptShortFile'),
      chunkStatuses: [],
    });

    transcriptText = await transcribeWithProvider({
      provider,
      file,
      mode,
      assemblyaiApiKey: settings.assemblyaiApiKey,
      groqApiKey: settings.groqApiKey,
      openaiApiKey: settings.openaiApiKey,
      onStageChange: handleProviderProgress,
      settings,
      durationSeconds,
      context,
    });
  }

  if (!transcriptText) {
    throw new Error(
      translateServiceMessage('orchestrator.providerNoTranscript', {
        provider: providerLabel,
      })
    );
  }

  if (context === SessionContext.TRANSCRIPTION) {
    onProgress?.({
      phase: 'complete',
      stageLabel: translateServiceMessage('orchestrator.transcriptDone'),
      progressLabel: '100%',
      chunkStatuses: [],
    });
    onStageChange?.(translateServiceMessage('orchestrator.done'));
  }

  const finalProcessingJob = await loadTranscriptProcessingJob(workspacePath);
  const progressSummary = await summarizeTranscriptProcessingProgress(workspacePath);
  await cancelProcessingResume(job.id);
  await clearPendingProcessingResume(job.id);
  return createDraftTranscriptAnalysis({
    transcriptText,
    rawTitle,
    mode,
    source,
    context,
    workspacePath,
    jobId: job.id,
    processingJobStatus: 'complete',
    processingJobCurrentBatch: finalProcessingJob?.currentBatch || 0,
    processingJobTotalBatches: finalProcessingJob?.totalBatches || 0,
    processingSavedBatchCount: progressSummary.savedBatchCount,
    processingFailedBatchCount: progressSummary.failedBatchCount,
    processingLastFailedBatchIndex: progressSummary.lastFailedBatchIndex,
    processingLastErrorMessage: progressSummary.lastErrorMessage,
    transcriptBatches: await readTranscriptAppendOnlyBatches(workspacePath),
    savedRecording,
    originalFileName: file.name,
  });
};

export const analyzeSessionDraft = async ({
  draft,
  file,
  additionalFiles,
  onStageChange,
  onProgress,
}: AnalyzeDraftOptions): Promise<SessionAnalysis> => {
  const { mode, source, context, savedRecording } = draft;

  if (context === SessionContext.TRANSCRIPTION) {
    return {
      ...draft,
      analysisStatus: 'complete',
    };
  }

  const additionalExtractedTexts: Array<{ fileName: string; content: string }> = [];
  const additionalPdfFiles: File[] = [];

  if (additionalFiles && additionalFiles.length > 0) {
    onStageChange?.(translateServiceMessage('orchestrator.extractingAttachments'));
    onProgress?.({
      phase: 'preparing',
      stageLabel: translateServiceMessage('orchestrator.extractingAttachments'),
      progressLabel: translateServiceMessage('orchestrator.readingSupportingFiles'),
      chunkStatuses: [],
    });

    for (const addFile of additionalFiles) {
      if (isPdfFile(addFile)) {
        additionalPdfFiles.push(addFile);
      } else if (isClientSideExtractable(addFile)) {
        try {
          const content = await extractTextFromFile(addFile);
          if (content.trim()) {
            additionalExtractedTexts.push({ fileName: addFile.name, content });
          }
        } catch (err) {
          logWarning(
            translateServiceMessage('orchestrator.extractingAttachmentFailed', {
              fileName: addFile.name,
            }),
            err
          );
        }
      }
    }
  }

  const analysisLabel =
    context === SessionContext.INTERVIEW
      ? translateServiceMessage('orchestrator.geminiInterviewAnalysis')
      : translateServiceMessage('orchestrator.geminiMeetingAnalysis');
  const analysisProgress =
    context === SessionContext.INTERVIEW
      ? translateServiceMessage('orchestrator.geminiInterviewProgress')
      : translateServiceMessage('orchestrator.geminiMeetingProgress');

  onProgress?.({
    phase: 'analyzing',
    stageLabel: analysisLabel,
    progressLabel: analysisProgress,
    chunkStatuses: [],
  });
  onStageChange?.(analysisLabel);

  const analyzed = await withTimeout(
    analyzeTranscriptWithGemini({
      transcriptText: draft.artifacts.transcript,
      file,
      fallbackFileName: draft.originalFileName || draft.title,
      mode,
      source,
      context,
      savedRecording,
      additionalExtractedTexts,
      additionalPdfFiles,
    }),
    ANALYSIS_TIMEOUT_MS,
    translateServiceMessage('orchestrator.geminiAnalysisTimeout')
  );

  return {
    ...analyzed,
    analysisStatus: 'complete',
    createdAt: draft.createdAt || analyzed.createdAt,
    workspacePath: draft.workspacePath || analyzed.workspacePath,
    originalFileName: draft.originalFileName || analyzed.originalFileName,
    processingJobId: draft.processingJobId || analyzed.processingJobId,
    processingJobStatus: draft.processingJobStatus || analyzed.processingJobStatus,
    transcriptBatches: draft.transcriptBatches || analyzed.transcriptBatches,
  };
};
