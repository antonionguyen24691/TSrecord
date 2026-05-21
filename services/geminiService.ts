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
} from './aiSettingsService';
import type { RealtimeMode } from './aiSettingsService';
import { createGeminiUserError } from './utils/geminiError';
import { logError, logWarning } from './utils/logging';

const MAX_FILE_SIZE_MB = 300;
const INLINE_DATA_THRESHOLD_MB = 20;
const TEMPERATURE_TRANSCRIPT = 0.1;
const TEMPERATURE_ANALYSIS = 0.3;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const RETRYABLE_STATUS_PATTERNS = /\b(429|500|502|503|504|unavailable|overloaded|resource_exhausted|too many requests|internal|deadline)\b/i;

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

const transcriptOnlyResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    transcript: { type: 'string' },
  },
  required: ['transcript'],
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

      const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      logWarning(
        `${context}: Retry ${attempt + 1}/${MAX_RETRIES} sau ${delayMs}ms`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Content = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const fileToGenerativePart = async (
  file: File,
  ai?: GoogleGenAI
): Promise<Record<string, unknown>> => {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(
      `File qua lon. Vui long chon file duoi ${MAX_FILE_SIZE_MB}MB de tranh treo ung dung.`
    );
  }

  const fileSizeMB = file.size / (1024 * 1024);

  if (ai && fileSizeMB > INLINE_DATA_THRESHOLD_MB) {
    try {
      const uploaded = await ai.files.upload({
        file,
        config: { mimeType: file.type || 'audio/webm' },
      });

      if (uploaded.uri) {
        return {
          fileData: {
            fileUri: uploaded.uri,
            mimeType: uploaded.mimeType || file.type || 'audio/webm',
          },
        };
      }
    } catch (uploadError) {
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
  `.trim();
};

const buildTranscriptOnlyPrompt = (mode: ExtractionMode) => `
Vai tro: cong cu speech-to-text.

Nhiem vu:
- Chi nghe audio/video va tra ve truong "transcript".
- Khong tom tat.
- Khong suy dien.
- Khong tao decisions, risks, mindmap hay artifact nao khac.
- Neu khong nghe ro, giu dung phan nghe duoc; khong tu bia.

${getTranscriptInstruction(mode)}

Rang buoc:
- Output phai la JSON hop le duy nhat.
- Khong tra them text nao ngoai JSON.
`.trim();

const mapResponseToAnalysis = ({
  rawText,
  parsed,
  file,
  mode,
  source,
  context,
  savedRecording,
}: {
  rawText: string;
  parsed: Record<string, unknown> | null;
  file: File;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  savedRecording?: SavedDeviceFile | null;
}): SessionAnalysis => {
  const fallbackTitle = getFallbackTitle(file.name);

  if (!parsed) {
    return {
      title: fallbackTitle,
      mode,
      source,
      context,
      suggestedFolderName: fallbackTitle,
      artifacts: {
        transcript:
          rawText || 'Khong the doc JSON tu AI. He thong giu lai phan text tho hien co.',
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
      transcript: readText(parsed.transcript) || rawText || 'AI khong tra ve transcript.',
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

const getAiClient = async () => {
  const settings = await loadAiSettings();
  const apiKey = settings.apiKey.trim();
  const realtimeModelId =
    settings.realtimeModelId || DEFAULT_REALTIME_MODEL_ID || DEFAULT_MODEL_ID;
  const analysisModelId =
    settings.analysisModelId || DEFAULT_ANALYSIS_MODEL_ID || DEFAULT_MODEL_ID;

  if (!apiKey || apiKey === 'undefined') {
    throw new Error('Vui long nhap Gemini API Key trong phan Cai dat tren thiet bi nay.');
  }

  if (!_cachedAiClient || _cachedAiClient.apiKey !== apiKey) {
    _cachedAiClient = { ai: new GoogleGenAI({ apiKey }), apiKey };
  }

  return {
    ai: _cachedAiClient.ai,
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
    throw createGeminiUserError(error, 'Khong the cap nhat ghi chu realtime.');
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
}: {
  file: File;
  mode: ExtractionMode;
}): Promise<string> => {
  try {
    const { ai, analysisModelId } = await getAiClient();
    const filePart = await fileToGenerativePart(file, ai);
    const response = await retryWithBackoff(
      () => ai.models.generateContent({
        model: analysisModelId,
        contents: {
          parts: [filePart, { text: buildTranscriptOnlyPrompt(mode) }],
        },
        config: {
          temperature: TEMPERATURE_TRANSCRIPT,
          responseMimeType: 'application/json',
          responseJsonSchema: transcriptOnlyResponseSchema,
        },
      }),
      'transcribeAudioWithGemini'
    );

    const rawText = sanitizeJsonText(response.text || '');
    if (!rawText) throw new Error('Ket qua transcript rong.');

    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    const transcript = readText(parsed.transcript);
    if (!transcript) throw new Error('Gemini khong tra transcript hop le.');
    return transcript;
  } catch (error: unknown) {
    logError('Gemini transcription error:', error);
    throw createGeminiUserError(error, 'Khong the transcript audio bang Gemini.');
  }
};

export const analyzeTranscriptWithGemini = async ({
  transcriptText,
  file,
  mode,
  source,
  context,
  savedRecording,
  additionalExtractedTexts,
  additionalPdfFiles,
}: {
  transcriptText: string;
  file: File;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  savedRecording?: SavedDeviceFile | null;
  additionalExtractedTexts?: Array<{ fileName: string; content: string }>;
  additionalPdfFiles?: File[];
}): Promise<SessionAnalysis> => {
  try {
    const { ai, analysisModelId } = await getAiClient();

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

    const rawText = sanitizeJsonText(response.text || '');
    if (!rawText) throw new Error('Ket qua AI rong.');

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
    logError('Gemini text analysis error:', error);
    throw createGeminiUserError(error, 'Da xay ra loi khi phan tich transcript.');
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
    if (!rawText) throw new Error('Ket qua AI rong.');

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
    throw createGeminiUserError(error, 'Da xay ra loi khi xu ly file.');
  }
};
