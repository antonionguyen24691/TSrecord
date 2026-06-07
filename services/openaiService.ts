/**
 * openaiService.ts
 * Xử lý Speech-to-Text qua OpenAI Whisper API.
 * Giới hạn file: 25MB. Chi phí: $0.006/phút audio.
 * Không có free tier — cần nạp tiền tài khoản.
 */

import { ExtractionMode } from '../types';
import {
  getSpeechRecognitionLanguage,
  translateServiceMessage,
} from './utils/serviceMessages';

const OPENAI_BASE = 'https://api.openai.com/v1';
const MAX_FILE_SIZE_MB = 25;

/** Transcribe audio qua OpenAI Whisper-1. */
export const transcribeWithOpenAI = async (
  file: File,
  apiKey: string,
  onProgress?: (status: string) => void,
  mode: ExtractionMode = ExtractionMode.TIMELINE
): Promise<string> => {
  if (!apiKey) {
    throw new Error(translateServiceMessage('providers.openai.missingApiKey'));
  }

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(
      translateServiceMessage('providers.openai.fileTooLarge', {
        size: fileSizeMB.toFixed(1),
        limit: MAX_FILE_SIZE_MB,
      })
    );
  }

  onProgress?.('processing');

  const formData = new FormData();
  formData.append('file', file, file.name || 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');
  formData.append('language', getSpeechRecognitionLanguage());

  const response = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.text();
    let errMsg = `OpenAI Whisper lỗi (${response.status})`;
    try {
      const errJson = JSON.parse(errBody);
      errMsg = errJson?.error?.message || errMsg;
    } catch {
      // ignore
    }

    if (response.status === 401) {
      errMsg = translateServiceMessage('providers.openai.invalidApiKey');
    } else if (response.status === 402) {
      errMsg = translateServiceMessage('providers.openai.outOfCredit');
    }

    throw new Error(errMsg);
  }

  const data = await response.json();

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
