import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  FileAudio,
  ListChecks,
  Mic,
  Pause,
  Play,
  ShieldAlert,
  Sparkles,
  Square,
  Users,
  Waves,
  X,
} from 'lucide-react';
import { SavedDeviceFile, SessionContext } from '../types';
import {
  DEFAULT_REALTIME_MODE,
  RealtimeMode,
  loadAiSettings,
} from '../services/aiSettingsService';
import { processRealtimeMeetingChunk } from '../services/geminiService';
import {
  createRecordedFile,
  createSessionWorkspaceName,
  saveRecordingToDevice,
  startRecordingStream,
} from '../services/recordingService';
import { AttachmentManager } from './AttachmentManager';

interface StepRecordProps {
  sessionContext: SessionContext;
  setSessionContext: (context: SessionContext) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  savedRecording: SavedDeviceFile | null;
  setSavedRecording: (file: SavedDeviceFile | null) => void;
  additionalFiles: File[];
  setAdditionalFiles: (files: File[]) => void;
  onNext: () => void;
}

interface LiveMeetingState {
  status: 'idle' | 'disabled' | 'listening' | 'processing' | 'error';
  statusMessage: string;
  processedChunks: number;
  transcriptPreview: string;
  summaryPreview: string;
  decisionsPreview: string;
  risksPreview: string;
  actionItemsPreview: string;
  errorMessage?: string;
}

const LIVE_CHUNK_TIMESLICE_MS = 15000;
const STORAGE_CHUNK_TIMESLICE_MS = 60000;

const createEmptyLiveMeetingState = (statusMessage: string): LiveMeetingState => ({
  status: 'idle',
  statusMessage,
  processedChunks: 0,
  transcriptPreview: '',
  summaryPreview: '',
  decisionsPreview: '',
  risksPreview: '',
  actionItemsPreview: '',
});

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

const appendTranscriptChunk = (current: string, incoming: string) => {
  const next = incoming.trim();
  if (!next) return current;
  return current ? `${current.trim()}\n${next}` : next;
};

