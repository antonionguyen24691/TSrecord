import { Capacitor } from '@capacitor/core';
import { ExtractionMode, InputSource, SessionAnalysis, SessionContext, SavedDeviceFile } from '../types';
import { loadAiSettings, TranscriptionProvider } from './aiSettingsService';
import {
  canSplitFileIntoAudioChunks,
  getMediaDurationSeconds,
  splitAudioFileIntoChunks,
} from './audioChunkService';
import { analyzeTranscriptWithGemini, transcribeAudioWithGemini } from './geminiService';
import { transcribeWithAssemblyAI } from './assemblyaiService';
import { transcribeWithGroq } from './groqService';
import { transcribeWithOpenAI } from './openaiService';
import { logWarning } from './utils/logging';
import { withTimeout } from './utils/timeout';
import { extractTextFromFile, isClientSideExtractable, isPdfFile } from './utils/fileExtractor';

export interface OrchestratorProgress {
  stageLabel?: string;
  phase?: 'preparing' | 'transcribing' | 'analyzing' | 'saving' | 'complete';
  progressCurrent?: number;
  progressTotal?: number;
  progressLabel?: string;
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
    `${PROVIDER_LABELS[provider]} xu ly transcript qua lau. Vui long thu lai hoac chon provider khac.`
  );

const transcribeWithProvider = async ({
  provider,
  file,
  mode,
  assemblyaiApiKey,
  groqApiKey,
  openaiApiKey,
  onStageChange,
}: {
  provider: TranscriptionProvider;
  file: File;
  mode: ExtractionMode;
  assemblyaiApiKey: string;
  groqApiKey: string;
  openaiApiKey: string;
  onStageChange?: (stage: string) => void;
}) => {
  let transcriptPromise: Promise<string>;

  if (provider === 'gemini') {
    transcriptPromise = transcribeAudioWithGemini({ file, mode });
  } else if (provider === 'assemblyai') {
    transcriptPromise = transcribeWithAssemblyAI(file, assemblyaiApiKey, onStageChange);
  } else if (provider === 'groq') {
    transcriptPromise = transcribeWithGroq(file, groqApiKey, onStageChange, mode);
  } else {
    transcriptPromise = transcribeWithOpenAI(file, openaiApiKey, onStageChange, mode);
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
}: {
  file: File;
  mode: ExtractionMode;
  provider: TranscriptionProvider;
  settings: Awaited<ReturnType<typeof loadAiSettings>>;
  onStageChange?: (stage: string) => void;
  onProgress?: (progress: OrchestratorProgress) => void;
}) => {
  if (!canSplitFileIntoAudioChunks(file)) return null;

  let durationSeconds: number;
  try {
    durationSeconds = await getMediaDurationSeconds(file);
  } catch {
    return null;
  }

  const chunkDurationSeconds = settings.chunkDurationMinutes * 60;
  const shouldForcePreparedAudio = requiresAudioExtractionBeforeTranscription(file);
  if (
    !shouldForcePreparedAudio &&
    (!Number.isFinite(durationSeconds) || durationSeconds <= chunkDurationSeconds)
  ) {
    return null;
  }

  onProgress?.({
    phase: 'preparing',
    stageLabel: `Chuẩn bị chia file dài cho ${PROVIDER_LABELS[provider]}...`,
    progressLabel: 'Đọc metadata và cắt audio gần điểm im lặng',
    chunkStatuses: [],
  });
  onStageChange?.(
    `File dài ${Math.ceil(durationSeconds / 60)} phút. Đang chia thành các phần ~${settings.chunkDurationMinutes} phút để tránh lỗi 503...`
  );

  try {
    const chunks = await splitAudioFileIntoChunks({
      file,
      chunkDurationSeconds,
    });

    const chunkStatuses: NonNullable<OrchestratorProgress['chunkStatuses']> = chunks.map((chunk) => ({
      id: `chunk-${chunk.index + 1}`,
      label: `Phần ${chunk.index + 1}/${chunk.total}`,
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
        progressLabel: `${completedCount}/${chunks.length} phần hoàn tất`,
        chunkStatuses: [...chunkStatuses],
      });
    };

    syncProgress(
      `Đã cắt thành ${chunks.length} phần, transcript tối đa ${safeConcurrency} luồng song song...`
    );

    const transcripts = await runWithConcurrency(
      chunks.map((chunk) => async () => {
        const dispatchOrder = dispatchCounter++;
        const staggerDelayMs = dispatchOrder * settings.chunkStaggerSeconds * 1000;
        if (staggerDelayMs > 0) {
          chunkStatuses[chunk.index] = {
            ...chunkStatuses[chunk.index],
            status: 'waiting',
            detail: `Chờ ${Math.round(staggerDelayMs / 1000)}s trước khi gửi`,
          };
          syncProgress();
          await sleep(staggerDelayMs);
        }

        chunkStatuses[chunk.index] = {
          ...chunkStatuses[chunk.index],
          status: 'processing',
          detail: `${formatTimecode(chunk.startSeconds)} - ${formatTimecode(chunk.endSeconds)}`,
        };
        syncProgress(
          `Đang xử lý ${chunk.index + 1}/${chunk.total} với tối đa ${safeConcurrency} luồng...`
        );
        onStageChange?.(
          `Khởi động phần ${chunk.index + 1}/${chunk.total} (${formatTimecode(
            chunk.startSeconds
          )} - ${formatTimecode(chunk.endSeconds)})...`
        );

        try {
          const text = await transcribeWithProvider({
            provider,
            file: chunk.file,
            mode,
            assemblyaiApiKey: settings.assemblyaiApiKey,
            groqApiKey: settings.groqApiKey,
            openaiApiKey: settings.openaiApiKey,
            onStageChange: (status: string) =>
              onStageChange?.(`Phần ${chunk.index + 1}/${chunk.total}: ${status}`),
          });

          completedCount += 1;
          chunkStatuses[chunk.index] = {
            ...chunkStatuses[chunk.index],
            status: 'done',
            detail: `Xong đoạn ${formatTimecode(chunk.startSeconds)} - ${formatTimecode(chunk.endSeconds)}`,
          };
          syncProgress();

          return {
            index: chunk.index,
            text,
            startSeconds: chunk.startSeconds,
          };
        } catch (error) {
          chunkStatuses[chunk.index] = {
            ...chunkStatuses[chunk.index],
            status: 'error',
            detail: 'Chunk transcript lỗi',
          };
          syncProgress();
          throw error;
        }
      }),
      safeConcurrency
    );

    onProgress?.({
      phase: 'transcribing',
      stageLabel: 'Đã transcript xong tất cả các phần, đang ghép transcript cuối...',
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
      stageLabel: 'Chunking gặp lỗi, hệ thống sẽ fallback về transcript trực tiếp...',
      chunkStatuses: [],
    });
    return null;
  }
};

