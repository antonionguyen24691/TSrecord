import { GoogleGenAI } from '@google/genai';
import {
  ExtractionMode,
  InputSource,
  SessionAnalysis,
  SessionContext,
  SavedDeviceFile,
} from '../types';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  DEFAULT_MODEL_ID,
  DEFAULT_REALTIME_MODEL_ID,
  loadAiSettings,
} from './aiSettingsService';
import type { RealtimeMode } from './aiSettingsService';

const MAX_FILE_SIZE_MB = 300;

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

const fileToGenerativePart = async (file: File) => {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(
      `File quá lớn. Vui lòng chọn file dưới ${MAX_FILE_SIZE_MB}MB để tránh treo ứng dụng.`
    );
  }

  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Content = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return {
    inlineData: {
      data: await base64EncodedDataPromise,
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

const getTranscriptInstruction = (mode: ExtractionMode) => {
  if (mode === ExtractionMode.TIMELINE) {
    return `
      Transcript phải đúng định dạng từng dòng:
      [HH:MM:SS] Nội dung

      Quy tắc:
      - Giữ nguyên mốc thời gian ở mức hợp lý, đều và rõ ràng.
      - Nếu nhận diện được người nói, thêm nhãn người nói sau timestamp.
      - Chỉnh dấu câu tiếng Việt cho dễ đọc nhưng không làm sai nghĩa.
      - Không tóm tắt trong trường transcript.
    `.trim();
  }

  return `
    Transcript phải ở dạng văn bản liền mạch, không có timestamp.

    Quy tắc:
    - Gộp các câu nói đứt đoạn thành đoạn văn rõ ràng.
    - Loại bỏ tiếng đệm không cần thiết khi không làm thay đổi ý.
    - Giữ nguyên nội dung phát biểu quan trọng.
    - Không tóm tắt trong trường transcript.
  `.trim();
};

const buildPrompt = (mode: ExtractionMode, context: SessionContext) => {
  const transcriptInstruction = getTranscriptInstruction(mode);

  if (context === SessionContext.MEETING) {
    return `
      Vai trò: thư ký điều phối AI cho cuộc họp.

      Nhiệm vụ:
      1. Nghe kỹ file audio/video và chép lại đầy đủ vào trường "transcript".
      2. Tạo "title" ngắn, sát nội dung chính của buổi họp.
      3. Tạo "suggestedFolderName" ngắn gọn, dùng kiểu slug business-friendly.
      4. Tạo "summary" ở dạng markdown với các mục:
         ## Bối cảnh
         ## Các điểm chính
         ## Kết quả phiên họp
         ## Bước tiếp theo
      5. Tạo "decisions" là danh sách markdown các quyết định hoặc kết luận đã được chốt.
      6. Tạo "risks" là danh sách markdown các rủi ro, blocker hoặc điểm còn bỏ ngỏ.
      7. Tạo "folderTree" là cây thư mục đề xuất ở dạng text thuần. Chỉ trả về cây thư mục, không dùng markdown fence.
      8. Tạo "mindmap" là cú pháp Mermaid mindmap hoàn chỉnh, không dùng markdown fence.
         Bắt buộc đúng mẫu đa tầng như sau (chỉ là ví dụ cấu trúc):
         mindmap
           root((Tên chủ đề chính))
             Nhánh 1
               Ý con 1
               Ý con 2
             Nhánh 2
               Ý con 1
               Ý con 2
         Yêu cầu:
         - Phải có root.
         - Tối thiểu 4 nhánh cấp 1.
         - Mỗi nhánh cấp 1 có ít nhất 2 nhánh con.
         - Không trả dạng 1 dòng, không dùng ký hiệu A(B) rời rạc.
      9. Tạo "actionItems" là checklist markdown, mỗi dòng bắt đầu bằng "- [ ]".

      ${transcriptInstruction}

      Ràng buộc:
      - Output phải là JSON hợp lệ duy nhất.
      - Các trường summary, decisions, risks, folderTree, mindmap, actionItems phải có nội dung thực sự.
      - Nếu không nghe rõ, ghi nhận một cách trung tính, không tự bịa.
      - Phần decisions chỉ chứa nội dung đã được chốt hoặc gần như chốt trong audio.
    `.trim();
  }

  if (context === SessionContext.TRANSCRIPTION) {
    return `
      Vai trò: chuyên gia trích xuất transcript từ file audio/video.

      Nhiệm vụ:
      1. Nghe kỹ file audio/video và chép lại đầy đủ vào trường "transcript".
      2. Tạo "title" ngắn theo nội dung chính của file.
      3. Tạo "suggestedFolderName" ngắn gọn, dạng slug.
      4. Các trường "summary", "decisions", "risks", "folderTree", "mindmap", "actionItems" phải là chuỗi rỗng.

      ${transcriptInstruction}

      Ràng buộc:
      - Chỉ tập trung vào transcript sạch và dễ dùng lại.
      - Không dựng mindmap, không dựng cây thư mục, không tự thêm ghi chú họp.
      - Output phải là JSON hợp lệ duy nhất.
    `.trim();
  }

  return `
    Vai trò: chuyên gia chép phỏng vấn.

    Nhiệm vụ:
    1. Nghe kỹ file audio/video và chép lại đầy đủ vào trường "transcript".
    2. Tạo "title" ngắn theo chủ đề cuộc phỏng vấn.
    3. Tạo "suggestedFolderName" ngắn gọn, dạng slug.
    4. Các trường "summary", "decisions", "risks", "folderTree", "mindmap", "actionItems" phải là chuỗi rỗng.

    ${transcriptInstruction}

    Ràng buộc:
    - Không tóm tắt, không suy diễn hệ thống, không dựng mindmap cho phỏng vấn.
    - Output phải là JSON hợp lệ duy nhất.
  `.trim();
};

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
          rawText || 'Không thể đọc JSON từ AI. Hệ thống giữ lại phần text thô hiện có.',
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

  return {
    title: readText(parsed.title) || fallbackTitle,
    mode,
    source,
    context,
    suggestedFolderName:
      readText(parsed.suggestedFolderName) || fallbackTitle.replace(/\s+/g, '-'),
    artifacts: {
      transcript: readText(parsed.transcript) || rawText || 'AI không trả về transcript.',
      summary: context === SessionContext.MEETING ? readText(parsed.summary) : '',
      decisions: context === SessionContext.MEETING ? readText(parsed.decisions) : '',
      risks: context === SessionContext.MEETING ? readText(parsed.risks) : '',
      folderTree: context === SessionContext.MEETING ? readText(parsed.folderTree) : '',
      mindmap: context === SessionContext.MEETING ? readText(parsed.mindmap) : '',
      actionItems: context === SessionContext.MEETING ? readText(parsed.actionItems) : '',
    },
    savedRecording,
  };
};

const getAiClient = async () => {
  const settings = await loadAiSettings();
  const apiKey = settings.apiKey.trim();
  const realtimeModelId =
    settings.realtimeModelId || DEFAULT_REALTIME_MODEL_ID || DEFAULT_MODEL_ID;
  const analysisModelId =
    settings.analysisModelId || DEFAULT_ANALYSIS_MODEL_ID || DEFAULT_MODEL_ID;

  if (!apiKey || apiKey === 'undefined') {
    throw new Error('Vui lòng nhập Gemini API Key trong phần Cài đặt trên thiết bị này trước khi sử dụng.');
  }

  return {
    ai: new GoogleGenAI({ apiKey }),
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
    const filePart = await fileToGenerativePart(file);

    const prompt = `
      Vai trò: AI note taker đang cập nhật biên bản cuộc họp theo từng đoạn ghi âm ngắn.

      Bạn đang xử lý một đoạn audio mới của cùng một cuộc họp.

      Trạng thái hiện tại:
      SUMMARY:
      ${previousSummary || '(chưa có)'}

      DECISIONS:
      ${previousDecisions || '(chưa có)'}

      RISKS:
      ${previousRisks || '(chưa có)'}

      ACTION ITEMS:
      ${previousActionItems || '(chưa có)'}

      Nhiệm vụ:
      1. Tạo "transcriptChunk" chỉ cho đoạn audio mới này.
      2. Cập nhật "rollingSummary" thành bản tóm tắt tích lũy mới nhất của cuộc họp tính đến hiện tại, dạng markdown gọn.
      3. Cập nhật "decisions" thành danh sách markdown các quyết định đã chốt đến hiện tại.
      4. Cập nhật "risks" thành danh sách markdown các rủi ro, blocker hoặc điểm còn mở đến hiện tại.
      5. Cập nhật "actionItems" thành checklist markdown các việc cần làm đến hiện tại.

      Ràng buộc:
      - Chỉ dùng thông tin có căn cứ từ audio mới và trạng thái hiện tại.
      - Nếu chưa đủ dữ kiện thì giữ bản cũ hoặc cập nhật rất ít, không bịa.
      - Output phải là JSON hợp lệ duy nhất.
    `.trim();
    const effectivePrompt =
      realtimeMode === 'HYBRID'
        ? `
      Vai trò: AI realtime cho cuộc họp, ưu tiên tiết kiệm chi phí.

      Bạn đang xử lý một đoạn audio mới của cùng một cuộc họp.

      Trạng thái hiện tại:
      SUMMARY:
      ${previousSummary || '(chua co)'}

      Nhiệm vụ:
      1. Tạo "transcriptChunk" chỉ cho đoạn audio mới này.
      2. Cập nhật "rollingSummary" ngắn gọn, tích lũy đến hiện tại.

      Ràng buộc:
      - Không tạo decisions/risks/action items ở chế độ này.
      - Output phải là JSON hợp lệ duy nhất.
    `.trim()
        : prompt;

    const response = await ai.models.generateContent({
      model: realtimeModelId,
      contents: {
        parts: [filePart, { text: effectivePrompt }],
      },
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema:
          realtimeMode === 'HYBRID' ? liveMeetingChunkHybridSchema : liveMeetingChunkSchema,
      },
    });

    const rawText = sanitizeJsonText(response.text || '');
    let parsed: Record<string, unknown> | null = null;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    return normalizeMeetingChunkResponse(parsed, rawText);
  } catch (error: any) {
    console.error('Realtime Gemini chunk error:', error);
    throw new Error(error?.message || 'Không thể cập nhật ghi chú realtime.');
  }
};

