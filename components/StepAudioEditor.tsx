import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  AudioLines,
  Download,
  FileAudio,
  Scissors,
  Sparkles,
  Upload,
  Play,
  Pause,
} from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import { SavedDeviceFile } from '../types';
import {
  getAudioDuration,
  saveEditedAudioToDevice,
  trimAudioFile,
} from '../services/audioEditorService';

interface StepAudioEditorProps {
  onSendToTranscribe: (file: File) => void;
}

const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.flac'];

const formatSeconds = (value: number) => {
  if (!Number.isFinite(value)) return '00:00';
  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  }

  return [minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
};

export const StepAudioEditor: React.FC<StepAudioEditorProps> = ({ onSendToTranscribe }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wavesurferContainerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const stopPreviewTimeoutRef = useRef<number | null>(null);
  const seekTimeoutRef = useRef<number | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [rangeStart, setRangeStart] = useState<number>(0);
  const [rangeEnd, setRangeEnd] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [editedFile, setEditedFile] = useState<File | null>(null);
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [editedUrl, setEditedUrl] = useState<string>('');
  const [savedFile, setSavedFile] = useState<SavedDeviceFile | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (editedUrl) URL.revokeObjectURL(editedUrl);
      if (stopPreviewTimeoutRef.current) {
        window.clearTimeout(stopPreviewTimeoutRef.current);
      }
      if (seekTimeoutRef.current !== null) {
        cancelAnimationFrame(seekTimeoutRef.current);
      }
    };
  }, [audioUrl, editedUrl]);

  const scheduleSeek = (time: number) => {
    if (seekTimeoutRef.current !== null) {
      cancelAnimationFrame(seekTimeoutRef.current);
    }
    seekTimeoutRef.current = requestAnimationFrame(() => {
      if (wavesurferRef.current) {
        wavesurferRef.current.setTime(time);
      }
      seekTimeoutRef.current = null;
    });
  };

  // Initialize WaveSurfer
  useEffect(() => {
    if (!audioUrl || !wavesurferContainerRef.current) {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      return;
    }

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: wavesurferContainerRef.current,
      waveColor: 'rgba(255, 255, 255, 0.25)',
      progressColor: '#7af2d1',
      cursorColor: '#7af2d1',
      height: 80,
      barWidth: 2,
      barGap: 3,
      barRadius: 2,
      url: audioUrl,
      hideScrollbar: true,
    });

    wavesurferRef.current = ws;

    ws.on('ready', () => {
      const nextDuration = ws.getDuration();
      setDuration(nextDuration);
      setRangeStart(0);
      setRangeEnd(nextDuration);
      setCurrentTime(0);
    });

    ws.on('timeupdate', (time) => {
      setCurrentTime(time);
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl]);

  const segmentDuration = Math.max(0, rangeEnd - rangeStart);
  const canEdit = Boolean(file) && duration > 0 && rangeEnd > rangeStart;

  const handlePickFile = async (pickedFile: File) => {
    const lowerName = pickedFile.name.toLowerCase();
    const isSupported =
      pickedFile.type.startsWith('audio/') ||
      SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));

    if (!isSupported) {
      setErrorMessage(t('StepAudioEditor.errors.unsupportedAudio'));
      return;
    }

    setErrorMessage('');
    setEditedFile(null);
    setEditedBlob(null);
    setSavedFile(null);

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (editedUrl) URL.revokeObjectURL(editedUrl);

    const nextUrl = URL.createObjectURL(pickedFile);
    setAudioUrl(nextUrl);
    setEditedUrl('');
    setFile(pickedFile);

    try {
      const nextDuration = await getAudioDuration(pickedFile);
      setDuration(nextDuration);
      setRangeStart(0);
      setRangeEnd(nextDuration);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('StepAudioEditor.errors.openAudioFailed'));
    }
  };

  const handleChangeFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) {
      void handlePickFile(nextFile);
    }
  };

  const buildEditedSegment = async () => {
    if (!file) return null;

    setIsPreparing(true);
    setErrorMessage('');

    try {
      const result = await trimAudioFile({
        file,
        startSeconds: rangeStart,
        endSeconds: rangeEnd,
      });

      if (editedUrl) URL.revokeObjectURL(editedUrl);
      const nextEditedUrl = URL.createObjectURL(result.blob);

      setEditedBlob(result.blob);
      setEditedFile(result.file);
      setEditedUrl(nextEditedUrl);
      return result;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('StepAudioEditor.errors.buildSegmentFailed'));
      return null;
    } finally {
      setIsPreparing(false);
    }
  };

  const handlePreviewSegment = async () => {
    const ws = wavesurferRef.current;
    if (!ws || !canEdit) return;

    ws.setTime(rangeStart);
    void ws.play();

    if (stopPreviewTimeoutRef.current) {
      window.clearTimeout(stopPreviewTimeoutRef.current);
    }

    const checkTime = () => {
      if (ws.getCurrentTime() >= rangeEnd) {
        ws.pause();
      } else if (ws.isPlaying()) {
        stopPreviewTimeoutRef.current = window.setTimeout(checkTime, 100);
      }
    };

    stopPreviewTimeoutRef.current = window.setTimeout(checkTime, 100);
  };

  const handlePlayPause = () => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    void ws.playPause();
  };

  const handleSaveEditedAudio = async () => {
    const result = editedBlob && editedFile ? { blob: editedBlob, file: editedFile } : await buildEditedSegment();
    if (!result) return;

    setIsSaving(true);
    setErrorMessage('');

    try {
      const saved = await saveEditedAudioToDevice({
        blob: result.blob,
        fileName: result.file.name,
      });
      setSavedFile(saved);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('StepAudioEditor.errors.saveSegmentFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToTranscribe = async () => {
    const result = editedFile ? { file: editedFile } : await buildEditedSegment();
    if (!result) return;
    onSendToTranscribe(result.file);
  };

  return (
    <div className="flex flex-col items-center w-full animate-fade-in">
      <div className="w-full max-w-6xl rounded-[28px] border border-white/60 bg-white/92 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.10)] md:p-8">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(160deg,#0b1220,#0d7c66_12%,#09111e_72%)] p-5 text-white shadow-[0_24px_90px_rgba(2,6,23,0.32)] flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#7af2d1]">
                <Sparkles className="h-4 w-4" />
                {t('StepAudioEditor.badge')}
              </div>
              <h2 className="mt-4 text-2xl font-black md:text-3xl">{t('StepAudioEditor.title')}</h2>
              <p className="mt-3 text-sm leading-7 text-white/75">
                {t('StepAudioEditor.description')}
              </p>

              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">
                      {t('StepAudioEditor.waveLane')}
                    </div>
                    <div className="mt-1 text-sm font-bold text-[#7af2d1] font-mono">
                      {file ? `${formatSeconds(rangeStart)} → ${formatSeconds(rangeEnd)}` : t('StepAudioEditor.noFile')}
                    </div>
                  </div>
                  <AudioLines className="h-5 w-5 text-[#7af2d1]" />
                </div>

                {/* Wavesurfer Container */}
                <div className="mt-5 relative overflow-hidden rounded-[20px] border border-white/10 bg-black/40 px-3 py-4 flex flex-col justify-center min-h-[120px]">
                  {file ? (
                    <div ref={wavesurferContainerRef} className="w-full" />
                  ) : (
                    <div className="text-center text-xs text-white/40 py-8">
                      {t('StepAudioEditor.chooseFileToViewWave')}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-white/45">{t('StepAudioEditor.rangeStart')}</div>
                    <div className="mt-1 font-mono font-bold text-white">{formatSeconds(rangeStart)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-white/45">{t('StepAudioEditor.rangeEnd')}</div>
                    <div className="mt-1 font-mono font-bold text-white">{formatSeconds(rangeEnd)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-white/45">{t('StepAudioEditor.rangeLength')}</div>
                    <div className="mt-1 font-mono font-bold text-white">{formatSeconds(segmentDuration)}</div>
                  </div>
                </div>
              </div>
            </div>

            {file && (
              <div className="mt-6 flex items-center justify-between text-xs text-white/50 border-t border-white/10 pt-4">
                <span>{t('StepAudioEditor.currentPosition')}: <span className="font-mono text-white font-bold">{formatSeconds(currentTime)}</span></span>
                <span>{t('StepAudioEditor.totalDuration')}: <span className="font-mono text-white font-bold">{formatSeconds(duration)}</span></span>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0d7c66]">
                  {t('StepAudioEditor.sourceTag')}
                </div>
                <h3 className="mt-2 text-xl font-black text-slate-950">{t('StepAudioEditor.sourceTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0d7c66] px-4 text-sm font-bold text-white transition-all hover:bg-[#0a6352]"
              >
                <Upload className="h-4 w-4" />
                {t('StepAudioEditor.chooseAudio')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
                className="hidden"
                onChange={handleChangeFile}
                onClick={(event) => {
                  (event.target as HTMLInputElement).value = '';
                }}
              />
            </div>

            {!file ? (
              <div className="mt-5 rounded-[24px] border-2 border-dashed border-slate-300 bg-[linear-gradient(145deg,#ffffff,#f4fbf8_52%,#eef7ff)] p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0d7c66]/10 text-[#0d7c66]">
                  <FileAudio className="h-8 w-8" />
                </div>
                <div className="mt-4 text-lg font-black text-slate-900">{t('StepAudioEditor.emptyTitle')}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {t('StepAudioEditor.emptyDescription')}
                </p>
              </div>
            ) : (
              <>
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0d7c66]/10 text-[#0d7c66]">
                        <FileAudio className="h-5 w-5" />
                      </div>
                      <div className="max-w-[200px] sm:max-w-xs md:max-w-md">
                        <div className="font-bold text-slate-900 truncate">{file.name}</div>
                        <div className="mt-0.5 text-sm text-slate-500">
                          {formatFileSize(file.size)} • {formatSeconds(duration)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePlayPause}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePreviewSegment()}
                        disabled={!canEdit}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#0d7c66] bg-[#0d7c66]/5 px-4 text-sm font-bold text-[#0d7c66] hover:bg-[#0d7c66]/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <AudioLines className="h-4 w-4" />
                        {t('StepAudioEditor.previewSelection')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-800">
                      <span>{t('StepAudioEditor.rangeStart')}</span>
                      <span className="font-mono text-[#0d7c66]">{formatSeconds(rangeStart)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(duration, 0)}
                      step={0.1}
                      value={rangeStart}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        const cleanVal = Math.min(nextValue, Math.max(0, rangeEnd - 0.1));
                        setRangeStart(cleanVal);
                        scheduleSeek(cleanVal);
                      }}
                      className="w-full accent-[#0d7c66]"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-800">
                      <span>{t('StepAudioEditor.rangeEnd')}</span>
                      <span className="font-mono text-[#0d7c66]">{formatSeconds(rangeEnd)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(duration, 0)}
                      step={0.1}
                      value={rangeEnd}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        const cleanVal = Math.max(nextValue, Math.min(duration, rangeStart + 0.1));
                        setRangeEnd(cleanVal);
                        scheduleSeek(cleanVal);
                      }}
                      className="w-full accent-[#0d7c66]"
                    />
                  </div>
                </div>

                {editedFile && (
                  <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="text-sm font-bold text-emerald-900">{t('StepAudioEditor.trimmedReady')}</div>
                    <div className="mt-1 text-sm text-emerald-800">
                      {editedFile.name} • {formatSeconds(segmentDuration)}
                    </div>
                    {editedUrl && (
                      <audio controls src={editedUrl} className="mt-4 w-full">
                        {t('StepAudioEditor.unsupportedPreview')}
                      </audio>
                    )}
                    {savedFile && (
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900">
                        {t('StepAudioEditor.savedAt', { path: `${savedFile.directoryLabel}/${savedFile.fileName}` })}
                      </div>
                    )}
                  </div>
                )}

                {errorMessage && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {errorMessage}
                  </div>
                )}

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveEditedAudio()}
                    disabled={!canEdit || isPreparing || isSaving}
                    className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-5 w-5" />
                    {isSaving ? t('StepAudioEditor.saving') : isPreparing ? t('StepAudioEditor.buildingFile') : t('StepAudioEditor.saveEdited')}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSendToTranscribe()}
                    disabled={!canEdit || isPreparing}
                    className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#0d7c66] px-5 text-sm font-bold uppercase tracking-[0.14em] text-white shadow-lg shadow-[#0d7c66]/20 transition-all hover:bg-[#0a6352] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Scissors className="h-5 w-5" />
                    {isPreparing ? t('StepAudioEditor.buildingSegment') : t('StepAudioEditor.sendToTranscribe')}
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
