import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  CloudUpload,
  FileAudio,
  FileText,
  FileVideo,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { SessionContext } from '../types';

interface StepUploadProps {
  sessionContext: SessionContext;
  setSessionContext: (context: SessionContext) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  onNext: () => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
};

export const StepUpload: React.FC<StepUploadProps> = ({
  sessionContext,
  setSessionContext,
  file,
  setFile,
  onNext,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const contextOptions = [
    {
      id: SessionContext.TRANSCRIPTION,
      title: 'Chỉ trích transcript',
      description: 'Phù hợp khi bạn chỉ cần bản chép lời sạch từ file audio/video có sẵn.',
      icon: FileText,
    },
    {
      id: SessionContext.MEETING,
      title: 'Phân tích thành biên bản họp',
      description: 'Sinh transcript, summary, decisions, risks, action items, folder tree và mindmap từ file đã tải lên.',
      icon: BriefcaseBusiness,
    },
    {
      id: SessionContext.INTERVIEW,
      title: 'Chép nội dung phỏng vấn',
      description: 'Giữ luồng transcript gọn cho bản ghi phỏng vấn đã có sẵn.',
      icon: Users,
    },
  ];

  const validateAndSetFile = (uploadedFile: File) => {
    if (
      uploadedFile.type.startsWith('audio/') ||
      uploadedFile.type.startsWith('video/')
    ) {
      setFile(uploadedFile);
    } else {
      alert('Định dạng không hỗ trợ. Vui lòng chọn file audio hoặc video.');
    }
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (event.dataTransfer.files?.[0]) {
      validateAndSetFile(event.dataTransfer.files[0]);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      validateAndSetFile(event.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center w-full animate-fade-in">
      <div className="w-full max-w-5xl rounded-[36px] border border-white/60 bg-white/90 p-6 md:p-8 shadow-[0_28px_90px_rgba(15,23,42,0.10)]">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66]">
            Phân hệ trích xuất
          </p>
          <h2 className="mt-3 text-3xl font-black text-slate-900">
            Nhập file có sẵn để trích xuất transcript
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            Đây là luồng xử lý hậu kỳ từ audio/video đã có. Bạn có thể chỉ lấy transcript hoặc dùng
            chính file tải lên để sinh biên bản họp đầy đủ.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {contextOptions.map((item) => {
            const Icon = item.icon;
            const active = sessionContext === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSessionContext(item.id)}
                className={`rounded-[26px] border p-5 text-left transition-all ${
                  active
                    ? 'border-[#0d7c66] bg-[#0d7c66]/5 shadow-lg shadow-[#0d7c66]/10'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    active ? 'bg-[#0d7c66] text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-4 text-lg font-bold text-slate-900">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
              </button>
            );
          })}
        </div>

        {!file ? (
          <div
            className={`mt-8 rounded-[32px] border-2 border-dashed p-8 md:p-10 transition-all ${
              dragActive
                ? 'border-[#0d7c66] bg-[#0d7c66]/5'
                : 'border-slate-300 bg-[linear-gradient(145deg,#ffffff,#f4fbf8_52%,#eef7ff)] hover:border-[#0d7c66]'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="audio/*,video/*"
                onChange={handleChange}
                onClick={(event) => {
                  (event.target as HTMLInputElement).value = '';
                }}
              />

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#0d7c66]/10 text-[#0d7c66]">
                <CloudUpload className="h-10 w-10" />
              </div>
              <div className="mt-6 text-2xl font-black text-slate-900">Chọn file audio / video</div>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                Hỗ trợ MP3, WAV, M4A, MP4 và các định dạng audio/video phổ biến. Bạn cũng có thể
                kéo thả trực tiếp vào vùng này.
              </p>
            </button>
          </div>
        ) : (
          <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0d7c66]/10 text-[#0d7c66]">
                  {file.type.startsWith('video/') ? (
                    <FileVideo className="h-7 w-7" />
                  ) : (
                    <FileAudio className="h-7 w-7" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{file.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{formatFileSize(file.size)}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFile(null)}
                className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                Bỏ file
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white">
          <div className="flex items-center gap-3 text-[#7af2d1]">
            <Upload className="h-5 w-5" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em]">
              Output của module này
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/82">
              Transcript
            </span>
            {sessionContext === SessionContext.MEETING ? (
              <>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/82">
                  Summary
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/82">
                  Decisions / Risks
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/82">
                  Folder tree / Mindmap
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/82">
                  Timeline hoặc plain text
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/82">
                  {sessionContext === SessionContext.INTERVIEW ? 'Transcript phỏng vấn' : 'Không sinh note họp'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex w-full max-w-5xl justify-center">
          <button
            onClick={onNext}
            disabled={!file}
            className={`flex h-14 w-full items-center justify-center gap-3 rounded-2xl px-6 text-base font-bold uppercase tracking-[0.2em] transition-all md:w-auto md:min-w-[280px] ${
              file
                ? 'bg-[#0d7c66] text-white shadow-lg shadow-[#0d7c66]/25 hover:-translate-y-0.5'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            }`}
          >
            Chọn định dạng
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="h-24 md:hidden" />
    </div>
  );
};
