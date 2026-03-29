import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  FileAudio,
  Mic,
  Pause,
  Play,
  Square,
  Users,
  Waves,
  X,
} from 'lucide-react';
import { SavedDeviceFile, SessionContext } from '../types';
import {
  createRecordedFile,
  createSessionWorkspaceName,
  saveRecordingToDevice,
  startRecordingStream,
} from '../services/recordingService';

interface StepRecordProps {
  sessionContext: SessionContext;
  setSessionContext: (context: SessionContext) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  savedRecording: SavedDeviceFile | null;
  setSavedRecording: (file: SavedDeviceFile | null) => void;
  onNext: () => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
};

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [hrs, mins, secs]
    .filter((value, index) => value > 0 || index > 0)
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
};

export const StepRecord: React.FC<StepRecordProps> = ({
  sessionContext,
  setSessionContext,
  file,
  setFile,
  savedRecording,
  setSavedRecording,
  onNext,
}) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    'Chọn ngữ cảnh rồi bắt đầu ghi âm phiên mới.'
  );
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((current) => current + 1);
    }, 1000);
  };

  const stopActiveStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearPreview = () => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
  };

  const clearSelectedRecording = () => {
    setFile(null);
    setSavedRecording(null);
    setRecordingSeconds(0);
    setStatusMessage('Đã xoá phiên ghi hiện tại.');
    clearPreview();
  };

  useEffect(() => {
    return () => {
      stopTimer();
      stopActiveStream();
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  const handleStartRecording = async () => {
    try {
      clearSelectedRecording();
      setStatusMessage('Đang xin quyền microphone...');

      const { recorder, stream, mimeType } = await startRecordingStream();
      mediaRecorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || recorder.mimeType || 'audio/webm',
        });

        if (!blob.size) {
          setStatusMessage('Không thu được dữ liệu âm thanh. Vui lòng thử lại.');
          stopActiveStream();
          return;
        }

        const recordedFile = createRecordedFile({
          blob,
          baseLabel:
            sessionContext === SessionContext.MEETING
              ? 'meeting-session'
              : 'interview-session',
        });

        setFile(recordedFile);
        clearPreview();
        setAudioPreviewUrl(URL.createObjectURL(blob));
        setStatusMessage('Đang lưu file ghi âm vào thiết bị...');

        try {
          const savedFile = await saveRecordingToDevice({
            blob,
            fileName: recordedFile.name,
            workspaceName: createSessionWorkspaceName(
              sessionContext === SessionContext.MEETING ? 'meeting-notes' : 'interview-notes'
            ),
          });

          setSavedRecording(savedFile);
          setStatusMessage(`Đã lưu ghi âm vào ${savedFile.path}.`);
        } catch (error: any) {
          console.error('Save recording failed:', error);
          setSavedRecording(null);
          setStatusMessage(
            'Đã ghi âm xong nhưng chưa lưu được file xuống thiết bị. Bạn vẫn có thể tiếp tục xử lý AI.'
          );
        }

        stopActiveStream();
      };

      recorder.start();
      setRecordingSeconds(0);
      startTimer();
      setIsRecording(true);
      setIsPaused(false);
      setStatusMessage('Đang ghi âm trực tiếp...');
    } catch (error: any) {
      console.error('Recording start failed:', error);
      stopTimer();
      setIsRecording(false);
      setIsPaused(false);
      stopActiveStream();
      setStatusMessage(error.message || 'Không thể khởi động ghi âm.');
      alert(error.message || 'Không thể khởi động ghi âm.');
    }
  };

  const handlePauseResume = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === 'recording') {
      recorder.pause();
      stopTimer();
      setIsPaused(true);
      setStatusMessage('Đã tạm dừng ghi âm.');
      return;
    }

    if (recorder.state === 'paused') {
      recorder.resume();
      startTimer();
      setIsPaused(false);
      setStatusMessage('Đã tiếp tục ghi âm.');
    }
  };

  const handleStopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    stopTimer();
    setIsRecording(false);
    setIsPaused(false);
    setStatusMessage('Đang hoàn tất file ghi âm...');
    recorder.stop();
  };

  const contextCards = [
    {
      id: SessionContext.MEETING,
      title: 'Cuộc họp',
      description:
        'Ghi âm rồi sinh transcript, tóm tắt, action items, folder tree và mindmap.',
      icon: BriefcaseBusiness,
    },
    {
      id: SessionContext.INTERVIEW,
      title: 'Phỏng vấn',
      description:
        'Ghi âm rồi chỉ chép lại nội dung phỏng vấn, không tự tạo mindmap hay ghi chú họp.',
      icon: Users,
    },
  ];

  return (
    <div className="flex flex-col items-center w-full animate-fade-in">
      <div className="w-full max-w-6xl grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-6">
        <aside className="rounded-[32px] border border-white/60 bg-slate-950 p-6 md:p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7af2d1]">
            Phân hệ ghi âm
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight">
            Chọn loại phiên trước khi bắt đầu thu
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/68">
            Màn này chỉ phục vụ ghi âm trực tiếp và sinh kết quả theo ngữ cảnh tương ứng.
          </p>

          <div className="mt-8 space-y-4">
            {contextCards.map((item) => {
              const Icon = item.icon;
              const active = sessionContext === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSessionContext(item.id)}
                  disabled={isRecording}
                  className={`w-full rounded-[24px] border p-5 text-left transition-all ${
                    active
                      ? 'border-[#7af2d1] bg-white/10 shadow-lg shadow-black/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  } ${isRecording ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        active ? 'bg-[#7af2d1] text-slate-950' : 'bg-white/10 text-white'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">{item.title}</div>
                      <p className="mt-2 text-sm leading-6 text-white/68">{item.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 md:p-8 shadow-[0_24px_80px_rgba(12,74,60,0.12)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66]">
                Ghi âm trực tiếp
              </p>
              <h3 className="mt-3 text-3xl font-black text-slate-900">
                {isRecording ? 'Đang thu âm phiên làm việc' : 'Micro sẵn sàng'}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                Sau khi kết thúc, app tạo file audio mới, lưu xuống thiết bị rồi chuyển sang bước
                xử lý AI cho đúng loại phiên đã chọn.
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-950 px-5 py-4 text-center text-white shadow-xl shadow-slate-950/15">
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/55">
                Thời lượng
              </div>
              <div className="mt-1 text-3xl font-black tabular-nums">
                {formatDuration(recordingSeconds)}
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleStartRecording}
              disabled={isRecording}
              className={`inline-flex h-14 items-center gap-3 rounded-2xl px-5 font-bold transition-all ${
                isRecording
                  ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                  : 'bg-[#0d7c66] text-white shadow-lg shadow-[#0d7c66]/25 hover:-translate-y-0.5'
              }`}
            >
              <Mic className="h-5 w-5" />
              Bắt đầu ghi âm
            </button>

            <button
              type="button"
              onClick={handlePauseResume}
              disabled={!isRecording}
              className={`inline-flex h-14 items-center gap-3 rounded-2xl border px-5 font-bold transition-colors ${
                isRecording
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
              }`}
            >
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              {isPaused ? 'Tiếp tục' : 'Tạm dừng'}
            </button>

            <button
              type="button"
              onClick={handleStopRecording}
              disabled={!isRecording}
              className={`inline-flex h-14 items-center gap-3 rounded-2xl px-5 font-bold transition-colors ${
                isRecording
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400'
              }`}
            >
              <Square className="h-4 w-4 fill-current" />
              Kết thúc
            </button>
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-[#0d7c66]/10 p-2 text-[#0d7c66]">
                <Waves className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Trạng thái phiên ghi</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">{statusMessage}</p>
                {savedRecording?.path && (
                  <p className="mt-2 break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-slate-600">
                    {savedRecording.path}
                  </p>
                )}
              </div>
            </div>
          </div>

          {file && (
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0d7c66]/10 text-[#0d7c66]">
                    <FileAudio className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{file.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{formatFileSize(file.size)}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearSelectedRecording}
                  className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Ghi lại
                </button>
              </div>

              {audioPreviewUrl && (
                <audio controls src={audioPreviewUrl} className="mt-4 w-full">
                  Trình duyệt không hỗ trợ audio preview.
                </audio>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex w-full max-w-6xl justify-center">
          <button
            onClick={onNext}
            disabled={!file || isRecording}
            className={`flex h-14 w-full items-center justify-center gap-3 rounded-2xl px-6 text-base font-bold uppercase tracking-[0.2em] transition-all md:w-auto md:min-w-[280px] ${
              file && !isRecording
                ? 'bg-[#0d7c66] text-white shadow-lg shadow-[#0d7c66]/25 hover:-translate-y-0.5'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            }`}
          >
            Cấu hình AI
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="h-24 md:hidden" />
    </div>
  );
};