/**
 * buildTextOnlyPrompt: Prompt cho Gemini khi đã có transcript text sẵn (Bước 2).
 * Không cần nghe audio nữa — Gemini chỉ đọc text và phân tích.
 */
const buildTextOnlyPrompt = (transcriptText: string): string => `
  Vai trò: thư ký điều phối AI cho cuộc họp.

  Bạn đã có sẵn bản transcript sau đây của một buổi họp (đã được nhận diện giọng nói bởi hệ thống khác):

  --- TRANSCRIPT BẮT ĐẦU ---
  ${transcriptText}
  --- TRANSCRIPT KẾT THÚC ---

  Nhiệm vụ (KHÔNG cần nghe audio, chỉ phân tích text trên):
  1. Đặt lại trường "transcript" bằng toàn bộ nội dung transcript ở trên.
  2. Tạo "title" ngắn, sát nội dung chính của buổi họp.
  3. Tạo "suggestedFolderName" ngắn gọn, dùng kiểu slug business-friendly.
  4. Tạo "summary" ở dạng markdown với các mục:
     ## Bối cảnh
     ## Các điểm chính
     ## Kết quả phiên họp
     ## Bước tiếp theo
  5. Tạo "decisions" là danh sách markdown các quyết định hoặc kết luận đã được chốt.
  6. Tạo "risks" là danh sách markdown các rủi ro, blocker hoặc điểm còn bỏ ngỏ.
  7. Tạo "folderTree" là cây thư mục đề xuất ở dạng text thuần. Chỉ trả về cây thư mục, không dùng markdown fence.
  8. Tạo "mindmap" là cú pháp Mermaid mindmap hoàn chỉnh, không dùng markdown fence.
     Bắt buộc đúng mẫu đa tầng:
     mindmap
       root((Tên chủ đề chính))
         Nhánh 1
           Ý con 1
           Ý con 2
         Nhánh 2
           Ý con 1
           Ý con 2
     Yêu cầu: phải có root, tối thiểu 4 nhánh cấp 1, mỗi nhánh cấp 1 có ít nhất 2 nhánh con.
  9. Tạo "actionItems" là checklist markdown, mỗi dòng bắt đầu bằng "- [ ]".

  Ràng buộc:
  - Output phải là JSON hợp lệ duy nhất.
  - Các trường summary, decisions, risks, folderTree, mindmap, actionItems phải có nội dung thực sự.
  - Không bịa thêm ngoài những gì có trong transcript.
`.trim();