export const StepRecord: React.FC<StepRecordProps> = ({
  sessionContext,
  setSessionContext,
  file,
  setFile,
  savedRecording,
  setSavedRecording,
  additionalFiles,
  setAdditionalFiles,
  onNext,
}) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const liveChunkQueueRef = useRef<Blob[]>([]);
  const liveChunkProcessingRef = useRef(false);
  const liveChunkIndexRef = useRef(0);
  const realtimeModeRef = useRef<RealtimeMode>(DEFAULT_REALTIME_MODE);
  const isRecordingRef = useRef(false);
  const liveMeetingStateRef = useRef<LiveMeetingState>(
    createEmptyLiveMeetingState('Realtime note đang chờ phiên ghi cuộc họp.')
  );

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    'Chọn ngữ cảnh rồi bắt đầu ghi âm phiên mới.'
  );
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [liveMeetingState, setLiveMeetingState] = useState<LiveMeetingState>(
    createEmptyLiveMeetingState('Realtime note đang chờ phiên ghi cuộc họp.')
  );

  useEffect(() => {
    liveMeetingStateRef.current = liveMeetingState;
  }, [liveMeetingState]);

  const resetLiveMeetingState = (message: string) => {
    liveChunkQueueRef.current = [];
    liveChunkProcessingRef.current = false;
    liveChunkIndexRef.current = 0;
    const nextState = createEmptyLiveMeetingState(message);
    liveMeetingStateRef.current = nextState;
    setLiveMeetingState(nextState);
  };

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

  const processQueuedMeetingChunks = async () => {
    if (liveChunkProcessingRef.current || sessionContext !== SessionContext.MEETING) {
      return;
    }

    const nextChunk = liveChunkQueueRef.current.shift();
    if (!nextChunk) {
      setLiveMeetingState((current) => ({
        ...current,
        status: isRecordingRef.current ? 'listening' : current.status,
        statusMessage: isRecordingRef.current
          ? 'Realtime note đang chờ đoạn ghi tiếp theo.'
          : current.statusMessage,
      }));
      return;
    }

    liveChunkProcessingRef.current = true;
    const nextIndex = liveChunkIndexRef.current + 1;
    liveChunkIndexRef.current = nextIndex;

    setLiveMeetingState((current) => ({
      ...current,
      status: 'processing',
      statusMessage: `AI đang cập nhật từ đoạn ghi số ${nextIndex}...`,
      errorMessage: undefined,
    }));

    try {
      const liveChunkFile = createRecordedFile({
        blob: nextChunk,
        baseLabel: `meeting-live-chunk-${nextIndex}`,
      });

      const result = await processRealtimeMeetingChunk({
        file: liveChunkFile,
        previousSummary: liveMeetingStateRef.current.summaryPreview,
        previousDecisions: liveMeetingStateRef.current.decisionsPreview,
        previousRisks: liveMeetingStateRef.current.risksPreview,
        previousActionItems: liveMeetingStateRef.current.actionItemsPreview,
        realtimeMode: realtimeModeRef.current,
      });

      setLiveMeetingState((current) => ({
        ...current,
        status: isRecordingRef.current ? 'listening' : 'processing',
        statusMessage: isRecordingRef.current
          ? `Realtime note đã cập nhật ${nextIndex} đoạn ghi.`
          : 'Đang hoàn tất các cập nhật AI cuối cùng...',
        processedChunks: nextIndex,
        transcriptPreview: appendTranscriptChunk(current.transcriptPreview, result.transcriptChunk),
        summaryPreview: result.rollingSummary || current.summaryPreview,
        decisionsPreview: result.decisions || current.decisionsPreview,
        risksPreview: result.risks || current.risksPreview,
        actionItemsPreview: result.actionItems || current.actionItemsPreview,
        errorMessage: undefined,
      }));
    } catch (error: any) {
      setLiveMeetingState((current) => ({
        ...current,
        status: 'error',
        statusMessage: 'Realtime note gặp lỗi, bản ghi chính vẫn có thể xử lý sau khi dừng ghi âm.',
        errorMessage: error?.message || 'Không thể cập nhật realtime.',
      }));
    } finally {
      liveChunkProcessingRef.current = false;
      if (liveChunkQueueRef.current.length > 0) {
        void processQueuedMeetingChunks();
      }
    }
  };

  const enqueueLiveChunk = (blob: Blob) => {
    if (!blob.size || sessionContext !== SessionContext.MEETING) {
      return;
    }

    liveChunkQueueRef.current.push(blob);
    void processQueuedMeetingChunks();
  };

  const clearSelectedRecording = () => {
    setFile(null);
    setSavedRecording(null);
    setRecordingSeconds(0);
    setStatusMessage('Đã xoá phiên ghi hiện tại.');
    resetLiveMeetingState('Realtime note đang chờ phiên ghi cuộc họp.');
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

  useEffect(() => {
    if (sessionContext === SessionContext.INTERVIEW && !isRecording) {
      resetLiveMeetingState('Phỏng vấn chỉ ghi âm và chép transcript sau khi kết thúc.');
    }

    if (sessionContext === SessionContext.MEETING && !isRecording && !file) {
      resetLiveMeetingState('Realtime note đang chờ phiên ghi cuộc họp.');
    }
  }, [file, isRecording, sessionContext]);

  const handleStartRecording = async () => {
    try {
      clearSelectedRecording();
      setStatusMessage('Đang xin quyền microphone...');
      let realtimeEnabled = false;
      let realtimeMode: RealtimeMode = DEFAULT_REALTIME_MODE;

      if (sessionContext === SessionContext.MEETING) {
        const settings = await loadAiSettings();
        realtimeMode = settings.realtimeMode;
        realtimeModeRef.current = realtimeMode;
        realtimeEnabled = realtimeMode !== 'OFF' && Boolean(settings.apiKey.trim());
        resetLiveMeetingState(
          realtimeEnabled
            ? realtimeMode === 'HYBRID'
              ? 'Realtime đang chạy HYBRID: cập nhật transcript + summary nhanh theo từng chunk.'
              : 'Realtime đang chạy FULL: cập nhật đầy đủ notes theo từng chunk.'
            : realtimeMode === 'OFF'
              ? 'Realtime đang tắt theo cài đặt. App sẽ phân tích 1 lần khi kết thúc phiên.'
              : 'Chưa có Gemini API Key nên realtime note đang tắt. Bạn vẫn có thể ghi âm và xử lý đầy đủ sau khi kết thúc.'
        );

        if (!realtimeEnabled) {
          setLiveMeetingState((current) => ({
            ...current,
            status: 'disabled',
          }));
        }
      } else {
        realtimeModeRef.current = DEFAULT_REALTIME_MODE;
        resetLiveMeetingState('Phỏng vấn chỉ ghi âm và chép transcript sau khi kết thúc.');
      }

      const { recorder, stream, mimeType } = await startRecordingStream();
      mediaRecorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          if (sessionContext === SessionContext.MEETING && realtimeEnabled) {
            enqueueLiveChunk(event.data);
          }
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

        if (sessionContext === SessionContext.MEETING) {
          setLiveMeetingState((current) => ({
            ...current,
            status:
              current.status === 'disabled'
                ? 'disabled'
                : liveChunkQueueRef.current.length > 0 || liveChunkProcessingRef.current
                  ? 'processing'
                  : 'listening',
            statusMessage:
              current.status === 'disabled'
                ? current.statusMessage
                : liveChunkQueueRef.current.length > 0 || liveChunkProcessingRef.current
                  ? 'Đang hoàn tất các cập nhật realtime cuối cùng trước khi bạn sang bước AI đầy đủ.'
                  : 'Realtime note đã cập nhật xong cho phiên ghi hiện tại.',
          }));
        }

        stopActiveStream();
      };

      if (sessionContext === SessionContext.MEETING) {
        recorder.start(LIVE_CHUNK_TIMESLICE_MS);
      } else {
        recorder.start(STORAGE_CHUNK_TIMESLICE_MS);
      }

      setRecordingSeconds(0);
      startTimer();
      setIsRecording(true);
      isRecordingRef.current = true;
      setIsPaused(false);
      setStatusMessage('Đang ghi âm trực tiếp...');
    } catch (error: any) {
      console.error('Recording start failed:', error);
      stopTimer();
      setIsRecording(false);
      isRecordingRef.current = false;
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
    isRecordingRef.current = false;
    setIsPaused(false);
    setStatusMessage('Đang hoàn tất file ghi âm...');
    recorder.stop();
  };

  const contextCards = [
    {
      id: SessionContext.MEETING,
      title: 'Cuộc họp',
      description:
        'Ghi âm rồi sinh transcript, tóm tắt, decisions, risks, action items, folder tree và mindmap.',
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

  const showLivePanel = sessionContext === SessionContext.MEETING;

  return (
    <div className="flex flex-col items-center w-full animate-fade-in">
      <div className="w-full max-w-6xl grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-6">
        <aside className="rounded-[32px] border border-white/60 bg-slate-950 p-6 md:p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7af2d1]">
            Phân hệ ghi âm
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight md:text-3xl">
            Chọn loại phiên ghi
          </h2>
          <p className="mt-3 hidden text-sm leading-7 text-white/68 md:block">
            Cuộc họp sẽ có realtime note, phỏng vấn chỉ ghi và chép transcript.
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
                  className={`w-full rounded-[20px] border p-4 text-left transition-all ${
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
                      <p className="mt-1 hidden text-sm leading-6 text-white/68 md:block">{item.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {showLivePanel && (
            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3 text-[#7af2d1]">
                <Sparkles className="h-5 w-5" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.28em]">
                  Live meeting notes
                </span>
              </div>
              <p className="mt-3 hidden text-sm leading-6 text-white/68 md:block">
                Realtime chạy theo từng chunk khoảng 15 giây. Ở mode Hybrid, phần realtime chỉ cập nhật
                transcript + summary nhanh; sau khi dừng ghi, bước AI đầy đủ vẫn chạy lại trên toàn bộ file.
              </p>
              <div className="mt-4 rounded-2xl bg-white/[0.06] px-4 py-4 text-sm leading-6 text-white/75">
                {liveMeetingState.statusMessage}
                {liveMeetingState.errorMessage && (
                  <div className="mt-2 text-rose-300">{liveMeetingState.errorMessage}</div>
                )}
              </div>
            </div>
          )}
        </aside>

        <section className="rounded-[32px] border border-white/60 bg-white/90 p-6 md:p-8 shadow-[0_24px_80px_rgba(12,74,60,0.12)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66]">
                Ghi âm trực tiếp
              </p>
              <h3 className="mt-3 text-2xl font-black text-slate-900 md:text-3xl">
                {isRecording ? 'Đang thu âm phiên làm việc' : 'Micro sẵn sàng'}
              </h3>
              <p className="mt-3 hidden max-w-2xl text-sm leading-7 text-slate-500 md:block">
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

          {showLivePanel && (
            <div className="mt-6 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fffc,white)] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0d7c66]">
                    Realtime meeting note
                  </div>
                  <div className="mt-2 text-xl font-black text-slate-900">
                    Transcript và ghi chú đang cập nhật dần
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                  <Sparkles className="h-4 w-4 text-[#7af2d1]" />
                  {liveMeetingState.processedChunks} đoạn đã xử lý
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="text-sm font-bold text-slate-900">Transcript preview</div>
                  <div className="mt-3 max-h-64 overflow-auto rounded-2xl bg-slate-50 px-4 py-4 font-mono text-xs leading-6 text-slate-700">
                    {liveMeetingState.transcriptPreview || 'Chưa có transcript realtime.'}
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="text-sm font-bold text-slate-900">Rolling summary</div>
                  <div className="mt-3 max-h-64 overflow-auto rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                    {liveMeetingState.summaryPreview || 'Chưa có tóm tắt realtime.'}
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <ListChecks className="h-4 w-4 text-[#0d7c66]" />
                    Decisions & action items
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                      {liveMeetingState.decisionsPreview || 'Chưa có quyết định nào được tách riêng.'}
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                      {liveMeetingState.actionItemsPreview || 'Chưa có action item realtime.'}
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    Risks / blockers
                  </div>
                  <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                    {liveMeetingState.risksPreview || 'Chưa có rủi ro hoặc blocker nào được phát hiện.'}
                  </div>
                </div>
              </div>
            </div>
          )}

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

        <AttachmentManager
          additionalFiles={additionalFiles}
          setAdditionalFiles={setAdditionalFiles}
        />
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
