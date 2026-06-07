import { GoogleGenAI } from '@google/genai';
import {
  ExtractionMode,
  InputSource,
  SavedDeviceFile,
  SessionAnalysis,
  SessionContext,
} from '../types';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  DEFAULT_MODEL_ID,
  DEFAULT_REALTIME_MODEL_ID,
  loadAiSettings,
  getDeviceId,
} from './aiSettingsService';
import type { RealtimeMode } from './aiSettingsService';
import { createGeminiUserError } from './utils/geminiError';
import { logError, logWarning } from './utils/logging';
import {
  getAiOutputLanguageInstruction,
  getSpeechRecognitionLanguage,
  translateServiceMessage,
} from './utils/serviceMessages';
import { fileToBase64 } from './utils/audioUtils';


const MAX_FILE_SIZE_MB = 300;
const INLINE_DATA_THRESHOLD_MB = 8;
const TEMPERATURE_TRANSCRIPT = 0.1;
const TEMPERATURE_ANALYSIS = 0.3;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const RETRYABLE_STATUS_PATTERNS = /\b(429|500|502|503|504|unavailable|overloaded|resource_exhausted|too many requests|internal|deadline)\b/i;

type RetryableGeminiError = Error & {
  retryAfterMs?: number;
};

const sessionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    suggestedFolderName: { type: 'string' },
    transcript: { type: 'string' },
    summary: { type: 'string' },
    decisions: { type: 'string' },
    risks: { type: 'string' },
    folderTree: { type: 'string' },
    mindmap: { type: 'string' },
    actionItems: { type: 'string' },
  },
  required: [
    'title',
    'suggestedFolderName',
    'transcript',
    'summary',
    'decisions',
    'risks',
    'folderTree',
    'mindmap',
    'actionItems',
  ],
} as const;

const liveMeetingChunkSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    transcriptChunk: { type: 'string' },
    rollingSummary: { type: 'string' },
    decisions: { type: 'string' },
    risks: { type: 'string' },
    actionItems: { type: 'string' },
  },
  required: ['transcriptChunk', 'rollingSummary', 'decisions', 'risks', 'actionItems'],
} as const;

const liveMeetingChunkHybridSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    transcriptChunk: { type: 'string' },
    rollingSummary: { type: 'string' },
  },
  required: ['transcriptChunk', 'rollingSummary'],
} as const;

export interface LiveMeetingChunkAnalysis {
  transcriptChunk: string;
  rollingSummary: string;
  decisions: string;
  risks: string;
  actionItems: string;
}

const isRetryableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_STATUS_PATTERNS.test(message);
};

const getRetryDelayMs = (error: unknown, attempt: number) => {
  const retryAfterMs =
    error instanceof Error
      ? (error as RetryableGeminiError).retryAfterMs
      : undefined;
  if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.min(retryAfterMs, 120000);
  }
  return RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
};

const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= MAX_RETRIES || !isRetryableError(error)) {
        throw error;
      }

      const delayMs = getRetryDelayMs(error, attempt);
      logWarning(
        `${context}: Retry ${attempt + 1}/${MAX_RETRIES} sau ${delayMs}ms`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};

const retryRestWithBackoff = async <T>(
  fn: () => Promise<T>,
  context: string
) => retryWithBackoff(fn, `${context}:rest`);

const fetchGeminiRestWithBackoff = async (
  input: RequestInfo | URL,
  init: RequestInit,
  context: string
) =>
  retryRestWithBackoff(async () => {
    const response = await fetch(input, init);
    if (
      !response.ok &&
      RETRYABLE_STATUS_PATTERNS.test(
        `${response.status} ${response.statusText || ''}`
      )
    ) {
      const bodyText = await response.text();
      const error = new Error(
        `Gemini REST error (${response.status}): ${bodyText}`
      ) as RetryableGeminiError;
      error.retryAfterMs = parseGeminiRetryDelayMs(response, bodyText);
      throw error;
    }
    return response;
  }, context);

const parseGeminiRetryDelayMs = (response: Response, bodyText: string) => {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const asSeconds = Number(retryAfter);
    if (Number.isFinite(asSeconds) && asSeconds > 0) {
      return asSeconds * 1000;
    }

    const asDate = Date.parse(retryAfter);
    if (Number.isFinite(asDate)) {
      return Math.max(0, asDate - Date.now());
    }
  }

  const retryDelayMatch = bodyText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (retryDelayMatch) {
    return Number(retryDelayMatch[1]) * 1000;
  }

  return undefined;
};

// fileToBase64 is imported from audioUtils


