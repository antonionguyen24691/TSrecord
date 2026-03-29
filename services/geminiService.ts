import { GoogleGenAI } from '@google/genai';
import {
  ExtractionMode,
  InputSource,
  SessionAnalysis,
  SessionContext,
  SavedDeviceFile,
} from '../types';
import { DEFAULT_MODEL_ID, loadAiSettings } from './aiSettingsService';

const MAX_FILE_SIZE_MB = 300;

const sessionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    suggestedFolderName: { type: 'string' },
    transcript: { type: 'string' },
    summary: { type: 'string' },
    folderTree: { type: 'string' },
    mindmap: { type: 'string' },
    actionItems: { type: 'string' },
  },
  required: [
    'title',
    'suggestedFolderName',
    'transcript',
    'summary',
    'folderTree',
    'mindmap',
    'actionItems',
  ],
} as const;

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
         ## Quyết định
         ## Rủi ro / vướng mắc
         ## Bước tiếp theo
      5. Tạo "folderTree" là cây thư mục đề xuất ở dạng text thuần. Chỉ trả về cây thư mục, không dùng markdown fence.
      6. Tạo "mindmap" là cú pháp Mermaid mindmap hoàn chỉnh, không dùng markdown fence.
      7. Tạo "actionItems" là checklist markdown, mỗi dòng bắt đầu bằng "- [ ]".

      ${transcriptInstruction}

      Ràng buộc:
      - Output phải là JSON hợp lệ duy nhất.
      - Các trường summary, folderTree, mindmap, actionItems phải có nội dung thực sự.
      - Không tự bịa nội dung ngoài phần có căn cứ từ audio; nếu chưa chắc thì ghi trung tính.
    `.trim();
  }

  if (context === SessionContext.TRANSCRIPTION) {
    return `
      Vai trò: chuyên gia trích xuất transcript từ file audio/video.

      Nhiệm vụ:
      1. Nghe kỹ file audio/video và chép lại đầy đủ vào trường "transcript".
      2. Tạo "title" ngắn theo nội dung chính của file.
      3. Tạo "suggestedFolderName" ngắn gọn, dạng slug.
      4. Các trường "summary", "folderTree", "mindmap", "actionItems" phải là chuỗi rỗng.

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
    4. Các trường "summary", "folderTree", "mindmap", "actionItems" phải là chuỗi rỗng.

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
      folderTree: context === SessionContext.MEETING ? readText(parsed.folderTree) : '',
      mindmap: context === SessionContext.MEETING ? readText(parsed.mindmap) : '',
      actionItems: context === SessionContext.MEETING ? readText(parsed.actionItems) : '',
    },
    savedRecording,
  };
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
    const settings = await loadAiSettings();
    const apiKey = settings.apiKey.trim();
    const modelId = settings.modelId || DEFAULT_MODEL_ID;

    if (!apiKey || apiKey === 'undefined') {
      throw new Error(
        'Vui lòng nhập Gemini API Key trong phần Cài đặt trên thiết bị này trước khi sử dụng.'
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const filePart = await fileToGenerativePart(file);
    const prompt = buildPrompt(mode, context);

    const response = await ai.models.generateContent({
      model: modelId,
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
