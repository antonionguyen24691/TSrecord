import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BriefcaseBusiness,
  CloudUpload,
  FileAudio,
  FileText,
  FileVideo,
  HardDrive,
  Users,
  X,
} from 'lucide-react';
import { SessionContext } from '../types';
import { AttachmentManager } from './AttachmentManager';
import { getRuntimeConfig, loadAiSettings } from '../services/aiSettingsService';

// Google API global declarations
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface StepUploadProps {
  sessionContext: SessionContext;
  setSessionContext: (context: SessionContext) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  additionalFiles: File[];
  setAdditionalFiles: (files: File[]) => void;
  onNext: () => void;
  isFreeAdTier?: boolean;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
};

const SUPPORTED_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.webm',
  '.mp4',
  '.mov',
  '.mkv',
];

export const StepUpload: React.FC<StepUploadProps> = ({
  sessionContext,
  setSessionContext,
  file,
  setFile,
  additionalFiles,
  setAdditionalFiles,
  onNext,
  isFreeAdTier,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);

  React.useEffect(() => {
    if (isFreeAdTier && sessionContext !== SessionContext.TRANSCRIPTION) {
      setSessionContext(SessionContext.TRANSCRIPTION);
    }
  }, [isFreeAdTier, sessionContext, setSessionContext]);

  const contextOptions = [
    { id: SessionContext.TRANSCRIPTION, title: t('StepUpload.context.transcription'), icon: FileText, disabled: false },
    { id: SessionContext.MEETING, title: t('StepUpload.context.meeting'), icon: BriefcaseBusiness, disabled: !!isFreeAdTier },
    { id: SessionContext.INTERVIEW, title: t('StepUpload.context.interview'), icon: Users, disabled: !!isFreeAdTier },
  ];

  const validateAndSetFile = (uploadedFile: File) => {
    const lowerName = uploadedFile.name.toLowerCase();
    const hasSupportedMime =
      uploadedFile.type.startsWith('audio/') || uploadedFile.type.startsWith('video/');
    const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((extension) =>
      lowerName.endsWith(extension)
    );

    if (hasSupportedMime || hasSupportedExtension) {
      setFile(uploadedFile);
      return;
    }

    alert(t('StepUpload.alerts.unsupportedFormat'));
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

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  };

  const handleGoogleDrivePick = async () => {
    setIsDriveLoading(true);
    try {
      const settings = await loadAiSettings();
      const runtimeConfig = await getRuntimeConfig();
      const clientId = settings.googleClientId || runtimeConfig.googleClientId;
      const apiKey = settings.googleApiKey || runtimeConfig.googleApiKey;

      if (!clientId || !apiKey) {
        alert(t('StepUpload.alerts.missingGoogleConfig'));
        setIsDriveLoading(false);
        return;
      }

      if (typeof window.google === 'undefined' || typeof window.gapi === 'undefined') {
        await Promise.all([
          loadScript('https://accounts.google.com/gsi/client'),
          loadScript('https://apis.google.com/js/api.js'),
        ]);

        let retries = 20;
        while (
          (typeof window.google === 'undefined' ||
            typeof window.gapi === 'undefined' ||
            typeof window.google.accounts === 'undefined') &&
          retries > 0
        ) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          retries--;
        }
      }

      if (typeof window.google === 'undefined' || typeof window.gapi === 'undefined') {
        throw new Error(t('StepUpload.alerts.sdkNotReady'));
      }

      // Load GAPI picker
      const loadPicker = () =>
        new Promise<void>((resolve, reject) => {
          window.gapi.load('picker', {
            callback: () => resolve(),
            onerror: () => reject(new Error(t('StepUpload.alerts.pickerLoadFailed'))),
          });
        });

      await loadPicker();

      // Trigger OAuth2 Flow
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            alert(t('StepUpload.alerts.googleLoginFailed', { error: tokenResponse.error }));
            setIsDriveLoading(false);
            return;
          }

          const accessToken = tokenResponse.access_token;
          if (!accessToken) {
            alert(t('StepUpload.alerts.missingAccessToken'));
            setIsDriveLoading(false);
            return;
          }

          // Build Google Picker
          const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
          view.setMimeTypes('audio/*,video/*');

          const picker = new window.google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(accessToken)
            .setDeveloperKey(apiKey)
            .setCallback(async (data: any) => {
              if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
                const doc = data[window.google.picker.Response.DOCUMENTS][0];
                const fileId = doc[window.google.picker.Document.ID];
                const fileName = doc[window.google.picker.Document.NAME];
                const mimeType = doc[window.google.picker.Document.MIME_TYPE];

                setIsDriveLoading(true);
                try {
                  const response = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                    {
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                      },
                    }
                  );

                  if (!response.ok) {
                    throw new Error(t('StepUpload.alerts.driveDownloadError', { status: response.statusText }));
                  }

                  const blob = await response.blob();
                  const driveFile = new File([blob], fileName, { type: mimeType });
                  validateAndSetFile(driveFile);
                } catch (err: any) {
                  alert(err.message || t('StepUpload.alerts.driveDownloadProcessError'));
                } finally {
                  setIsDriveLoading(false);
                }
              } else if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.CANCEL) {
                setIsDriveLoading(false);
              }
            })
            .build();

          picker.setVisible(true);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (error: any) {
      alert(error.message || t('StepUpload.alerts.sdkConfigError'));
      setIsDriveLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full animate-fade-in">
      <div className="w-full max-w-5xl rounded-[26px] border border-white/60 bg-white/90 p-4 md:rounded-[36px] md:p-8 shadow-[0_28px_90px_rgba(15,23,42,0.10)]">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66]">
              {t('StepUpload.tag')}
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-900 md:text-3xl">
              {t('StepUpload.title')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {t('StepUpload.description')}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleGoogleDrivePick}
              disabled={isDriveLoading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              <HardDrive className="h-4 w-4 text-[#0d7c66]" />
              {isDriveLoading ? t('StepUpload.buttons.connecting') : t('StepUpload.buttons.googleDrive')}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0d7c66] px-4 text-sm font-bold text-white hover:bg-[#0a6352] transition-all"
            >
              <CloudUpload className="h-4 w-4" />
              {t('StepUpload.buttons.chooseFile')}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {contextOptions.map((item) => {
            const Icon = item.icon;
            const active = sessionContext === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.disabled) {
                    alert('Bản dùng thử qua quảng cáo không hỗ trợ chế độ này. Vui lòng nâng cấp gói hoặc tự điền API Key riêng.');
                    return;
                  }
                  setSessionContext(item.id);
                }}
                className={`rounded-xl border p-3 text-center transition-all ${
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                    : active
                    ? 'border-[#0d7c66] bg-[#0d7c66]/8 text-[#0d7c66]'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-2 text-xs font-bold md:text-sm">{item.title}</div>
              </button>
            );
          })}
        </div>

        {!file ? (
          <div
            className={`mt-4 rounded-[20px] border-2 border-dashed p-6 md:p-8 transition-all ${
              dragActive
                ? 'border-[#0d7c66] bg-[#0d7c66]/5'
                : 'border-slate-300 bg-[linear-gradient(145deg,#ffffff,#f4fbf8_52%,#eef7ff)] hover:border-[#0d7c66]'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div
              className="w-full text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.mp4,.mov,.mkv"
                onChange={handleChange}
                onClick={(event) => {
                  (event.target as HTMLInputElement).value = '';
                }}
              />

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0d7c66]/10 text-[#0d7c66]">
                <CloudUpload className="h-8 w-8" />
              </div>
              <div className="mt-3 text-lg font-black text-slate-900">
                {t('StepUpload.dropzone.title')}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {t('StepUpload.dropzone.description')}
              </p>
              
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleGoogleDrivePick();
                  }}
                  disabled={isDriveLoading}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  <HardDrive className="h-4 w-4 text-[#0d7c66]" />
                  {isDriveLoading ? t('StepUpload.buttons.connectingDrive') : t('StepUpload.buttons.importDrive')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0d7c66]/10 text-[#0d7c66]">
                  {file.type.startsWith('video/') ? (
                    <FileVideo className="h-5 w-5" />
                  ) : (
                    <FileAudio className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-slate-900 line-clamp-1">{file.name}</div>
                  <div className="mt-0.5 text-sm text-slate-500">{formatFileSize(file.size)}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFile(null)}
                className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                {t('StepUpload.buttons.removeFile')}
              </button>
            </div>
          </div>
        )}
        
        <AttachmentManager
          additionalFiles={additionalFiles}
          setAdditionalFiles={setAdditionalFiles}
        />
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
            {t('StepUpload.buttons.next')}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="h-24 md:hidden" />
    </div>
  );
};