const fileToGenerativePart = async (
  file: File,
  ai?: GoogleGenAI
): Promise<Record<string, unknown>> => {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(
      translateServiceMessage('gemini.general.fileTooLargeForUpload', {
        limit: MAX_FILE_SIZE_MB,
      })
    );
  }

  const fileSizeMB = file.size / (1024 * 1024);

  if (ai && fileSizeMB > INLINE_DATA_THRESHOLD_MB) {
    try {
      const uploaded = await ai.files.upload({
        file,
        config: { mimeType: file.type || 'audio/webm' },
      });

      if (uploaded.uri && uploaded.name) {
        // Poll for file to become active
        let fileInfo = await ai.files.get({ name: uploaded.name });
        while (fileInfo.state === 'PROCESSING') {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          fileInfo = await ai.files.get({ name: uploaded.name });
        }
        if (fileInfo.state !== 'ACTIVE') {
          throw new Error(`File upload processing failed with state: ${fileInfo.state}`);
        }

        return {
          fileData: {
            fileUri: uploaded.uri,
            mimeType: uploaded.mimeType || file.type || 'audio/webm',
          },
        };
      }
    } catch (uploadError) {
      if (fileSizeMB > INLINE_DATA_THRESHOLD_MB) {
        logWarning('Gemini Files API upload failed for a large file; switching to REST upload fallback:', uploadError);
        throw uploadError;
      }
      logWarning('Gemini Files API upload failed, falling back to inline data:', uploadError);
    }
  }

  return {
    inlineData: {
      data: await fileToBase64(file),
      mimeType: file.type || 'audio/webm',
    },
  };
};

const getFallbackTitle = (fileName: string) => {
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return baseName || 'Phien ghi am';
};

const sanitizeJsonText = (value: string) =>
  value
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

const normalizeGenerationConfigForRest = (config: Record<string, unknown>) => {
  const { responseJsonSchema, ...rest } = config;
  return responseJsonSchema
    ? {
        ...rest,
        responseSchema: responseJsonSchema,
      }
    : rest;
};

const extractRestCandidateText = (responseBody: any) =>
  responseBody?.candidates?.[0]?.content?.parts
    ?.map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim() || '';

const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const tokenizeForRelevance = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4);

const relevanceRatio = (candidate: string, sources: string[]) => {
  const candidateTokens = tokenizeForRelevance(candidate);
  if (candidateTokens.length === 0) return 0;

  const sourceTokens = new Set(tokenizeForRelevance(sources.join(' ')));
  if (sourceTokens.size === 0) return 0;

  const overlap = candidateTokens.filter((token) => sourceTokens.has(token)).length;
  return overlap / candidateTokens.length;
};

