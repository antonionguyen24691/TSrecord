import React from 'react';
import {
  AlignLeft,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Mic,
  Play,
  Upload,
} from 'lucide-react';
import { AppModule, ExtractionMode, InputSource, ProcessingState, SessionContext } from '../types';

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
  processingState: ProcessingState;
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
  processingState,
}) => {
  const progressPercent =
    processingState.progressCurrent !== undefined &&
    processingState.progressTotal &&
    processingState.progressTotal > 0
      ? Math.min(100, Math.round((processingState.progressCurrent / processingState.progressTotal) * 100))
      : null;

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
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600 border border-slate-200 uppercase tracking-wider">
                Nguồn: {source === 'RECORDING' ? 'Ghi âm' : 'Tải lên'}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-100 uppercase tracking-wider">
                Module: {module === AppModule.RECORD_NOTES ? 'Ghi âm' : 'Upload'}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700 border border-blue-100 uppercase tracking-wider">
                Ngữ cảnh: {getContextLabel(sessionContext)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              onClick={() => setMode('TIMELINE')}
              className={`relative flex flex-col items-start gap-3 rounded-3xl border-2 p-6 transition-all ${
                mode === 'TIMELINE'
                  ? 'border-[#0d7c66] bg-emerald-50/30'
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                mode === 'TIMELINE' ? 'bg-[#0d7c66] text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <Clock className="h-6 w-6" />
              </div>
              <div className="text-left font-bold text-slate-900">Timeline</div>
              {mode === 'TIMELINE' && (
                <div className="absolute right-4 top-4 text-[#0d7c66]">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              )}
            </button>

            <button
              onClick={() => setMode('PLAIN')}
              className={`relative flex flex-col items-start gap-3 rounded-3xl border-2 p-6 transition-all ${
                mode === 'PLAIN'
                  ? 'border-[#0d7c66] bg-emerald-50/30'
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                mode === 'PLAIN' ? 'bg-[#0d7c66] text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <AlignLeft className="h-6 w-6" />
              </div>
              <div className="text-left font-bold text-slate-900">Plain text</div>
              {mode === 'PLAIN' && (
                <div className="absolute right-4 top-4 text-[#0d7c66]">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              )}
            </button>
          </div>
        </div>

        {isProcessing && (
          <div className="mt-6 rounded-[28px] border border-emerald-200 bg-[linear-gradient(145deg,#f4fffb,#ffffff)] p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0d7c66]">
                  Tiến trình xử lý
                </div>
                <div className="mt-2 text-lg font-black text-slate-900">
                  {processingState.stageLabel || 'Đang khởi tạo pipeline...'}
                </div>
                {processingState.progressLabel && (
                  <div className="mt-2 text-sm text-slate-600">{processingState.progressLabel}</div>
                )}
              </div>

              {processingState.phase && (
                <div className="inline-flex h-fit items-center rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">
                  {processingState.phase}
                </div>
              )}
            </div>

            {progressPercent !== null && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  <span>Tiến độ</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#0d7c66] transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {processingState.chunkStatuses && processingState.chunkStatuses.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {processingState.chunkStatuses.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-bold text-slate-900">{chunk.label}</div>
                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                          chunk.status === 'done'
                            ? 'bg-emerald-100 text-emerald-700'
                            : chunk.status === 'processing'
                              ? 'bg-blue-100 text-blue-700'
                              : chunk.status === 'waiting'
                                ? 'bg-amber-100 text-amber-700'
                                : chunk.status === 'error'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {chunk.status === 'done' ? <Check className="h-3 w-3" /> : null}
                        {chunk.status}
                      </div>
                    </div>
                    {chunk.detail && (
                      <div className="mt-2 text-xs leading-5 text-slate-500">{chunk.detail}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
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
