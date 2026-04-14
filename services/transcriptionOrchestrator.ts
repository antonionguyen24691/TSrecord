/**
 * transcriptionOrchestrator.ts
 * Bộ điều phối Two-Step Hybrid Pipeline:
 *
 * BƯỚC 1 (STT): Chọn provider dựa trên cài đặt user:
 *   - gemini:     Gửi file audio thẳng lên Gemini Multimodal (mặc định)
 *   - assemblyai: Upload → Poll → Transcript (333h free)
 *   - groq:       Whisper siêu tốc, giới hạn 25MB
 *   - openai:     Whisper chuẩn, giới hạn 25MB, pay-as-you-go
 *
 * BƯỚC 2 (Phân tích): Luôn dùng Gemini để sinh Summary/Mindmap/etc.
 *   - Input: Transcript text từ Bước 1
 *   - Output: SessionAnalysis đầy đủ
 */

import { ExtractionMode, InputSource, SessionAnalysis, SessionContext, SavedDeviceFile } from '../types';
import { loadAiSettings, TranscriptionProvider } from './aiSettingsService';
import {
  canSplitFileIntoAudioChunks,
  getMediaDurationSeconds,
  splitAudioFileIntoChunks,
} from './audioChunkService';
import {
  analyzeTranscriptWithGemini,
  transcribeAudioWithGemini,
} from './geminiService';
import { transcribeWithAssemblyAI } from './assemblyaiService';
import { transcribeWithGroq } from './groqService';
import { transcribeWithOpenAI } from './openaiService';

export interface OrchestratorOptions {
  file: File;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  savedRecording?: SavedDeviceFile | null;
  onStageChange?: (stage: string) => void;
}

const PROVIDER_LABELS: Record<TranscriptionProvider, string> = {
  gemini: 'Google Gemini',
  assemblyai: 'AssemblyAI',
  groq: 'Groq Whisper',
  openai: 'OpenAI Whisper',
};

const MAX_TRANSCRIPTION_CHUNK_SECONDS = 10 * 60;

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