const containsStructuralSignal = (value: string) =>
  /(api|module|he thong|quy trinh|kien truc|folder|thu muc|mindmap|workflow|pipeline|service|database|schema|frontend|backend|deployment|release|feature)/i.test(
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

const sanitizeMeetingArtifacts = (artifacts: SessionAnalysis['artifacts']) => {
  const evidenceBase = [artifacts.transcript, artifacts.summary];
  const structuralAllowed =
    containsStructuralSignal(artifacts.transcript) || containsStructuralSignal(artifacts.summary);

  return {
    ...artifacts,
    decisions: relevanceRatio(artifacts.decisions, evidenceBase) >= 0.15 ? artifacts.decisions : '',
    risks: relevanceRatio(artifacts.risks, evidenceBase) >= 0.15 ? artifacts.risks : '',
    actionItems:
      relevanceRatio(artifacts.actionItems, evidenceBase) >= 0.15 ? artifacts.actionItems : '',
    folderTree:
      structuralAllowed && relevanceRatio(artifacts.folderTree, evidenceBase) >= 0.15
        ? artifacts.folderTree
        : '',
    mindmap:
      structuralAllowed && relevanceRatio(artifacts.mindmap, evidenceBase) >= 0.15
        ? artifacts.mindmap
        : '',
  };
};

const getTranscriptInstruction = (mode: ExtractionMode) => {
  if (mode === ExtractionMode.TIMELINE) {
    return `
Transcript phai dung dang tung dong:
[HH:MM:SS] Noi dung

Quy tac:
- Giu moc thoi gian deu va ro rang.
- Neu nhan dien duoc nguoi noi, them nhan speaker sau timestamp.
- Chinh dau cau de de doc nhung khong doi nghia.
- Khong tom tat trong truong transcript.
    `.trim();
  }

  return `
Transcript phai o dang van ban lien mach, khong co timestamp.

Quy tac:
- Gom cac cau dut doan thanh doan van ro rang.
- Loai bo tieng dem khong can thiet neu khong doi nghia.
- Giu nguyen noi dung phat bieu quan trong.
- Khong tom tat trong truong transcript.
  `.trim();
};

const buildMeetingAnalysisPrompt = (mode: ExtractionMode) => `
Vai tro: thu ky AI phan tich mot transcript cuoc hop.

Nhiem vu:
1. Tao "title" ngan, sat noi dung chinh cua buoi hop.
2. Tao "suggestedFolderName" ngan gon, dang slug business-friendly.
3. Dat lai "transcript" bang dung transcript dau vao, khong tu sua noi dung.
4. Tao "summary" dang markdown voi cac muc:
   ## Boi canh
   ## Cac diem chinh
   ## Ket qua phien hop
   ## Buoc tiep theo
5. Tao "decisions" la danh sach markdown cac quyet dinh da chot ro rang.
6. Tao "risks" la danh sach markdown cac blocker, rui ro, diem con mo.
7. Tao "actionItems" la checklist markdown, moi dong bat dau bang "- [ ]".
8. Tao "folderTree" dang text thuan chi khi transcript co noi dung mang tinh cau truc he thong/quy trinh/thu muc. Neu khong du can cu, tra chuoi rong.
9. Tao "mindmap" dang Mermaid mindmap chi khi transcript co noi dung mang tinh he thong/cau truc. Neu khong du can cu, tra chuoi rong.

${getTranscriptInstruction(mode)}

Rang buoc:
- Output phai la JSON hop le duy nhat.
- ${getAiOutputLanguageInstruction()}
- Neu khong du bang chung cho mot artifact nao, tra chuoi rong cho artifact do.
- Khong duoc suy dien them ten rieng, con so, deadline, module, folder, he thong neu transcript khong noi toi.
- "decisions" chi ghi noi dung da duoc chot.
- "actionItems" chi ghi viec lam co can cu tu transcript.
- "summary" phai tom tat bao thu, khong duoc phat minh them.
`.trim();

const buildPrompt = (mode: ExtractionMode, context: SessionContext) => {
  const transcriptInstruction = getTranscriptInstruction(mode);

  if (context === SessionContext.MEETING) {
    return `
Vai tro: thu ky dieu phoi AI cho cuoc hop.

Nhiem vu:
1. Nghe ky file audio/video va chep lai day du vao truong "transcript".
2. Tao "title" ngan, sat noi dung chinh cua buoi hop.
3. Tao "suggestedFolderName" ngan gon, dang slug.
4. Tao "summary" dang markdown voi 4 muc:
   ## Boi canh
   ## Cac diem chinh
   ## Ket qua phien hop
   ## Buoc tiep theo
5. Tao "decisions" la danh sach markdown cac quyet dinh da chot ro rang.
6. Tao "risks" la danh sach markdown cac rui ro, blocker, diem con mo.
7. Tao "folderTree" dang text thuan chi khi noi dung thuc su mang tinh cau truc he thong/quy trinh/thu muc. Neu khong du can cu, tra chuoi rong.
8. Tao "mindmap" la cu phap Mermaid mindmap chi khi noi dung thuc su mang tinh he thong/cau truc. Neu khong du can cu, tra chuoi rong.
9. Tao "actionItems" la checklist markdown, moi dong bat dau bang "- [ ]".

${transcriptInstruction}

Rang buoc:
- Output phai la JSON hop le duy nhat.
- ${getAiOutputLanguageInstruction()}
- Neu khong nghe ro hoac khong du bang chung, ghi trung tinh hoac de trong, khong tu bia.
- "decisions" chi chua noi dung da duoc chot ro rang.
- "actionItems" chi ghi viec lam co can cu.
- "folderTree" va "mindmap" chi tao khi transcript thuc su co tinh he thong/cau truc.
    `.trim();
  }

  if (context === SessionContext.TRANSCRIPTION) {
    return `
Vai tro: chuyen gia trich xuat transcript tu file audio/video.

Nhiem vu:
1. Nghe ky file audio/video va chep lai day du vao truong "transcript".
2. Tao "title" ngan theo noi dung chinh cua file.
3. Tao "suggestedFolderName" ngan gon, dang slug.
4. Cac truong "summary", "decisions", "risks", "folderTree", "mindmap", "actionItems" phai la chuoi rong.

${transcriptInstruction}

Rang buoc:
- Chi tap trung vao transcript sach va de dung lai.
- Khong tao note hop, mindmap, folder tree.
- Output phai la JSON hop le duy nhat.
- ${getAiOutputLanguageInstruction()}
    `.trim();
  }

  return `
Vai tro: chuyen gia chep phong van.

Nhiem vu:
1. Nghe ky file audio/video va chep lai day du vao truong "transcript".
2. Tao "title" ngan theo chu de cuoc phong van.
3. Tao "suggestedFolderName" ngan gon, dang slug.
4. Cac truong "summary", "decisions", "risks", "folderTree", "mindmap", "actionItems" phai la chuoi rong.

${transcriptInstruction}

Rang buoc:
- Khong tom tat, khong suy dien he thong, khong dung mindmap cho phong van.
- Output phai la JSON hop le duy nhat.
- ${getAiOutputLanguageInstruction()}
  `.trim();
};

const buildTranscriptOnlyPrompt = (mode: ExtractionMode) => `
Vai tro: cong cu speech-to-text.

Nhiem vu:
- Chi nghe audio/video va tra ve transcript thuan.
- Khong tom tat.
- Khong suy dien.
- Khong tao decisions, risks, mindmap hay artifact nao khac.
- Neu khong nghe ro, giu dung phan nghe duoc; khong tu bia.
- Giu nguyen ngon ngu noi goc trong file, khong dich sang ngon ngu UI.

${getTranscriptInstruction(mode)}

Rang buoc:
- Chi tra ve noi dung transcript, khong JSON, khong markdown fence, khong giai thich them.
`.trim();

const extractTranscriptFromModelText = (rawText: string) => {
  const cleaned = sanitizeJsonText(rawText);
  if (!cleaned) return '';

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const transcript = readText(parsed.transcript);
    if (transcript) return transcript;
  } catch {
    // Plain-text output is expected; JSON is only a backward-compatible fallback.
  }

  return cleaned;
};

