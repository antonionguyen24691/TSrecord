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
  processMediaSession,
  analyzeTranscriptWithGemini,
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

  // Gemini: dùng pipeline gốc (Bước 1 + 2 trong 1 lần gọi)
  if (provider === 'gemini') {
    onStageChange?.(`Đang xử lý bằng ${PROVIDER_LABELS.gemini}...`);
    return processMediaSession({ file, mode, source, context, savedRecording });
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