/**
 * Bước 2 của Two-Step Pipeline:
 * Nhận transcript text thuần → Gemini phân tích → SessionAnalysis.
 * Dùng khi user chọn AssemblyAI/Groq/OpenAI làm nguồn Transcript.
 */
export const analyzeTranscriptWithGemini = async ({
  transcriptText,
  file,
  mode,
  source,
  context,
  savedRecording,
}: {
  transcriptText: string;
  file: File;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  savedRecording?: SavedDeviceFile | null;
}): Promise<SessionAnalysis> => {
  try {
    const { ai, analysisModelId } = await getAiClient();
    const prompt = buildTextOnlyPrompt(transcriptText);

    const response = await ai.models.generateContent({
      model: analysisModelId,
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: sessionResponseSchema,
      },
    });

    const rawText = sanitizeJsonText(response.text || '');

    if (!rawText) throw new Error('Kết quả AI rỗng.');

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    return mapResponseToAnalysis({ rawText, parsed, file, mode, source, context, savedRecording });
  } catch (error: any) {
    console.error('Gemini Text Analysis Error:', error);
    let userMsg = 'Đã xảy ra lỗi khi phân tích transcript.';
    const errorStr = `${error?.message || ''}`.toLowerCase();
    if (errorStr.includes('api key') || errorStr.includes('400')) {
      userMsg = 'Gemini API Key không hợp lệ.';
    }
    throw new Error(`${userMsg} (${error.message})`);
  }
};

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
    const filePart = await fileToGenerativePart(file);
    const prompt = buildPrompt(mode, context);

    const response = await ai.models.generateContent({
      model: analysisModelId,
      contents: {
        parts: [filePart, { text: prompt }],
      },
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: sessionResponseSchema,
      },
    });

    const rawText = sanitizeJsonText(response.text || '');

    if (!rawText) {
      throw new Error('Kết quả AI rỗng.');
    }

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
  } catch (error: any) {
    console.error('Gemini Processing Error:', error);

    let userMsg = 'Đã xảy ra lỗi khi xử lý file.';
    const errorStr = `${error?.message || ''}`.toLowerCase();

    if (errorStr.includes('413')) userMsg = 'File quá lớn so với giới hạn của AI.';
    if (errorStr.includes('fetch') || errorStr.includes('network')) {
      userMsg = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet.';
    }
    if (
      errorStr.includes('api key') ||
      errorStr.includes('invalid_argument') ||
      errorStr.includes('400')
    ) {
      userMsg = 'API Key không hợp lệ hoặc model hiện tại không khả dụng.';
    }

    throw new Error(`${userMsg} (${error.message})`);
  }
};