const buildGeminiTranscriptionModelCandidates = (preferredModelId: string) =>
  Array.from(
    new Set(
      [
        'gemini-2.5-flash-lite',
        DEFAULT_REALTIME_MODEL_ID,
        preferredModelId,
        DEFAULT_MODEL_ID,
        'gemini-2.5-flash',
      ].filter(Boolean)
    )
  );

const mapResponseToAnalysis = ({
  rawText,
  parsed,
  file,
  fallbackFileName,
  mode,
  source,
  context,
  savedRecording,
}: {
  rawText: string;
  parsed: Record<string, unknown> | null;
  file?: File | null;
  fallbackFileName?: string;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  savedRecording?: SavedDeviceFile | null;
}): SessionAnalysis => {
  const fallbackTitle = getFallbackTitle(file?.name || fallbackFileName || 'transcript');

  if (!parsed) {
    return {
      title: fallbackTitle,
      mode,
      source,
      context,
      suggestedFolderName: fallbackTitle,
      artifacts: {
        transcript:
          rawText || translateServiceMessage('gemini.general.cannotParseJson'),
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

  const mapped: SessionAnalysis = {
    title: readText(parsed.title) || fallbackTitle,
    mode,
    source,
    context,
    suggestedFolderName:
      readText(parsed.suggestedFolderName) || fallbackTitle.replace(/\s+/g, '-'),
    artifacts: {
      transcript:
        readText(parsed.transcript) ||
        rawText ||
        translateServiceMessage('gemini.general.transcriptMissing'),
      summary: context === SessionContext.MEETING ? readText(parsed.summary) : '',
      decisions: context === SessionContext.MEETING ? readText(parsed.decisions) : '',
      risks: context === SessionContext.MEETING ? readText(parsed.risks) : '',
      folderTree: context === SessionContext.MEETING ? readText(parsed.folderTree) : '',
      mindmap: context === SessionContext.MEETING ? readText(parsed.mindmap) : '',
      actionItems: context === SessionContext.MEETING ? readText(parsed.actionItems) : '',
    },
    savedRecording,
  };

  if (context === SessionContext.MEETING) {
    return {
      ...mapped,
      artifacts: sanitizeMeetingArtifacts(mapped.artifacts),
    };
  }

  return mapped;
};

let _cachedAiClient: { ai: GoogleGenAI; apiKey: string } | null = null;

const uploadToGeminiFilesRest = async ({
  apiKey,
  file,
}: {
  apiKey: string;
  file: File;
}) => {
  const initRes = await fetchGeminiRestWithBackoff(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(file.size),
        'X-Goog-Upload-Header-Content-Type': file.type || 'audio/wav',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: {
          displayName: file.name || 'audio.wav',
        },
      }),
    },
    'uploadToGeminiFilesRest:init'
  );

  if (!initRes.ok) {
    throw new Error(`Gemini file upload init failed: ${await initRes.text()}`);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url') || initRes.headers.get('X-Goog-Upload-Url');
  if (!uploadUrl) {
    throw new Error('Gemini file upload URL is missing.');
  }

  const uploadRes = await fetchGeminiRestWithBackoff(
    uploadUrl,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: file,
    },
    'uploadToGeminiFilesRest:finalize'
  );

  if (!uploadRes.ok) {
    throw new Error(`Gemini file upload finalize failed: ${await uploadRes.text()}`);
  }

  const uploadData = await uploadRes.json();
  const fileNameOnServer = uploadData.file?.name;
  const fileUri = uploadData.file?.uri;
  let state = uploadData.file?.state;

  if (!fileNameOnServer || !fileUri) {
    throw new Error('Gemini file metadata is incomplete.');
  }

  while (state === 'PROCESSING') {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const pollRes = await fetchGeminiRestWithBackoff(
      `https://generativelanguage.googleapis.com/v1beta/${fileNameOnServer}?key=${apiKey}`,
      {},
      'uploadToGeminiFilesRest:poll'
    );
    if (!pollRes.ok) {
      throw new Error(`Gemini file polling failed: ${await pollRes.text()}`);
    }
    const pollData = await pollRes.json();
    state = pollData.state;
    if (state === 'FAILED') {
      throw new Error('Gemini file processing failed.');
    }
  }

  return {
    fileData: {
      fileUri,
      mimeType: uploadData.file?.mimeType || file.type || 'audio/wav',
    },
  };
};

const fileToRestPart = async ({
  file,
  apiKey,
}: {
  file: File;
  apiKey: string;
}) => {
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > 8) {
    return uploadToGeminiFilesRest({ apiKey, file });
  }

  return {
    inlineData: {
      data: await fileToBase64(file),
      mimeType: file.type || 'audio/wav',
    },
  };
};

