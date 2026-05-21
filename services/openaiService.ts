/**
 * openaiService.ts
 * Xử lý Speech-to-Text qua OpenAI Whisper API.
 * Giới hạn file: 25MB. Chi phí: $0.006/phút audio.
 * Không có free tier — cần nạp tiền tài khoản.
 */

import { ExtractionMode } from '../types';

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
    throw new Error('Chưa cấu hình OpenAI API Key. Vui lòng vào Cài đặt để nhập key.');
  }

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(
      `File của bạn (${fileSizeMB.toFixed(1)}MB) vượt quá giới hạn 25MB của OpenAI Whisper. ` +
        `Vui lòng dùng Google Gemini hoặc AssemblyAI cho file lớn hơn.`
    );
  }

  onProgress?.('processing');

  const formData = new FormData();
  formData.append('file', file, file.name || 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');
  formData.append('language', 'vi');

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
      errMsg = 'OpenAI API Key không hợp lệ hoặc đã hết hạn.';
    } else if (response.status === 402) {
      errMsg = 'Tài khoản OpenAI hết tín dụng. Vui lòng nạp thêm tiền.';
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
