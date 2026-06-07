/**
 * groqService.ts
 * Xử lý Speech-to-Text qua Groq Whisper (whisper-large-v3-turbo).
 * Tốc độ cực nhanh (hơn real-time). Giới hạn file: 25MB.
 * Free tier: có giới hạn RPM/RPD nhưng dùng cá nhân vẫn ổn.
 */

import { ExtractionMode } from '../types';
import {
  getSpeechRecognitionLanguage,
  translateServiceMessage,
} from './utils/serviceMessages';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const MAX_FILE_SIZE_MB = 25;

/**
 * Transcribe audio qua Groq Whisper API.
 * Model: whisper-large-v3-turbo (nhanh nhất) hoặc whisper-large-v3 (chính xác hơn).
 */
export const transcribeWithGroq = async (
  file: File,
  apiKey: string,
  onProgress?: (status: string) => void,
  mode: ExtractionMode = ExtractionMode.TIMELINE
): Promise<string> => {
  if (!apiKey) {
    throw new Error(translateServiceMessage('providers.groq.missingApiKey'));
  }

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(
      translateServiceMessage('providers.groq.fileTooLarge', {
        size: fileSizeMB.toFixed(1),
        limit: MAX_FILE_SIZE_MB,
      })
    );
  }

  onProgress?.('processing');

  const formData = new FormData();
  formData.append('file', file, file.name || 'audio.webm');
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');
  // Groq Whisper hỗ trợ tiếng Việt tốt
  formData.append('language', getSpeechRecognitionLanguage());

  const response = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.text();
    let errMsg = `Groq Whisper lỗi (${response.status})`;
    try {
      const errJson = JSON.parse(errBody);
      errMsg = errJson?.error?.message || errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = await response.json();

  // verbose_json trả về segments với timestamps
  if (data.segments && data.segments.length > 0) {
    const segments = data.segments as Array<{ start: number; text: string }>;

    if (mode === ExtractionMode.PLAIN) {
      return segments.map((seg) => seg.text.trim()).filter(Boolean).join(' ');
    }

    return segments
      .map((seg) => {
        const totalSecs = Math.floor(seg.start);
        const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSecs % 60).toString().padStart(2, '0');
        return `[${h}:${m}:${s}] ${seg.text.trim()}`;
      })
      .join('\n');
  }

  return (data.text as string) || '';
};