export const processWithOrchestrator = async (
  options: OrchestratorOptions
): Promise<SessionAnalysis> => {
  const { file, mode, source, context, savedRecording, additionalFiles, onStageChange, onProgress } = options;
  const settings = await loadAiSettings();
  const provider = settings.transcriptionProvider;
  const providerLabel = PROVIDER_LABELS[provider];

  onProgress?.({
    phase: 'preparing',
    stageLabel: 'Đang chuẩn bị pipeline xử lý audio...',
    progressLabel: `Provider hiện tại: ${providerLabel}`,
    chunkStatuses: [],
  });

  const handleProviderProgress = (status: string) => {
    const statusMap: Record<string, string> = {
      uploading: `Đang upload lên ${providerLabel}...`,
      queued: `File đang trong hàng đợi ${providerLabel}...`,
      processing: `${providerLabel} đang nhận diện giọng nói...`,
      completed: `Đã hoàn tất nhận diện giọng nói.`,
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
    })) || '';

  if (!transcriptText) {
    if (requiresAudioExtractionBeforeTranscription(file)) {
      throw new Error(
        'Video này cần tách audio track trước khi transcript trên Android, nhưng bước chuẩn bị audio đã thất bại.'
      );
    }

    onProgress?.({
      phase: 'transcribing',
      stageLabel: `${providerLabel} đang transcript trực tiếp từ file upload...`,
      progressLabel: 'File ngắn nên đi theo luồng trực tiếp',
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
    });
  }

  if (!transcriptText) {
    throw new Error(`${providerLabel} không trả về transcript. Vui lòng thử lại.`);
  }

  if (context === SessionContext.TRANSCRIPTION) {
    onProgress?.({
      phase: 'complete',
      stageLabel: 'Hoàn tất transcript.',
      progressLabel: '100%',
      chunkStatuses: [],
    });
    onStageChange?.('Hoàn tất!');

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
    onStageChange?.('Đang trích xuất nội dung tài liệu đính kèm...');
    onProgress?.({
      phase: 'preparing',
      stageLabel: 'Đang trích xuất nội dung tài liệu đính kèm...',
      progressLabel: 'Đọc file bổ trợ',
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
          logWarning(`Lỗi khi trích xuất tài liệu ${addFile.name}:`, err);
        }
      }
    }
  }

  const analysisLabel =
    context === SessionContext.INTERVIEW
      ? 'Gemini đang tạo title và hoàn thiện transcript phỏng vấn...'
      : 'Gemini đang phân tích nội dung họp...';
  const analysisProgress =
    context === SessionContext.INTERVIEW
      ? 'Tạo title và chuẩn hóa transcript phỏng vấn'
      : 'Tạo summary, decisions, risks, folder tree, mindmap';

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
    'Gemini phan tich noi dung qua lau. Vui long thu lai.'
  );
};