const transcribeChunkWithProvider = async ({
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
  if (provider === 'gemini') {
    return transcribeAudioWithGemini({ file, mode });
  }
  if (provider === 'assemblyai') {
    return transcribeWithAssemblyAI(file, assemblyaiApiKey, onStageChange);
  }
  if (provider === 'groq') {
    return transcribeWithGroq(file, groqApiKey, onStageChange);
  }
  return transcribeWithOpenAI(file, openaiApiKey, onStageChange);
};

const transcribeLongAudioIfNeeded = async ({
  file,
  mode,
  provider,
  settings,
  onStageChange,
}: {
  file: File;
  mode: ExtractionMode;
  provider: TranscriptionProvider;
  settings: Awaited<ReturnType<typeof loadAiSettings>>;
  onStageChange?: (stage: string) => void;
}) => {
  if (!canSplitFileIntoAudioChunks(file)) return null;

  let durationSeconds = 0;
  try {
    durationSeconds = await getMediaDurationSeconds(file);
  } catch {
    return null;
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds <= MAX_TRANSCRIPTION_CHUNK_SECONDS) {
    return null;
  }

  onStageChange?.(
    `File dài ${Math.ceil(durationSeconds / 60)} phút. Hệ thống đang chia thành các phần ~10 phút để transcript ổn định hơn...`
  );

  try {
    const chunks = await splitAudioFileIntoChunks({
      file,
      chunkDurationSeconds: MAX_TRANSCRIPTION_CHUNK_SECONDS,
    });

    const transcripts: Array<{ text: string; startSeconds: number }> = [];
    for (const chunk of chunks) {
      onStageChange?.(
        `Đang transcript phần ${chunk.index + 1}/${chunk.total} (${formatTimecode(
          chunk.startSeconds
        )} - ${formatTimecode(chunk.endSeconds)})...`
      );

      const text = await transcribeChunkWithProvider({
        provider,
        file: chunk.file,
        mode,
        assemblyaiApiKey: settings.assemblyaiApiKey,
        groqApiKey: settings.groqApiKey,
        openaiApiKey: settings.openaiApiKey,
        onStageChange,
      });

      transcripts.push({
        text,
        startSeconds: chunk.startSeconds,
      });
    }

    return mergeChunkTranscripts(transcripts, mode);
  } catch (error) {
    console.warn('Chunked transcription fallback to original file:', error);
    return null;
  }
};

/**
 * Entry point chính thay thế cho processMediaSession trực tiếp.
 * Tự chọn pipeline dựa trên cài đặt transcriptionProvider.
 */
export const processWithOrchestrator = async (
  options: OrchestratorOptions
): Promise<SessionAnalysis> => {
  const { file, mode, source, context, savedRecording, onStageChange } = options;
  const settings = await loadAiSettings();
  const provider = settings.transcriptionProvider;

  // Gemini: transcript trước, phân tích sau để giảm hallucination
  if (provider === 'gemini') {
    const chunkedTranscript = await transcribeLongAudioIfNeeded({
      file,
      mode,
      provider,
      settings,
      onStageChange,
    });
    onStageChange?.('Gemini đang transcript audio...');
    const transcriptText = chunkedTranscript || (await transcribeAudioWithGemini({ file, mode }));

    if (!transcriptText) {
      throw new Error('Gemini khong tra ve transcript. Vui long thu lai.');
    }

    if (context !== SessionContext.MEETING) {
      onStageChange?.('Hoan tat!');
      return {
        title: file.name.replace(/\.[^.]+$/, '') || 'Transcript',
        mode,
        source,
        context,
        suggestedFolderName: file.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '-') || 'transcript',
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

    onStageChange?.('Gemini dang phan tich transcript cuoc hop...');
    return analyzeTranscriptWithGemini({
      transcriptText,
      file,
      mode,
      source,
      context,
      savedRecording,
    });
  }

  // Providers khác: Two-Step Pipeline
  let transcriptText = '';

  // ── BƯỚC 1: Lấy Transcript ──────────────────────────────────────────────
  const providerLabel = PROVIDER_LABELS[provider];

  const handleProgress = (status: string) => {
    const statusMap: Record<string, string> = {
      uploading: `Đang upload lên ${providerLabel}...`,
      queued: `File đang trong hàng đợi ${providerLabel}...`,
      processing: `${providerLabel} đang nhận diện giọng nói...`,
      completed: `Đã hoàn tất nhận diện giọng nói.`,
    };
    onStageChange?.(statusMap[status] || `${providerLabel}: ${status}`);
  };

  transcriptText =
    (await transcribeLongAudioIfNeeded({
      file,
      mode,
      provider,
      settings,
      onStageChange,
    })) || '';

  if (!transcriptText) {
    if (provider === 'assemblyai') {
      transcriptText = await transcribeWithAssemblyAI(
        file,
        settings.assemblyaiApiKey,
        handleProgress
      );
    } else if (provider === 'groq') {
      transcriptText = await transcribeWithGroq(file, settings.groqApiKey, handleProgress);
    } else if (provider === 'openai') {
      transcriptText = await transcribeWithOpenAI(file, settings.openaiApiKey, handleProgress);
    }
  }

  if (!transcriptText) {
    throw new Error(`${providerLabel} không trả về transcript. Vui lòng thử lại.`);
  }

  // ── BƯỚC 2: Phân tích bằng Gemini ───────────────────────────────────────
  // Chỉ ở mode MEETING mới cần phân tích sâu. TRANSCRIPTION/INTERVIEW dừng ở đây.
  if (context !== SessionContext.MEETING) {
    onStageChange?.('Hoàn tất!');
    return {
      title: file.name.replace(/\.[^.]+$/, '') || 'Transcript',
      mode,
      source,
      context,
      suggestedFolderName: file.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '-') || 'transcript',
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

  onStageChange?.('Gemini đang phân tích nội dung họp...');
  return analyzeTranscriptWithGemini({
    transcriptText,
    file,
    mode,
    source,
    context,
    savedRecording,
  });
};
