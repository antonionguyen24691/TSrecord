import React from 'react';
import {
  AlignLeft,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Mic,
  Play,
  Upload,
} from 'lucide-react';
import {
  AppModule,
  ExtractionMode,
  InputSource,
  SessionContext,
} from '../types';

interface StepModeProps {
  module: AppModule;
  mode: ExtractionMode;
  setMode: (mode: ExtractionMode) => void;
  source: InputSource;
  sessionContext: SessionContext;
  fileName?: string;
  savedRecordingPath?: string | null;
  onNext: () => void;
  onBack: () => void;
  isProcessing: boolean;
}

const getContextLabel = (context: SessionContext) => {
  if (context === SessionContext.MEETING) return 'Cuộc họp';
  if (context === SessionContext.INTERVIEW) return 'Phỏng vấn';
  return 'Trích xuất transcript';
};

export const StepMode: React.FC<StepModeProps> = ({
  module,
  mode,
  setMode,
  source,
  sessionContext,
  fileName,
  savedRecordingPath,
  onNext,
  onBack,
  isProcessing,
}) => {
  const isMeeting = sessionContext === SessionContext.MEETING;
  const isInterview = sessionContext === SessionContext.INTERVIEW;

  const deliverables = isMeeting
    ? ['Transcript', 'Tóm tắt', 'Decisions', 'Risks', 'Folder tree', 'Mindmap', 'Checklist']
    : ['Transcript'];

  const summaryText =
    isMeeting
      ? source === InputSource.UPLOAD
        ? 'File tải lên sẽ được phân tích như một phiên họp hoàn chỉnh: transcript, summary, decisions, risks, folder tree và mindmap.'
        : 'Nhánh này sẽ chép lại, tóm tắt, tách quyết định và rủi ro, dựng folder tree đề xuất và mindmap hệ thống từ cùng một bản ghi.'
      : isInterview
        ? 'Nhánh này chỉ tập trung vào transcript rõ ràng cho bản phỏng vấn, không dựng thêm cấu trúc hệ thống.'
        : 'Phân hệ này chỉ tập trung vào transcript sạch từ file có sẵn, không gắn note họp hay mindmap.';

  return (
    <div className="flex flex-col items-center w-full max-w-6xl animate-fade-in">
      <div className="w-full rounded-[32px] border border-white/60 bg-white/90 p-6 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66]">
              Bước xử lý
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-900">
              Chọn định dạng transcript
            </h2>
            <p className="mt-3 hidden max-w-2xl text-sm leading-6 text-slate-500 md:block">
              Chọn timeline hoặc văn bản liền mạch, sau đó chạy AI.
            </p>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm">
                  {source === InputSource.RECORDING ? (
                    <Mic className="h-4 w-4 text-[#0d7c66]" />
                  ) : (
                    <Upload className="h-4 w-4 text-[#0d7c66]" />
                  )}
                  {source === InputSource.RECORDING ? 'Nguồn: Ghi âm trực tiếp' : 'Nguồn: File có sẵn'}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm">
                  {module === AppModule.RECORD_NOTES ? 'Module: Ghi âm & ghi chú' : 'Module: Trích xuất ghi âm'}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm">
                  Ngữ cảnh: {getContextLabel(sessionContext)}
                </span>
              </div>

              {fileName && (
                <p className="mt-4 break-all text-sm text-slate-500">
                  Đầu vào hiện tại: <span className="font-semibold text-slate-800">{fileName}</span>
                </p>
              )}

              {savedRecordingPath && (
                <p className="mt-2 break-all rounded-xl bg-white px-3 py-3 font-mono text-xs text-slate-600">
                  File đã lưu: {savedRecordingPath}
                </p>
              )}
            </div>
          </div>

          <aside className="rounded-[28px] bg-slate-950 p-6 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7af2d1]">
              Deliverables
            </div>
            <div className="mt-3 text-2xl font-black">
              {module === AppModule.TRANSCRIBE
                ? isMeeting
                  ? 'Biên bản họp từ file'
                  : isInterview
                    ? 'Transcript phỏng vấn từ file'
                    : 'Transcript từ file'
                : isMeeting
                  ? 'Phiên cuộc họp đầy đủ'
                  : 'Phiên transcript phỏng vấn'}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {deliverables.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80"
                >
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-4 hidden text-sm leading-6 text-white/68 md:block">{summaryText}</p>
          </aside>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => !isProcessing && setMode(ExtractionMode.TIMELINE)}
            className={`rounded-[28px] border-2 p-6 text-left transition-all ${
              mode === ExtractionMode.TIMELINE
                ? 'border-[#0d7c66] bg-[#0d7c66]/5 shadow-lg shadow-[#0d7c66]/10'
                : 'border-slate-200 bg-white hover:border-slate-300'
            } ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  mode === ExtractionMode.TIMELINE
                    ? 'bg-[#0d7c66] text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Clock className="h-6 w-6" />
              </div>
              {mode === ExtractionMode.TIMELINE && (
                <CheckCircle2 className="h-6 w-6 text-[#0d7c66]" />
              )}
            </div>

            <div className="mt-5 text-xl font-bold text-slate-900">Transcript có timeline</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Giữ mốc thời gian cho từng đoạn nói, phù hợp khi cần tra cứu lại nhanh trong file
              gốc hoặc buổi ghi âm dài.
            </p>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 font-mono text-xs text-slate-600">
              [00:14:08] Người A: Chúng ta chốt đầu mục API ở sprint này.
            </div>
          </button>

          <button
            type="button"
            onClick={() => !isProcessing && setMode(ExtractionMode.PLAIN)}
            className={`rounded-[28px] border-2 p-6 text-left transition-all ${
              mode === ExtractionMode.PLAIN
                ? 'border-[#0d7c66] bg-[#0d7c66]/5 shadow-lg shadow-[#0d7c66]/10'
                : 'border-slate-200 bg-white hover:border-slate-300'
            } ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  mode === ExtractionMode.PLAIN
                    ? 'bg-[#0d7c66] text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <AlignLeft className="h-6 w-6" />
              </div>
              {mode === ExtractionMode.PLAIN && (
                <CheckCircle2 className="h-6 w-6 text-[#0d7c66]" />
              )}
            </div>

            <div className="mt-5 text-xl font-bold text-slate-900">Transcript văn bản liền mạch</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Làm sạch câu chữ, bỏ tiếng đệm không cần thiết và đưa ra bản đọc liên tục phù hợp
              để chia sẻ nhanh hoặc đưa vào tài liệu nội bộ.
            </p>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Bản transcript sẽ được nhóm theo đoạn, dễ dùng cho email hoặc biên bản chính thức.
            </div>
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex w-full max-w-6xl gap-3">
          <button
            onClick={onBack}
            disabled={isProcessing}
            className="h-14 flex-1 rounded-2xl border border-slate-300 bg-white px-5 font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 md:flex-none md:w-40"
          >
            <span className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </span>
          </button>

          <button
            onClick={onNext}
            disabled={isProcessing}
            className={`h-14 flex-[2] rounded-2xl px-5 font-bold uppercase tracking-[0.2em] transition-all md:flex-none md:min-w-[320px] ${
              isProcessing
                ? 'cursor-wait border border-slate-200 bg-slate-100 text-slate-500'
                : 'bg-[#0d7c66] text-white shadow-lg shadow-[#0d7c66]/25 hover:-translate-y-0.5'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-3">
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Đang xử lý AI
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 fill-current" />
                  Chạy phân tích
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      <div className="h-24 md:hidden" />
    </div>
  );
};
