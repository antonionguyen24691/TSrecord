import React, { Suspense, lazy, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Settings, Sparkles } from 'lucide-react';
import { ModuleHome } from './components/ModuleHome';
import { ScreenSkeleton } from './components/ScreenSkeleton';
import { Toast, ToastMessage, ToastType } from './components/Toast';
import {
  AppModule,
  ExtractionMode,
  InputSource,
  ProcessingState,
  SavedDeviceFile,
  SessionAnalysis,
  SessionContext,
  WorkspaceProject,
  WorkspaceSessionSummary,
} from './types';
import type { ReleaseInfo } from './services/updateService';
import {
  assignSessionToProject,
  createWorkspaceProject,
  deleteWorkspaceProject,
  filterWorkspaceSessions,
  listWorkspaceProjects,
  listWorkspaceSessions,
  loadWorkspaceSession,
  removeSessionFromProject,
  toggleWorkspaceProjectPin,
  updateWorkspaceProject,
  updateWorkspaceSessionNote,
} from './services/workspaceService';

const loadStepUpload = () => import('./components/StepUpload');
const loadStepRecord = () => import('./components/StepRecord');
const loadStepMode = () => import('./components/StepMode');
const loadStepResult = () => import('./components/StepResult');
const loadStepExport = () => import('./components/StepExport');
const loadSettingsModal = () => import('./components/SettingsModal');
const loadWorkspaceLibrary = () => import('./components/WorkspaceLibrary');
const loadUpdateDialog = () => import('./components/UpdateDialog');
const loadTranscriptionOrchestrator = () => import('./services/transcriptionOrchestrator');
const loadSessionPackageService = () => import('./services/sessionPackageService');
const loadUpdateService = () => import('./services/updateService');

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const StepUpload = lazy(() => loadStepUpload().then((module) => ({ default: module.StepUpload })));
const StepRecord = lazy(() => loadStepRecord().then((module) => ({ default: module.StepRecord })));
const StepMode = lazy(() => loadStepMode().then((module) => ({ default: module.StepMode })));
const StepResult = lazy(() => loadStepResult().then((module) => ({ default: module.StepResult })));
const StepExport = lazy(() => loadStepExport().then((module) => ({ default: module.StepExport })));
const SettingsModal = lazy(() =>
  loadSettingsModal().then((module) => ({ default: module.SettingsModal }))
);
const WorkspaceLibrary = lazy(() =>
  loadWorkspaceLibrary().then((module) => ({ default: module.WorkspaceLibrary }))
);
const UpdateDialog = lazy(() =>
  loadUpdateDialog().then((module) => ({ default: module.UpdateDialog }))
);