const generateContentViaRest = async ({
  apiKey,
  model,
  parts,
  generationConfig,
}: {
  apiKey: string;
  model: string;
  parts: Array<Record<string, unknown>>;
  generationConfig: Record<string, unknown>;
}) => {
  const response = await fetchGeminiRestWithBackoff(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: normalizeGenerationConfigForRest(generationConfig),
      }),
    },
    `generateContentViaRest:${model}`
  );

  if (!response.ok) {
    throw new Error(`Gemini REST error (${response.status}): ${await response.text()}`);
  }

  return response.json();
};

const getAiClient = async (passedSettings?: any) => {
  const settings = passedSettings || (await loadAiSettings());
  const apiKey = settings.apiKey.trim();
  const realtimeModelId =
    settings.realtimeModelId || DEFAULT_REALTIME_MODEL_ID || DEFAULT_MODEL_ID;
  const analysisModelId =
    settings.analysisModelId || DEFAULT_ANALYSIS_MODEL_ID || DEFAULT_MODEL_ID;

  if (!apiKey || apiKey === 'undefined') {
    throw new Error(translateServiceMessage('gemini.general.enterApiKey'));
  }

  if (!_cachedAiClient || _cachedAiClient.apiKey !== apiKey) {
    _cachedAiClient = { ai: new GoogleGenAI({ apiKey }), apiKey };
  }

  return {
    ai: _cachedAiClient.ai,
    apiKey,
    transcriptionModelId: settings.realtimeModelId || DEFAULT_REALTIME_MODEL_ID || DEFAULT_MODEL_ID,
    realtimeModelId,
    analysisModelId,
  };
};

const normalizeMeetingChunkResponse = (
  parsed: Record<string, unknown> | null,
  rawText: string
): LiveMeetingChunkAnalysis => {
  if (!parsed) {
    return {
      transcriptChunk: rawText || '',
      rollingSummary: '',
      decisions: '',
      risks: '',
      actionItems: '',
    };
  }

  return {
    transcriptChunk: readText(parsed.transcriptChunk) || rawText,
    rollingSummary: readText(parsed.rollingSummary),
    decisions: readText(parsed.decisions),
    risks: readText(parsed.risks),
    actionItems: readText(parsed.actionItems),
  };
};

export const processRealtimeMeetingChunk = async ({
  file,
  previousSummary,
  previousDecisions,
  previousRisks,
  previousActionItems,
  realtimeMode,
}: {
  file: File;
  previousSummary: string;
  previousDecisions: string;
  previousRisks: string;
  previousActionItems: string;
  realtimeMode: RealtimeMode;
}): Promise<LiveMeetingChunkAnalysis> => {
  try {
    const { ai, realtimeModelId } = await getAiClient();
    const filePart = await fileToGenerativePart(file, ai);

    const fullPrompt = `
Vai tro: AI note taker dang cap nhat bien ban cuoc hop theo tung doan ghi am ngan.

Trang thai hien tai:
SUMMARY:
${previousSummary || '(chua co)'}

DECISIONS:
${previousDecisions || '(chua co)'}

RISKS:
${previousRisks || '(chua co)'}

ACTION ITEMS:
${previousActionItems || '(chua co)'}

Nhiem vu:
1. Tao "transcriptChunk" chi cho doan audio moi nay.
2. Cap nhat "rollingSummary" thanh ban tom tat tich luy moi nhat.
3. Cap nhat "decisions" thanh danh sach markdown cac quyet dinh da chot den hien tai.
4. Cap nhat "risks" thanh danh sach markdown cac rui ro, blocker, diem con mo den hien tai.
5. Cap nhat "actionItems" thanh checklist markdown cac viec can lam den hien tai.

Rang buoc:
- Chi dung thong tin co can cu tu audio moi va trang thai hien tai.
- Neu chua du du kien thi giu ban cu hoac tra chuoi rong cho phan moi, khong bia.
- Output phai la JSON hop le duy nhat.
    `.trim();

    const hybridPrompt = `
Vai tro: AI realtime cho cuoc hop, uu tien tiet kiem chi phi.

Trang thai hien tai:
SUMMARY:
${previousSummary || '(chua co)'}

Nhiem vu:
1. Tao "transcriptChunk" chi cho doan audio moi nay.
2. Cap nhat "rollingSummary" ngan gon, tich luy den hien tai.

Rang buoc:
- Khong tao decisions/risks/action items o che do nay.
- Khong suy dien them noi dung khong co trong doan audio.
- Output phai la JSON hop le duy nhat.
    `.trim();

    const response = await retryWithBackoff(
      () => ai.models.generateContent({
        model: realtimeModelId,
        contents: {
          parts: [filePart, { text: realtimeMode === 'HYBRID' ? hybridPrompt : fullPrompt }],
        },
        config: {
          temperature: TEMPERATURE_TRANSCRIPT,
          responseMimeType: 'application/json',
          responseJsonSchema:
            realtimeMode === 'HYBRID' ? liveMeetingChunkHybridSchema : liveMeetingChunkSchema,
        },
      }),
      'processRealtimeMeetingChunk'
    );

    const rawText = sanitizeJsonText(response.text || '');
    let parsed: Record<string, unknown> | null = null;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    return normalizeMeetingChunkResponse(parsed, rawText);
  } catch (error: unknown) {
    logError('Realtime Gemini chunk error:', error);
    throw createGeminiUserError(
      error,
      translateServiceMessage('gemini.general.cannotUpdateRealtimeNotes')
    );
  }
};

