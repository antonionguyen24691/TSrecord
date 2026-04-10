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
  return (
    <div className="flex flex-col items-center w-full max-w-6xl animate-fade-in">
      <div className="w-full rounded-[32px] border border-white/60 bg-white/90 p-5 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66]">
              Bước xử lý
            </p>
            <h2 className="mt-3 text-2xl font-black text-slate-900">
              Chọn định dạng transcript
            </h2>
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
