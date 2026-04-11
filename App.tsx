import React, { useEffect, useState } from 'react';
import { ArrowLeft, Settings, Sparkles } from 'lucide-react';
import { ModuleHome } from './components/ModuleHome';
import { StepUpload } from './components/StepUpload';
import { StepRecord } from './components/StepRecord';
import { StepMode } from './components/StepMode';
import { StepResult } from './components/StepResult';
import { StepExport } from './components/StepExport';
import { SettingsModal } from './components/SettingsModal';
import {
  AppModule,
  ExtractionMode,
  InputSource,
  ProcessingState,
  SavedDeviceFile,
  SessionAnalysis,
  SessionContext,
} from './types';
import { processWithOrchestrator } from './services/transcriptionOrchestrator';
import { checkForUpdate } from './services/updateService';
import type { ReleaseInfo } from './services/updateService';
import { UpdateDialog } from './components/UpdateDialog';
import { initAppStorage, saveSessionPackage } from './services/sessionPackageService';

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<AppModule | null>(null);
  const [step, setStep] = useState<number>(1);
  const [source, setSource] = useState<InputSource>(InputSource.UPLOAD);
  const [sessionContext, setSessionContext] = useState<SessionContext>(
    SessionContext.TRANSCRIPTION
  );
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ExtractionMode>(ExtractionMode.TIMELINE);
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
  });
  const [savedRecording, setSavedRecording] = useState<SavedDeviceFile | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [updateRelease, setUpdateRelease] = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    // Initialize TSrecord folder
    initAppStorage().catch(console.error);

    const timer = setTimeout(() => {
      checkForUpdate().then((release) => {
        if (release) setUpdateRelease(release);
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const resetSharedState = () => {
    setFile(null);
    setAnalysis(null);
    setSavedRecording(null);
    setProcessingState({ status: 'idle' });
    setFileName('');
    setEmail('');
    setMode(ExtractionMode.TIMELINE);
    setStep(1);
  };

  const activateModule = (module: AppModule) => {
    setActiveModule(module);
    resetSharedState();

    if (module === AppModule.TRANSCRIBE) {
      setSource(InputSource.UPLOAD);
      setSessionContext(SessionContext.TRANSCRIPTION);
      return;
    }

    setSource(InputSource.RECORDING);
    setSessionContext(SessionContext.MEETING);
  };

  const handleLeaveModule = () => {
    setActiveModule(null);
    resetSharedState();
    setSource(InputSource.UPLOAD);
    setSessionContext(SessionContext.TRANSCRIPTION);
  };

  const handleInputNext = () => setStep(2);
  const handleModeBack = () => setStep(1);
  const handleResultNext = () => setStep(4);

  const handleAnalyze = async () => {
    if (!file) return;

    setProcessingState({
      status: 'processing',
      stageLabel:
        sessionContext === SessionContext.MEETING
          ? 'AI đang tạo transcript, summary, decisions, risks, folder tree và mindmap...'
          : 'AI đang tạo transcript...',
    });

    try {
      const nextAnalysis = await processWithOrchestrator({
        file,
        mode,
        source,
        context: sessionContext,
        savedRecording,
        onStageChange: (stage) =>
          setProcessingState((prev) => ({ ...prev, stageLabel: stage })),
      });

      setAnalysis(nextAnalysis);
      setProcessingState({ status: 'success' });
      setStep(3);

      // Auto-save session package to device
      try {
        await saveSessionPackage(nextAnalysis);
      } catch (saveError) {
        console.error('Auto-save session failed:', saveError);
      }
    } catch (error: any) {
      setProcessingState({
        status: 'error',
        errorMessage: error.message,
      });
      alert(error.message);
      setProcessingState({ status: 'idle' });
    }
  };

  const handleReset = () => {
    if (!activeModule) {
      handleLeaveModule();
      return;
    }

    activateModule(activeModule);
  };

  const moduleTitle =
    activeModule === AppModule.RECORD_NOTES
      ? 'Ghi âm & ghi chú'
      : activeModule === AppModule.TRANSCRIBE
        ? 'Trích xuất transcript'
        : 'TSrecord';

  const moduleSubtitle =
    activeModule === AppModule.RECORD_NOTES
      ? 'MODULE GHI ÂM & GHI CHÚ'
      : activeModule === AppModule.TRANSCRIBE
        ? 'MODULE TRÍCH XUẤT GHI ÂM'
        : 'AI RECORDING & TRANSCRIPT STUDIO';

  return (
    <div className="app-shell min-h-screen text-slate-950 selection:bg-[#0d7c66] selection:text-white">
      <div className="app-shell__mesh" />

      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 sm:h-20 w-full max-w-6xl items-center justify-between px-3 sm:px-4 md:px-6">
          <div className="flex items-center gap-2.5 sm:gap-4">
            <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-[#0d7c66] text-white shadow-lg shadow-[#0d7c66]/20">
              <Sparkles className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 md:text-xl">{moduleTitle}</h1>
              <p className="hidden text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66] sm:block">
                {moduleSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeModule && (
              <button
                onClick={handleLeaveModule}
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
                title="Đổi phân hệ"
              >
                <ArrowLeft className="h-4 w-4" />
                Phân hệ
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-full border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:border-[#0d7c66] hover:text-[#0d7c66]"
              title="Cài đặt"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {activeModule && (
          <div className="mx-auto flex h-1 w-full max-w-6xl gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6">
            {[1, 2, 3, 4].map((value) => (
              <div
                key={value}
                className={`h-full flex-1 rounded-full transition-all duration-500 ${
                  value <= step ? 'bg-[#0d7c66]' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col px-3 sm:px-4 pb-14 sm:pb-20 pt-5 sm:pt-8 md:px-6 md:pt-10">
        {!activeModule && <ModuleHome onSelect={activateModule} />}

        {activeModule === AppModule.TRANSCRIBE && step === 1 && (
          <StepUpload
            sessionContext={sessionContext}
            setSessionContext={setSessionContext}
            file={file}
            setFile={setFile}
            onNext={handleInputNext}
          />
        )}

        {activeModule === AppModule.RECORD_NOTES && step === 1 && (
          <StepRecord
            sessionContext={sessionContext}
            setSessionContext={setSessionContext}
            file={file}
            setFile={setFile}
            savedRecording={savedRecording}
            setSavedRecording={setSavedRecording}
            onNext={handleInputNext}
          />
        )}

        {activeModule && step === 2 && (
          <StepMode
            module={activeModule}
            mode={mode}
            setMode={setMode}
            source={source}
            sessionContext={sessionContext}
            fileName={file?.name}
            savedRecordingPath={savedRecording?.path}
            onNext={handleAnalyze}
            onBack={handleModeBack}
            isProcessing={processingState.status === 'processing'}
          />
        )}

        {activeModule && step === 3 && analysis && (
          <StepResult analysis={analysis} setAnalysis={setAnalysis} onNext={handleResultNext} />
        )}

        {activeModule && step === 4 && analysis && (
          <StepExport
            analysis={analysis}
            fileName={fileName}
            setFileName={setFileName}
            email={email}
            setEmail={setEmail}
            onReset={handleReset}
            originalFileName={file?.name}
          />
        )}

        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      </main>

      {updateRelease && (
        <UpdateDialog
          release={updateRelease}
          onDismiss={() => setUpdateRelease(null)}
        />
      )}
    </div>
  );
};

export default App;