const buildTextOnlyPrompt = (transcriptText: string, mode: ExtractionMode) => `
Vai tro: thu ky AI phan tich transcript cuoc hop.

Duoi day la transcript da co san:
--- TRANSCRIPT BAT DAU ---
${transcriptText}
--- TRANSCRIPT KET THUC ---

${buildMeetingAnalysisPrompt(mode)}
`.trim();

export const transcribeAudioWithGemini = async ({
  file,
  mode,
  settings: passedSettings,
}: {
  file: File;
  mode: ExtractionMode;
  settings?: any;
}): Promise<string> => {
  const settings = passedSettings || (await loadAiSettings());
  if (settings.useAdminKey) {
    const deviceId = await getDeviceId();
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
    const fileBase64 = await fileToBase64(file);
    const response = await fetch(`${backendUrl}/api/client/proxy/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        provider: 'gemini',
        fileBase64,
        fileName: file.name,
        fileType: file.type,
        mode,
        language: getSpeechRecognitionLanguage(),
        preferredModelId: settings.realtimeModelId || DEFAULT_REALTIME_MODEL_ID,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Proxy transcription error (${response.status})`);
    }

    const data = await response.json();
    return data.transcript;
  }

  try {
    const { ai, transcriptionModelId, apiKey } = await getAiClient(settings);
    const filePart = await fileToGenerativePart(file, ai);
    const prompt = buildTranscriptOnlyPrompt(mode);
    const transcriptionModels = buildGeminiTranscriptionModelCandidates(transcriptionModelId);
    let rawText = '';
    let lastError: unknown = null;

    for (const modelId of transcriptionModels) {
      try {
        const response = await retryWithBackoff(
          () => ai.models.generateContent({
            model: modelId,
            contents: {
              parts: [filePart, { text: prompt }],
            },
            config: {
              temperature: TEMPERATURE_TRANSCRIPT,
            },
          }),
          `transcribeAudioWithGemini:${modelId}`
        );
        rawText = response.text || '';
        const transcript = extractTranscriptFromModelText(rawText);
        if (transcript) {
          return transcript;
        }
        lastError = new Error(translateServiceMessage('gemini.general.invalidTranscriptResponse'));
      } catch (sdkError) {
        lastError = sdkError;
        logWarning(`Gemini SDK transcription failed for model ${modelId}, retrying via REST fallback:`, sdkError);

        try {
          const restResponse = await generateContentViaRest({
            apiKey,
            model: modelId,
            parts: [await fileToRestPart({ file, apiKey }), { text: prompt }],
            generationConfig: {
              temperature: TEMPERATURE_TRANSCRIPT,
            },
          });
          rawText = extractRestCandidateText(restResponse);
          const transcript = extractTranscriptFromModelText(rawText);
          if (transcript) {
            return transcript;
          }
          lastError = new Error(translateServiceMessage('gemini.general.invalidTranscriptResponse'));
        } catch (restError) {
          lastError = restError;
          logWarning(`Gemini REST transcription failed for model ${modelId}:`, restError);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(
          rawText
            ? translateServiceMessage('gemini.general.invalidTranscriptResponse')
            : translateServiceMessage('gemini.general.emptyTranscriptResult')
        );
  } catch (error: unknown) {
    logError('Gemini transcription error:', error);
    throw createGeminiUserError(
      error,
      translateServiceMessage('gemini.general.cannotTranscribe')
    );
  }
};

export const analyzeTranscriptWithGemini = async ({
  transcriptText,
  file,
  fallbackFileName,
  mode,
  source,
  context,
  savedRecording,
  additionalExtractedTexts,
  additionalPdfFiles,
  settings: passedSettings,
}: {
  transcriptText: string;
  file?: File | null;
  fallbackFileName?: string;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  savedRecording?: SavedDeviceFile | null;
  additionalExtractedTexts?: Array<{ fileName: string; content: string }>;
  additionalPdfFiles?: File[];
  settings?: any;
}): Promise<SessionAnalysis> => {
  const settings = passedSettings || (await loadAiSettings());
  if (settings.useAdminKey) {
    try {
      const pdfParts = await Promise.all(
        (additionalPdfFiles || []).map(async (pdfFile) => {
          const data = await fileToBase64(pdfFile);
          return {
            inlineData: {
              data,
              mimeType: pdfFile.type || 'application/pdf',
            },
          };
        })
      );

      let prompt: string;
      if (context === SessionContext.MEETING) {
        prompt = buildTextOnlyPrompt(transcriptText, mode);
      } else if (context === SessionContext.INTERVIEW) {
        prompt = `
Vai tro: chuyen gia chep phong van.
 
Duoi day la transcript cuoc phong van da co san:
--- TRANSCRIPT BAT DAU ---
${transcriptText}
--- TRANSCRIPT KET THUC ---
 
Nhiem vu:
- Dat lai "transcript" bang dung transcript phong van o tren, giu nguyen cau hoi va tra loi.
- Tao "title" ngan gon theo chu de cuoc phong van.
- Tao "suggestedFolderName" dang slug ngan gon.
- Cac truong "summary", "decisions", "risks", "folderTree", "mindmap", "actionItems" phai la chuoi rong.
- Output phai la JSON hop le duy nhat.
 
Rang buoc:
- Khong tom tat, khong suy dien he thong, khong dung mindmap hay folder tree cho phong van.
- Khong tu bia thong tin ngoai transcript.
        `.trim();
      } else {
        prompt = `
Vai tro: cong cu xu ly transcript.
 
Duoi day la transcript da co san:
--- TRANSCRIPT BAT DAU ---
${transcriptText}
--- TRANSCRIPT KET THUC ---
 
Nhiem vu:
- Dat lai "transcript" bang dung transcript o tren.
- Tao "title" va "suggestedFolderName" ngan gon.
- Cac truong "summary", "decisions", "risks", "folderTree", "mindmap", "actionItems" phai la chuoi rong.
- Output phai la JSON hop le duy nhat.
        `.trim();
      }

      if (additionalExtractedTexts && additionalExtractedTexts.length > 0) {
        const textsBlock = additionalExtractedTexts
          .map(
            (item) => `
--- TAI LIEU DINH KEM BO TRO: ${item.fileName} ---
${item.content}
--- HET TAI LIEU: ${item.fileName} ---
`
          )
          .join('\n\n');

        prompt += `
 
Duoi day la noi dung cua cac tai lieu bo tro do nguoi dung cung cap. Hay doc va ket hop doi chieu cac tai lieu nay voi transcript o tren de tra ve ket qua tom tat, quyet dinh, mindmap, va folder tree chinh xac va day du nhat:
${textsBlock}
`;
      }

      if (additionalPdfFiles && additionalPdfFiles.length > 0) {
        prompt += `
 
Chu y: Co ${additionalPdfFiles.length} tai lieu PDF duoc dinh kem duoi dang cac dynamic parts trong request nay. Hay doc va phan tich truc tiep file PDF nay cung voi transcript de toi uu ket qua summary va mindmap.
`;
      }

      const parts = [...pdfParts, { text: prompt }];
      const deviceId = await getDeviceId();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
      const model = settings.analysisModelId || DEFAULT_ANALYSIS_MODEL_ID;

      const response = await fetch(`${backendUrl}/api/client/proxy/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          model,
          contents: { parts },
          generationConfig: {
            temperature: context === SessionContext.MEETING ? TEMPERATURE_ANALYSIS : TEMPERATURE_TRANSCRIPT,
            responseMimeType: 'application/json',
            responseJsonSchema: sessionResponseSchema,
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Proxy analysis error (${response.status})`);
      }

      const rawText = await response.json();
      // Since proxy returns raw parsed JSON, we wrap it back or handle it
      return mapResponseToAnalysis({
        rawText: JSON.stringify(rawText),
        parsed: rawText,
        file,
        fallbackFileName,
        mode,
        source,
        context,
        savedRecording,
      });
    } catch (error: any) {
      logError('Gemini proxy text analysis error:', error);
      throw createGeminiUserError(
        error,
        translateServiceMessage('gemini.general.cannotAnalyzeProxy')
      );
    }
  }

  try {
    const { ai, analysisModelId, apiKey } = await getAiClient(settings);

    // Chuẩn bị các file PDF đính kèm dưới dạng các generative parts đa phương thức
    const pdfParts = await Promise.all(
      (additionalPdfFiles || []).map((pdfFile) => fileToGenerativePart(pdfFile, ai))
    );

    let prompt: string;

    if (context === SessionContext.MEETING) {
      prompt = buildTextOnlyPrompt(transcriptText, mode);
    } else if (context === SessionContext.INTERVIEW) {
      prompt = `
Vai tro: chuyen gia chep phong van.
 
Duoi day la transcript cuoc phong van da co san:
--- TRANSCRIPT BAT DAU ---
${transcriptText}
--- TRANSCRIPT KET THUC ---
 
Nhiem vu:
- Dat lai "transcript" bang dung transcript phong van o tren, giu nguyen cau hoi va tra loi.
- Tao "title" ngan gon theo chu de cuoc phong van.
- Tao "suggestedFolderName" dang slug ngan gon.
- Cac truong "summary", "decisions", "risks", "folderTree", "mindmap", "actionItems" phai la chuoi rong.
- Output phai la JSON hop le duy nhat.
 
Rang buoc:
- Khong tom tat, khong suy dien he thong, khong dung mindmap hay folder tree cho phong van.
- Khong tu bia thong tin ngoai transcript.
      `.trim();
    } else {
      prompt = `
Vai tro: cong cu xu ly transcript.
 
Duoi day la transcript da co san:
--- TRANSCRIPT BAT DAU ---
${transcriptText}
--- TRANSCRIPT KET THUC ---
 
Nhiem vu:
- Dat lai "transcript" bang dung transcript o tren.
- Tao "title" va "suggestedFolderName" ngan gon.
- Cac truong "summary", "decisions", "risks", "folderTree", "mindmap", "actionItems" phai la chuoi rong.
- Output phai la JSON hop le duy nhat.
      `.trim();
    }

    // Nhúng các nội dung văn bản phụ trợ bổ sung vào prompt chính
    if (additionalExtractedTexts && additionalExtractedTexts.length > 0) {
      const textsBlock = additionalExtractedTexts
        .map(
          (item) => `
--- TAI LIEU DINH KEM BO TRO: ${item.fileName} ---
${item.content}
--- HET TAI LIEU: ${item.fileName} ---
`
        )
        .join('\n\n');

      prompt += `
 
Duoi day la noi dung cua cac tai lieu bo tro do nguoi dung cung cap. Hay doc va ket hop doi chieu cac tai lieu nay voi transcript o tren de tra ve ket qua tom tat, quyet dinh, mindmap, va folder tree chinh xac va day du nhat:
${textsBlock}
`;
    }

    // Nếu có PDF đính kèm, thêm ghi chú cho mô hình biết để tham chiếu
    if (additionalPdfFiles && additionalPdfFiles.length > 0) {
      prompt += `
 
Chu y: Co ${additionalPdfFiles.length} tai lieu PDF duoc dinh kem duoi dang cac dynamic parts trong request nay. Hay doc va phan tich truc tiep file PDF nay cung voi transcript de toi uu ket qua summary va mindmap.
`;
    }

    const parts = [...pdfParts, { text: prompt }];

    let rawText = '';
    try {
      const response = await retryWithBackoff(
        () => ai.models.generateContent({
          model: analysisModelId,
          contents: { parts },
          config: {
            temperature: context === SessionContext.MEETING ? TEMPERATURE_ANALYSIS : TEMPERATURE_TRANSCRIPT,
            responseMimeType: 'application/json',
            responseJsonSchema: sessionResponseSchema,
          },
        }),
        'analyzeTranscriptWithGemini'
      );
      rawText = sanitizeJsonText(response.text || '');
    } catch (sdkError) {
      logWarning('Gemini SDK analysis failed, retrying via REST fallback:', sdkError);
      const restPdfParts = await Promise.all(
        (additionalPdfFiles || []).map((pdfFile) => fileToRestPart({ file: pdfFile, apiKey }))
      );
      const restResponse = await generateContentViaRest({
        apiKey,
        model: analysisModelId,
        parts: [...restPdfParts, { text: prompt }],
        generationConfig: {
          temperature: context === SessionContext.MEETING ? TEMPERATURE_ANALYSIS : TEMPERATURE_TRANSCRIPT,
          responseMimeType: 'application/json',
          responseJsonSchema: sessionResponseSchema,
        },
      });
      rawText = sanitizeJsonText(extractRestCandidateText(restResponse));
    }

    if (!rawText) throw new Error(translateServiceMessage('gemini.general.emptyResult'));

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    return mapResponseToAnalysis({
      rawText,
      parsed,
      file,
      fallbackFileName,
      mode,
      source,
      context,
      savedRecording,
    });
  } catch (error: unknown) {
    logError('Gemini text analysis error:', error);
    throw createGeminiUserError(
      error,
      translateServiceMessage('gemini.general.cannotAnalyze')
    );
  }
};

/**
 * @deprecated Prefer processWithOrchestrator which splits transcript + analysis into 2 steps.
 * Kept as a fallback for direct single-step processing of small files.
 */
export const processMediaSession = async ({
  file,
  mode,
  source,
  context,
  savedRecording,
}: {
  file: File;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  savedRecording?: SavedDeviceFile | null;
}): Promise<SessionAnalysis> => {
  try {
    const { ai, analysisModelId } = await getAiClient();
    const filePart = await fileToGenerativePart(file, ai);
    const prompt = buildPrompt(mode, context);

    const response = await retryWithBackoff(
      () => ai.models.generateContent({
        model: analysisModelId,
        contents: {
          parts: [filePart, { text: prompt }],
        },
        config: {
          temperature: context === SessionContext.MEETING ? TEMPERATURE_ANALYSIS : TEMPERATURE_TRANSCRIPT,
          responseMimeType: 'application/json',
          responseJsonSchema: sessionResponseSchema,
        },
      }),
      'processMediaSession'
    );

    const rawText = sanitizeJsonText(response.text || '');
    if (!rawText) throw new Error(translateServiceMessage('gemini.general.emptyResult'));

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    return mapResponseToAnalysis({
      rawText,
      parsed,
      file,
      mode,
      source,
      context,
      savedRecording,
    });
  } catch (error: unknown) {
    logError('Gemini processing error:', error);
    throw createGeminiUserError(
      error,
      translateServiceMessage('gemini.general.cannotProcessFile')
    );
  }
};