const App: React.FC = () => {
  const exportEnginesPrefetchedRef = useRef(false);
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
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [workspaceSessions, setWorkspaceSessions] = useState<WorkspaceSessionSummary[]>([]);
  const [workspaceProjects, setWorkspaceProjects] = useState<WorkspaceProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle'
  );
  const [workspaceError, setWorkspaceError] = useState<string>('');
  const [workspaceQuery, setWorkspaceQuery] = useState<string>('');
  const deferredWorkspaceQuery = useDeferredValue(workspaceQuery);

  const refreshWorkspaceData = async () => {
    setWorkspaceStatus('loading');
    setWorkspaceError('');

    try {
      const [sessions, projects] = await Promise.all([
        listWorkspaceSessions(),
        listWorkspaceProjects(),
      ]);
      setWorkspaceSessions(sessions);
      setWorkspaceProjects(projects);
      setWorkspaceStatus('ready');
    } catch (error: any) {
      setWorkspaceStatus('error');
      setWorkspaceError(error?.message || 'Không thể tải thư viện session.');
    }
  };

  useEffect(() => {
    // Initialize TSrecord folder
    loadSessionPackageService()
      .then(({ initAppStorage }) => initAppStorage())
      .catch(console.error);
    void refreshWorkspaceData();

    const timer = setTimeout(() => {
      loadUpdateService()
        .then(({ checkForUpdate }) => checkForUpdate())
        .then((release) => {
          if (release) setUpdateRelease(release);
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showWorkspace) {
      void loadWorkspaceLibrary();
    }
  }, [showWorkspace]);

  useEffect(() => {
    if (showSettings) {
      void loadSettingsModal();
    }
  }, [showSettings]);

  useEffect(() => {
    if (updateRelease) {
      void loadUpdateDialog();
    }
  }, [updateRelease]);

  useEffect(() => {
    if (!activeModule) return;

    if (step === 1) {
      void loadStepMode();
      return;
    }

    if (step === 2) {
      void loadStepResult();
      void loadTranscriptionOrchestrator();
      return;
    }

    if (step === 3) {
      void loadStepExport();
      void loadSessionPackageService();
      return;
    }

    if (step === 4 && !exportEnginesPrefetchedRef.current) {
      exportEnginesPrefetchedRef.current = true;

      const prefetch = () => {
        void import('docx');
        void import('pptxgenjs');
      };

      if (typeof window === 'undefined') return;

      if ('requestIdleCallback' in window) {
        (window as Window & {
          requestIdleCallback: (callback: () => void) => number;
        }).requestIdleCallback(prefetch);
      } else {
        globalThis.setTimeout(prefetch, 250);
      }
    }
  }, [activeModule, step]);

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
    setShowWorkspace(false);
    setActiveModule(module);
    resetSharedState();
    exportEnginesPrefetchedRef.current = false;

    if (module === AppModule.TRANSCRIBE) {
      void loadStepUpload();
      void loadStepMode();
      setSource(InputSource.UPLOAD);
      setSessionContext(SessionContext.TRANSCRIPTION);
      return;
    }

    void loadStepRecord();
    void loadStepMode();
    setSource(InputSource.RECORDING);
    setSessionContext(SessionContext.MEETING);
  };

  const handleLeaveModule = () => {
    setShowWorkspace(false);
    setActiveModule(null);
    resetSharedState();
    setActiveProjectId(null);
    setSource(InputSource.UPLOAD);
    setSessionContext(SessionContext.TRANSCRIPTION);
  };

  const handleOpenWorkspace = () => {
    setShowWorkspace(true);
    setActiveModule(null);
    resetSharedState();
    setSource(InputSource.UPLOAD);
    setSessionContext(SessionContext.TRANSCRIPTION);
    void refreshWorkspaceData();
  };

  const handleOpenWorkspaceSession = async (session: WorkspaceSessionSummary) => {
    const restored = await loadWorkspaceSession(session);

    if (!restored) {
      showToast('Không thể mở lại session này. Vui lòng thử lưu package lại ở phiên mới hơn.');
      return;
    }

    setShowWorkspace(false);
    setActiveModule(
      restored.source === InputSource.RECORDING ? AppModule.RECORD_NOTES : AppModule.TRANSCRIBE
    );
    setSource(restored.source);
    setSessionContext(restored.context);
    setFile(null);
    setMode(restored.mode);
    setSavedRecording(restored.savedRecording || null);
    setAnalysis(restored);
    setFileName(restored.suggestedFolderName || restored.title || '');
    setEmail('');
    setProcessingState({ status: 'idle' });
    setStep(3);
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
      const { processWithOrchestrator } = await loadTranscriptionOrchestrator();
      const nextAnalysis = await processWithOrchestrator({
        file,
        mode,
        source,
        context: sessionContext,
        savedRecording,
        onStageChange: (stage) =>
          setProcessingState((prev) => ({ ...prev, stageLabel: stage })),
        onProgress: (progress) =>
          setProcessingState((prev) => ({
            ...prev,
            ...progress,
          })),
      });

      const finalizedAnalysis: SessionAnalysis = {
        ...nextAnalysis,
        createdAt: nextAnalysis.createdAt || new Date().toISOString(),
        originalFileName: nextAnalysis.originalFileName || file.name,
      };

      setAnalysis(finalizedAnalysis);
      setProcessingState({
        status: 'success',
        phase: 'saving',
        stageLabel: 'Transcript và phân tích đã xong, đang mở kết quả...',
        progressLabel: '100%',
      });
      setStep(3);

      // Auto-save session package to device
      try {
        const { saveSessionPackage } = await loadSessionPackageService();
        const savedPackage = await saveSessionPackage({ analysis: finalizedAnalysis });
        setAnalysis((current) =>
          current
            ? {
                ...current,
                workspacePath: savedPackage.workspacePath,
              }
            : current
        );
        void refreshWorkspaceData();
      } catch (saveError) {
        console.error('Auto-save session failed:', saveError);
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Đã xảy ra lỗi khi xử lý file.');
      setProcessingState({
        status: 'error',
        errorMessage: message,
      });
      showToast(message);
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
    showWorkspace
      ? 'Workspace'
      : activeModule === AppModule.RECORD_NOTES
      ? 'Ghi âm & ghi chú'
      : activeModule === AppModule.TRANSCRIBE
        ? 'Trích xuất transcript'
        : 'TSrecord';

  const moduleSubtitle =
    showWorkspace
      ? 'THƯ VIỆN SESSION & TÌM KIẾM'
      : activeModule === AppModule.RECORD_NOTES
      ? 'MODULE GHI ÂM & GHI CHÚ'
      : activeModule === AppModule.TRANSCRIBE
        ? 'MODULE TRÍCH XUẤT GHI ÂM'
        : 'AI RECORDING & TRANSCRIPT STUDIO';

  const visibleWorkspaceSessions = useMemo(
    () => filterWorkspaceSessions(workspaceSessions, deferredWorkspaceQuery),
    [workspaceSessions, deferredWorkspaceQuery]
  );
  const latestWorkspaceSession = workspaceSessions[0];

  const showToast = (message: string, type: ToastType = 'error') => {
    setToast({ id: Date.now(), message, type });
  };

  const handleCreateProject = async (name: string) => {
    try {
      const projects = await createWorkspaceProject(name);
      setWorkspaceProjects(projects);
      setActiveProjectId(projects[0]?.id || null);
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Không thể tạo dự án mới.'));
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const target = workspaceProjects.find((project) => project.id === projectId);
    if (!target) return;

    const confirmed = window.confirm(
      `Xóa dự án "${target.name}"? Các session gốc vẫn được giữ lại trong workspace.`
    );
    if (!confirmed) return;

    const projects = await deleteWorkspaceProject(projectId);
    setWorkspaceProjects(projects);
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
  };

  const handleToggleProjectPin = async (projectId: string) => {
    const projects = await toggleWorkspaceProjectPin(projectId);
    setWorkspaceProjects(projects);
  };

  const handleUpdateProject = async (
    projectId: string,
    updates: Partial<Pick<WorkspaceProject, 'name' | 'note'>>
  ) => {
    const projects = await updateWorkspaceProject(projectId, updates);
    setWorkspaceProjects(projects);
  };

  const handleAssignSessionToProject = async (projectId: string, sessionId: string) => {
    const projects = await assignSessionToProject(projectId, sessionId);
    setWorkspaceProjects(projects);
  };

  const handleRemoveSessionFromProject = async (projectId: string, sessionId: string) => {
    const projects = await removeSessionFromProject(projectId, sessionId);
    setWorkspaceProjects(projects);
  };

  const handleUpdateSessionNote = async (sessionId: string, note: string) => {
    await updateWorkspaceSessionNote(sessionId, note);
    setWorkspaceSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              note,
            }
          : session
      )
    );
  };

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
            {(activeModule || showWorkspace) && (
              <button
                onClick={handleLeaveModule}
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
                title="Về trang chủ"
              >
                <ArrowLeft className="h-4 w-4" />
                Trang chủ
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
        {!activeModule && !showWorkspace && (
          <ModuleHome
            onSelect={activateModule}
            onOpenWorkspace={handleOpenWorkspace}
            sessionCount={workspaceSessions.length}
            recentSessionTitle={latestWorkspaceSession?.title}
          />
        )}

        {showWorkspace && (
          <Suspense fallback={<ScreenSkeleton variant="workspace" label="Đang tải workspace" />}>
            <WorkspaceLibrary
              sessions={visibleWorkspaceSessions}
              projects={workspaceProjects}
              activeProjectId={activeProjectId}
              query={workspaceQuery}
              isLoading={workspaceStatus === 'loading'}
              errorMessage={workspaceError}
              onQueryChange={setWorkspaceQuery}
              onRefresh={() => {
                void refreshWorkspaceData();
              }}
              onOpenSession={(session) => {
                void handleOpenWorkspaceSession(session);
              }}
              onSelectProject={setActiveProjectId}
              onCreateProject={(name) => {
                void handleCreateProject(name);
              }}
              onDeleteProject={(projectId) => {
                void handleDeleteProject(projectId);
              }}
              onToggleProjectPin={(projectId) => {
                void handleToggleProjectPin(projectId);
              }}
              onUpdateProject={(projectId, updates) => {
                void handleUpdateProject(projectId, updates);
              }}
              onAssignSessionToProject={(projectId, sessionId) => {
                void handleAssignSessionToProject(projectId, sessionId);
              }}
              onRemoveSessionFromProject={(projectId, sessionId) => {
                void handleRemoveSessionFromProject(projectId, sessionId);
              }}
              onUpdateSessionNote={(sessionId, note) => {
                void handleUpdateSessionNote(sessionId, note);
              }}
            />
          </Suspense>
        )}

        {activeModule === AppModule.TRANSCRIBE && step === 1 && (
          <Suspense fallback={<ScreenSkeleton variant="upload" label="Đang tải trình upload" />}>
            <StepUpload
              sessionContext={sessionContext}
              setSessionContext={setSessionContext}
              file={file}
              setFile={setFile}
              onNext={handleInputNext}
            />
          </Suspense>
        )}

        {activeModule === AppModule.RECORD_NOTES && step === 1 && (
          <Suspense fallback={<ScreenSkeleton variant="record" label="Đang tải phân hệ ghi âm" />}>
            <StepRecord
              sessionContext={sessionContext}
              setSessionContext={setSessionContext}
              file={file}
              setFile={setFile}
              savedRecording={savedRecording}
              setSavedRecording={setSavedRecording}
              onNext={handleInputNext}
            />
          </Suspense>
        )}

        {activeModule && step === 2 && (
          <Suspense fallback={<ScreenSkeleton variant="mode" label="Đang tải cấu hình AI" />}>
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
              processingState={processingState}
            />
          </Suspense>
        )}

        {activeModule && step === 3 && analysis && (
          <Suspense fallback={<ScreenSkeleton variant="result" label="Đang tải kết quả AI" />}>
            <StepResult analysis={analysis} setAnalysis={setAnalysis} onNext={handleResultNext} />
          </Suspense>
        )}

        {activeModule && step === 4 && analysis && (
          <Suspense fallback={<ScreenSkeleton variant="export" label="Đang tải màn hình xuất file" />}>
            <StepExport
              analysis={analysis}
              fileName={fileName}
              setFileName={setFileName}
              email={email}
              setEmail={setEmail}
              onReset={handleReset}
              originalFileName={file?.name}
            />
          </Suspense>
        )}

        {showSettings && (
          <Suspense fallback={null}>
            <SettingsModal
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
              onStorageCleared={async () => {
                setAnalysis(null);
                setSavedRecording(null);
                setFile(null);
                setFileName('');
                setEmail('');
                setProcessingState({ status: 'idle' });
                await refreshWorkspaceData();
              }}
            />
          </Suspense>
        )}
      </main>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {updateRelease && (
        <Suspense fallback={null}>
          <UpdateDialog release={updateRelease} onDismiss={() => setUpdateRelease(null)} />
        </Suspense>
      )}
    </div>
  );
};

export default App;
