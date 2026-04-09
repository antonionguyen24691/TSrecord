/**
 * assemblyaiService.ts
 * Xử lý Speech-to-Text qua AssemblyAI Universal-2/3 API.
 * Luồng: Upload file → Submit job → Poll đến Done → Trả Transcript.
 * Free tier: $50 credit ≈ 333 giờ audio.
 */

const ASSEMBLYAI_BASE = 'https://api.assemblyai.com/v2';

export interface AssemblyAITranscriptResult {
  transcript: string;
  words?: Array<{ text: string; start: number; end: number; speaker?: string }>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Upload raw audio bytes lên AssemblyAI, trả về upload_url */
const uploadAudio = async (file: File, apiKey: string): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();

  const response = await fetch(`${ASSEMBLYAI_BASE}/upload`, {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'content-type': 'application/octet-stream',
      'transfer-encoding': 'chunked',
    },
    body: arrayBuffer,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AssemblyAI upload thất bại (${response.status}): ${body}`);
  }

  const data = await response.json();
  if (!data.upload_url) throw new Error('AssemblyAI không trả về upload_url.');
  return data.upload_url as string;
};

/** Gửi job transcription, trả về transcript_id */
const submitTranscription = async (
  uploadUrl: string,
  apiKey: string,
  options: { speakerDiarization?: boolean; languageCode?: string } = {}
): Promise<string> => {
  const body: Record<string, unknown> = {
    audio_url: uploadUrl,
    language_detection: true, // Tự detect tiếng Việt / tiếng Anh
    speaker_labels: options.speakerDiarization ?? true,
  };

  if (options.languageCode) {
    body.language_code = options.languageCode;
    body.language_detection = false;
  }

  const response = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`AssemblyAI submit job thất bại (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  if (!data.id) throw new Error('AssemblyAI không trả về transcript ID.');
  return data.id as string;
};

/** Poll trạng thái job đến khi completed hoặc error, tối đa 10 phút */
const pollTranscription = async (
  transcriptId: string,
  apiKey: string,
  onProgress?: (status: string) => void
): Promise<AssemblyAITranscriptResult> => {
  const maxAttempts = 120; // 120 × 5s = 10 phút
  const pollInterval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await delay(pollInterval);

    const response = await fetch(`${ASSEMBLYAI_BASE}/transcript/${transcriptId}`, {
      headers: { authorization: apiKey },
    });

    if (!response.ok) {
      throw new Error(`AssemblyAI poll thất bại (${response.status})`);
    }

    const data = await response.json();
    const status: string = data.status;

    onProgress?.(status);

    if (status === 'completed') {
      // Nếu có speaker diarization, build transcript có speaker label
      let transcriptText: string = data.text || '';

      if (data.utterances && data.utterances.length > 0) {
        transcriptText = (data.utterances as Array<{ speaker: string; text: string }>)
          .map((u) => `[Speaker ${u.speaker}] ${u.text}`)
          .join('\n\n');
      }

      return {
        transcript: transcriptText,
        words: data.words,
      };
    }

    if (status === 'error') {
      throw new Error(`AssemblyAI xử lý lỗi: ${data.error || 'Không rõ lỗi'}`);
    }

    // status: 'queued' | 'processing' — tiếp tục poll
  }

  throw new Error('AssemblyAI quá thời gian chờ (10 phút). Vui lòng thử lại với file nhỏ hơn.');
};

/**
 * Hàm public: Nhận file + API key → trả về transcript text.
 * @param onProgress Callback nhận chuỗi status: 'uploading' | 'queued' | 'processing' | 'completed'
 */
export const transcribeWithAssemblyAI = async (
  file: File,
  apiKey: string,
  onProgress?: (status: string) => void
): Promise<string> => {
  if (!apiKey) {
    throw new Error('Chưa cấu hình AssemblyAI API Key. Vui lòng vào Cài đặt để nhập key.');
  }

  onProgress?.('uploading');
  const uploadUrl = await uploadAudio(file, apiKey);

  onProgress?.('queued');
  const transcriptId = await submitTranscription(uploadUrl, apiKey, {
    speakerDiarization: true,
  });

  const result = await pollTranscription(transcriptId, apiKey, onProgress);
  return result.transcript;
};
