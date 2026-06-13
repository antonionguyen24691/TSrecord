import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    createEmptyLiveMeetingState(t('StepRecord.status.waitingMeeting'))
  );

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    t('StepRecord.recording.description')
  );
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [liveMeetingState, setLiveMeetingState] = useState<LiveMeetingState>(
    createEmptyLiveMeetingState(t('StepRecord.status.waitingMeeting'))
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
          ? t('StepRecord.status.nextChunkWaiting')
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
      statusMessage: t('StepRecord.status.processingChunk', { index: nextIndex }),
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
          ? t('StepRecord.status.updatedChunks', { count: nextIndex })
          : t('StepRecord.status.finalizingRealtime'),
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
        statusMessage: t('StepRecord.status.realtimeError'),
        errorMessage: error?.message || t('StepRecord.status.realtimeUpdateFailed'),
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
    setStatusMessage(t('StepRecord.status.cleared'));
    resetLiveMeetingState(t('StepRecord.status.waitingMeeting'));
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
      resetLiveMeetingState(t('StepRecord.status.waitingInterview'));
    }

    if (sessionContext === SessionContext.MEETING && !isRecording && !file) {
      resetLiveMeetingState(t('StepRecord.status.waitingMeeting'));
    }
  }, [file, isRecording, sessionContext, t]);

  const handleStartRecording = async () => {
    try {
      clearSelectedRecording();
      setStatusMessage(t('StepRecord.status.requestingMic'));
      let realtimeEnabled = false;
      let realtimeMode: RealtimeMode = DEFAULT_REALTIME_MODE;

      if (sessionContext === SessionContext.MEETING) {
        const settings = await loadAiSettings();
        realtimeMode = settings.realtimeMode;
        realtimeModeRef.current = realtimeMode;
        // Khi dung key admin qua proxy (luon dung tren web demo), khong co apiKey
        // cuc bo nhung van duoc phep realtime vi key nam o backend.
        realtimeEnabled =
          realtimeMode !== 'OFF' && (Boolean(settings.apiKey.trim()) || settings.useAdminKey);
        resetLiveMeetingState(
          realtimeEnabled
            ? realtimeMode === 'HYBRID'
              ? t('StepRecord.status.hybridReady')
              : t('StepRecord.status.fullReady')
            : realtimeMode === 'OFF'
              ? t('StepRecord.status.offBySettings')
              : t('StepRecord.status.missingApiKey')
        );

        if (!realtimeEnabled) {
          setLiveMeetingState((current) => ({
            ...current,
            status: 'disabled',
          }));
        }
      } else {
        realtimeModeRef.current = DEFAULT_REALTIME_MODE;
        resetLiveMeetingState(t('StepRecord.status.waitingInterview'));
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
          setStatusMessage(t('StepRecord.status.noAudioData'));
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
        setStatusMessage(t('StepRecord.status.savingRecording'));

        try {
          const savedFile = await saveRecordingToDevice({
            blob,
            fileName: recordedFile.name,
            workspaceName: createSessionWorkspaceName(
              sessionContext === SessionContext.MEETING ? 'meeting-notes' : 'interview-notes'
            ),
          });

          setSavedRecording(savedFile);
          setStatusMessage(t('StepRecord.status.savedRecording', { path: savedFile.path }));
        } catch (error: any) {
          console.error('Save recording failed:', error);
          setSavedRecording(null);
          setStatusMessage(t('StepRecord.status.saveRecordingFailed'));
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
                  ? t('StepRecord.status.realtimeFinalPass')
                  : t('StepRecord.status.realtimeDone'),
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
      setStatusMessage(t('StepRecord.status.recordingNow'));
    } catch (error: any) {
      console.error('Recording start failed:', error);
      stopTimer();
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsPaused(false);
      stopActiveStream();
      setStatusMessage(error.message || t('StepRecord.status.startFailed'));
      alert(error.message || t('StepRecord.status.startFailed'));
    }
  };

  const handlePauseResume = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === 'recording') {
      recorder.pause();
      stopTimer();
      setIsPaused(true);
      setStatusMessage(t('StepRecord.status.paused'));
      return;
    }

    if (recorder.state === 'paused') {
      recorder.resume();
      startTimer();
      setIsPaused(false);
      setStatusMessage(t('StepRecord.status.resumed'));
    }
  };

  const handleStopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    stopTimer();
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsPaused(false);
    setStatusMessage(t('StepRecord.status.finalizingRecording'));
    recorder.stop();
  };

  const contextCards = [
    {
      id: SessionContext.MEETING,
      title: t('StepRecord.contexts.meetingTitle'),
      description: t('StepRecord.contexts.meetingDescription'),
      icon: BriefcaseBusiness,
    },
    {
      id: SessionContext.INTERVIEW,
      title: t('StepRecord.contexts.interviewTitle'),
      description: t('StepRecord.contexts.interviewDescription'),
      icon: Users,
    },
  ];

  const showLivePanel = sessionContext === SessionContext.MEETING;

  return (
    <div className="flex flex-col items-center w-full animate-fade-in">
      <div className="w-full max-w-6xl grid grid-cols-1 xl:grid-cols-[0.92fr_1.08fr] gap-6">
        <aside className="rounded-[32px] border border-white/60 bg-slate-950 p-6 md:p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7af2d1]">
            {t('StepRecord.tag')}
          </p>
          <h2 className="mt-3 text-2xl font-black leading-tight md:text-3xl">
            {t('StepRecord.title')}
          </h2>
          <p className="mt-3 hidden text-sm leading-7 text-white/68 md:block">
            {t('StepRecord.description')}
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
                  {t('StepRecord.liveCard.title')}
                </span>
              </div>
              <p className="mt-3 hidden text-sm leading-6 text-white/68 md:block">
                {t('StepRecord.liveCard.description')}
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
                {t('StepRecord.recording.tag')}
              </p>
              <h3 className="mt-3 text-2xl font-black text-slate-900 md:text-3xl">
                {isRecording
                  ? t('StepRecord.recording.activeTitle')
                  : t('StepRecord.recording.idleTitle')}
              </h3>
              <p className="mt-3 hidden max-w-2xl text-sm leading-7 text-slate-500 md:block">
                {t('StepRecord.recording.description')}
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-950 px-5 py-4 text-center text-white shadow-xl shadow-slate-950/15">
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/55">
                {t('StepRecord.recording.duration')}
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
              {t('StepRecord.recording.start')}
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
              {isPaused ? t('StepRecord.recording.resume') : t('StepRecord.recording.pause')}
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
              {t('StepRecord.recording.stop')}
            </button>
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-[#0d7c66]/10 p-2 text-[#0d7c66]">
                <Waves className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {t('StepRecord.recording.statusTitle')}
                </div>
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
                    {t('StepRecord.livePanel.title')}
                  </div>
                  <div className="mt-2 text-xl font-black text-slate-900">
                    {t('StepRecord.livePanel.subtitle')}
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                  <Sparkles className="h-4 w-4 text-[#7af2d1]" />
                  {t('StepRecord.livePanel.processedChunks', { count: liveMeetingState.processedChunks })}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="text-sm font-bold text-slate-900">{t('StepRecord.livePanel.transcriptPreview')}</div>
                  <div className="mt-3 max-h-64 overflow-auto rounded-2xl bg-slate-50 px-4 py-4 font-mono text-xs leading-6 text-slate-700">
                    {liveMeetingState.transcriptPreview || t('StepRecord.livePanel.emptyTranscript')}
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="text-sm font-bold text-slate-900">{t('StepRecord.livePanel.summaryPreview')}</div>
                  <div className="mt-3 max-h-64 overflow-auto rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                    {liveMeetingState.summaryPreview || t('StepRecord.livePanel.emptySummary')}
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <ListChecks className="h-4 w-4 text-[#0d7c66]" />
                    {t('StepRecord.livePanel.decisionsActionItems')}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                      {liveMeetingState.decisionsPreview || t('StepRecord.livePanel.emptyDecisions')}
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                      {liveMeetingState.actionItemsPreview || t('StepRecord.livePanel.emptyActionItems')}
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    {t('StepRecord.livePanel.risks')}
                  </div>
                  <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                    {liveMeetingState.risksPreview || t('StepRecord.livePanel.emptyRisks')}
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
                  {t('StepRecord.recording.recordAgain')}
                </button>
              </div>

              {audioPreviewUrl && (
                <audio controls src={audioPreviewUrl} className="mt-4 w-full">
                  {t('StepRecord.recording.audioPreviewUnsupported')}
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
            {t('StepRecord.recording.aiSettings')}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="h-24 md:hidden" />
    </div>
  );
};
