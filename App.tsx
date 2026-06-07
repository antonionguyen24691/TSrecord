import React, { Suspense, lazy, useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Settings, Sparkles, WifiOff, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ModuleHome } from './components/ModuleHome';
import { ScreenSkeleton } from './components/ScreenSkeleton';
import { useOnlineStatus } from './hooks/useOnlineStatus';
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
const loadStepAudioEditor = () => import('./components/StepAudioEditor');
const loadStepMode = () => import('./components/StepMode');
const loadStepResult = () => import('./components/StepResult');
const loadStepExport = () => import('./components/StepExport');
const loadSettingsModal = () => import('./components/SettingsModal');
const loadWorkspaceLibrary = () => import('./components/WorkspaceLibrary');
const loadUpdateDialog = () => import('./components/UpdateDialog');
const loadTranscriptionOrchestrator = () => import('./services/transcriptionOrchestrator');
const loadSessionPackageService = () => import('./services/sessionPackageService');
const loadUpdateService = () => import('./services/updateService');
const loadRecordingService = () => import('./services/recordingService');
const loadBackgroundProcessingScheduler = () => import('./services/backgroundProcessingScheduler');

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const StepUpload = lazy(() => loadStepUpload().then((module) => ({ default: module.StepUpload })));
const StepRecord = lazy(() => loadStepRecord().then((module) => ({ default: module.StepRecord })));
const StepAudioEditor = lazy(() =>
  loadStepAudioEditor().then((module) => ({ default: module.StepAudioEditor }))
);
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
  const { t } = useTranslation();
  const titleAudioEditorT = t('App.titleAudioEditor');
  const subtitleAudioEditorT = t('App.subtitleAudioEditor');
  const isOnline = useOnlineStatus();
  const exportEnginesPrefetchedRef = useRef(false);
  const [activeModule, setActiveModule] = useState<AppModule | null>(null);
  const [step, setStep] = useState<number>(1);
  const [source, setSource] = useState<InputSource>(InputSource.UPLOAD);
  const [sessionContext, setSessionContext] = useState<SessionContext>(
    SessionContext.TRANSCRIPTION
  );
  const [file, setFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
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

  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [showAdModal, setShowAdModal] = useState<boolean>(false);
  const [adCountdown, setAdCountdown] = useState<number>(0);
  const [customBannerHtml, setCustomBannerHtml] = useState<string>('');
  const [customBannerEnabled, setCustomBannerEnabled] = useState<boolean>(false);

  const fetchLicenseAndSettings = useCallback(async () => {
    try {
      const { checkLicenseStatus, loadAiSettings, getRuntimeConfig } = await import('./services/aiSettingsService');
      const [info, s, rtc] = await Promise.all([
        checkLicenseStatus(),
        loadAiSettings(),
        getRuntimeConfig(),
      ]);
      setLicenseInfo(info);
      setSettings(s);
      setCustomBannerHtml(rtc.customBannerHtml || '');
      setCustomBannerEnabled(rtc.customBannerEnabled ?? false);
    } catch (err) {
      console.error('Failed to fetch license or settings:', err);
    }
  }, []);

  const isFreeAdTier = useMemo(() => {
    return settings?.useAdminKey && (!licenseInfo || !licenseInfo.valid);
  }, [settings, licenseInfo]);

  useEffect(() => {
    if (!showAdModal) return;
    if (adCountdown <= 0) return;
    const timer = setTimeout(() => {
      setAdCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [showAdModal, adCountdown]);
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

  const persistAnalysis = useCallback(async (nextAnalysis: SessionAnalysis) => {
    const { saveSessionPackage } = await loadSessionPackageService();
    const savedPackage = await saveSessionPackage({ analysis: nextAnalysis });
    setAnalysis((current) =>
      current
        ? {
            ...current,
            workspacePath: savedPackage.workspacePath,
          }
        : current
    );
    return savedPackage;
  }, []);

  const refreshWorkspaceData = useCallback(async () => {
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
      setWorkspaceError(error?.message || t('App.workspaceLoadError'));
    }
  }, [t]);

  useEffect(() => {
    // Initialize TSrecord folder
    loadSessionPackageService()
      .then(({ initAppStorage }) => initAppStorage())
      .catch(console.error);
    void refreshWorkspaceData();
    void fetchLicenseAndSettings();

    const timer = setTimeout(() => {
      loadUpdateService()
        .then(({ checkForUpdate }) => checkForUpdate())
        .then((release) => {
          if (release) setUpdateRelease(release);
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearTimeout(timer);
  }, [fetchLicenseAndSettings]);

  useEffect(() => {
    let cancelled = false;

    const inspectBackgroundResumeState = async () => {
      try {
        const { clearPendingProcessingResume, getPendingProcessingResumeState } =
          await loadBackgroundProcessingScheduler();
        const pendingState = await getPendingProcessingResumeState();
        if (cancelled) return;

        if (pendingState.state === 'triggered') {
          await refreshWorkspaceData();
          await clearPendingProcessingResume(pendingState.jobId || undefined);
          if (!cancelled) {
            showToast(t('App.toast.backgroundResumeTriggered'));
          }
        }
      } catch (error) {
        console.warn('Background resume inspection failed:', error);
      }
    };

    void inspectBackgroundResumeState();
    return () => {
      cancelled = true;
    };
  }, [t]);

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
      if (activeModule === AppModule.AUDIO_EDITOR) {
        void loadStepAudioEditor();
        return;
      }
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

  const resetSharedState = useCallback(() => {
    setFile(null);
    setAdditionalFiles([]);
    setAnalysis(null);
    setSavedRecording(null);
    setProcessingState({ status: 'idle' });
    setFileName('');
    setEmail('');
    setMode(ExtractionMode.TIMELINE);
    setStep(1);
  }, []);

  const activateModule = useCallback((module: AppModule) => {
    if (isFreeAdTier && module === AppModule.RECORD_NOTES) {
      alert('Bản dùng thử qua quảng cáo không hỗ trợ Ghi âm cuộc họp. Vui lòng mua gói hoặc tự điền API Key riêng.');
      return;
    }
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

    if (module === AppModule.AUDIO_EDITOR) {
      void loadStepAudioEditor();
      setSource(InputSource.UPLOAD);
      setSessionContext(SessionContext.TRANSCRIPTION);
      return;
    }

    void loadStepRecord();
    void loadStepMode();
    setSource(InputSource.RECORDING);
    setSessionContext(SessionContext.MEETING);
  }, [resetSharedState, isFreeAdTier]);

  const handleLeaveModule = useCallback(() => {
    setShowWorkspace(false);
    setActiveModule(null);
    resetSharedState();
    setActiveProjectId(null);
    setSource(InputSource.UPLOAD);
    setSessionContext(SessionContext.TRANSCRIPTION);
  }, [resetSharedState]);

  const handleOpenWorkspace = useCallback(() => {
    setShowWorkspace(true);
    setActiveModule(null);
    resetSharedState();
    setSource(InputSource.UPLOAD);
    setSessionContext(SessionContext.TRANSCRIPTION);
    void refreshWorkspaceData();
  }, [resetSharedState, refreshWorkspaceData]);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  const handleOpenWorkspaceSession = useCallback(async (session: WorkspaceSessionSummary) => {
    const restored = await loadWorkspaceSession(session);

    if (!restored) {
      showToast(t('App.toast.sessionLoadError'));
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
  }, [t, showToast]);

  const handleInputNext = useCallback(() => setStep(2), []);
  const handleModeBack = useCallback(() => setStep(1), []);
  const handleResultNext = useCallback(() => setStep(4), []);

  const executeTranscription = useCallback(async () => {
    if (!file) return;
    let draftForRecovery: SessionAnalysis | null = null;

    setProcessingState({
      status: 'processing',
      stageLabel:
        sessionContext === SessionContext.MEETING
          ? t('App.processing_meeting')
          : sessionContext === SessionContext.INTERVIEW
            ? t('App.processing_interview')
            : t('App.processing_general'),
    });

    try {
      const { analyzeSessionDraft, transcribeSessionDraft } = await loadTranscriptionOrchestrator();
      const draftAnalysis = await transcribeSessionDraft({
        file,
        mode,
        source,
        context: sessionContext,
        savedRecording,
        additionalFiles,
        onStageChange: (stage) =>
          setProcessingState((prev) => ({ ...prev, stageLabel: stage })),
        onProgress: (progress) =>
          setProcessingState((prev) => ({
            ...prev,
            ...progress,
          })),
      });

      const normalizedDraft: SessionAnalysis = {
        ...draftAnalysis,
        createdAt: draftAnalysis.createdAt || new Date().toISOString(),
        originalFileName: draftAnalysis.originalFileName || file.name,
      };
      draftForRecovery = normalizedDraft;

      setAnalysis(normalizedDraft);
      try {
        await persistAnalysis(normalizedDraft);
        void refreshWorkspaceData();
      } catch (saveError) {
        console.error('Auto-save draft session failed:', saveError);
      }

      if (sessionContext === SessionContext.TRANSCRIPTION) {
        setStep(3);
        setProcessingState({
          status: 'success',
          phase: 'saving',
          stageLabel: t('App.processing_done'),
          progressLabel: '100%',
        });
        return;
      }

      const finalizedAnalysis = await analyzeSessionDraft({
        draft: normalizedDraft,
        file,
        additionalFiles,
        onStageChange: (stage) =>
          setProcessingState((prev) => ({ ...prev, stageLabel: stage })),
        onProgress: (progress) =>
          setProcessingState((prev) => ({
            ...prev,
            ...progress,
          })),
      });

      const normalizedFinal: SessionAnalysis = {
        ...finalizedAnalysis,
        workspacePath: normalizedDraft.workspacePath || finalizedAnalysis.workspacePath,
        createdAt: normalizedDraft.createdAt || finalizedAnalysis.createdAt,
        originalFileName: normalizedDraft.originalFileName || finalizedAnalysis.originalFileName,
      };

      setAnalysis(normalizedFinal);
      setStep(3);
      setProcessingState({
        status: 'success',
        phase: 'saving',
        stageLabel: t('App.processing_done'),
        progressLabel: '100%',
      });

      try {
        await persistAnalysis(normalizedFinal);
        void refreshWorkspaceData();
      } catch (saveError) {
        console.error('Auto-save session failed:', saveError);
      }
    } catch (error: unknown) {
      const recoveryDraft =
        error && typeof error === 'object' && 'recoveryDraft' in error
          ? ((error as { recoveryDraft?: SessionAnalysis }).recoveryDraft ?? null)
          : null;
      const message = getErrorMessage(error, t('App.errors.processFile'));
      const nextRecoveryDraft = draftForRecovery || recoveryDraft;
      if (nextRecoveryDraft) {
        setAnalysis(nextRecoveryDraft);
        setStep(3);
        try {
          await persistAnalysis(nextRecoveryDraft);
          void refreshWorkspaceData();
        } catch (saveError) {
          console.error('Auto-save recovery session failed:', saveError);
        }
      }
      setProcessingState({
        status: 'error',
        errorMessage: message,
      });
      showToast(message);
      setTimeout(() => {
        setProcessingState((prev) =>
          prev.status === 'error' ? { status: 'idle' } : prev
        );
      }, 3000);
    }
  }, [file, mode, source, sessionContext, savedRecording, additionalFiles, t, showToast, persistAnalysis, refreshWorkspaceData]);

  const executeTranscriptionRef = useRef(executeTranscription);
  useEffect(() => {
    executeTranscriptionRef.current = executeTranscription;
  }, [executeTranscription]);

  const handleAdFinished = useCallback(async () => {
    try {
      const { getDeviceId } = await import('./services/aiSettingsService');
      const deviceId = await getDeviceId();
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/api/client/ads/watched`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      if (!response.ok) {
        throw new Error('Lỗi ghi nhận lượt xem quảng cáo.');
      }
      setShowAdModal(false);
      void executeTranscriptionRef.current();
    } catch (err: any) {
      alert(err.message || 'Lỗi xử lý quảng cáo.');
      setShowAdModal(false);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    if (isFreeAdTier) {
      setShowAdModal(true);
      setAdCountdown(10);
      return;
    }
    await executeTranscription();
  }, [file, isFreeAdTier, executeTranscription]);

  const handleReanalyzeDraft = useCallback(async () => {
    if (!analysis) return;

    setProcessingState({
      status: 'processing',
      phase: 'analyzing',
      stageLabel: t('App.reanalyze.stageLabel'),
      progressLabel: analysis.workspacePath ? t('App.reanalyze.progressLabel') : undefined,
    });

    try {
      const { analyzeSessionDraft } = await loadTranscriptionOrchestrator();
      const finalizedAnalysis = await analyzeSessionDraft({
        draft: analysis,
        file,
        additionalFiles,
        onStageChange: (stage) =>
          setProcessingState((prev) => ({ ...prev, stageLabel: stage })),
        onProgress: (progress) =>
          setProcessingState((prev) => ({
            ...prev,
            ...progress,
          })),
      });

      const normalizedFinal: SessionAnalysis = {
        ...finalizedAnalysis,
        workspacePath: analysis.workspacePath || finalizedAnalysis.workspacePath,
        createdAt: analysis.createdAt || finalizedAnalysis.createdAt || new Date().toISOString(),
        originalFileName: analysis.originalFileName || finalizedAnalysis.originalFileName,
      };

      setAnalysis(normalizedFinal);
      setProcessingState({
        status: 'success',
        phase: 'saving',
        stageLabel: t('App.processing_done'),
        progressLabel: '100%',
      });

      try {
        await persistAnalysis(normalizedFinal);
        void refreshWorkspaceData();
      } catch (saveError) {
        console.error('Auto-save reanalyzed session failed:', saveError);
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, t('App.errors.reanalyzeTranscript'));
      setProcessingState({
        status: 'error',
        errorMessage: message,
      });
      showToast(message);
      setTimeout(() => {
        setProcessingState((prev) =>
          prev.status === 'error' ? { status: 'idle' } : prev
        );
      }, 3000);
    }
  }, [analysis, file, additionalFiles, t, showToast, persistAnalysis, refreshWorkspaceData]);

  const handleResumeTranscription = useCallback(async () => {
    if (!analysis?.savedRecording?.path) {
      showToast(t('App.errors.resumeTranscription'));
      return;
    }

    setProcessingState({
      status: 'processing',
      phase: 'transcribing',
      stageLabel: t('App.resumeTranscription.stageLabel'),
      progressLabel: t('App.resumeTranscription.progressLabel'),
    });

    try {
      const { loadSavedRecordingFile } = await loadRecordingService();
      const restoredFile = await loadSavedRecordingFile({
        path: analysis.savedRecording.path,
        fileName: analysis.originalFileName || analysis.savedRecording.fileName,
      });

      setFile(restoredFile);
      setSavedRecording(analysis.savedRecording);
      setSource(analysis.source);
      setSessionContext(analysis.context);
      setMode(analysis.mode);

      const { analyzeSessionDraft, transcribeSessionDraft } = await loadTranscriptionOrchestrator();
      const resumedDraft = await transcribeSessionDraft({
        file: restoredFile,
        mode: analysis.mode,
        source: analysis.source,
        context: analysis.context,
        savedRecording: analysis.savedRecording,
        additionalFiles,
        onStageChange: (stage) =>
          setProcessingState((prev) => ({ ...prev, stageLabel: stage })),
        onProgress: (progress) =>
          setProcessingState((prev) => ({
            ...prev,
            ...progress,
          })),
      });

      const normalizedDraft: SessionAnalysis = {
        ...analysis,
        ...resumedDraft,
        workspacePath: analysis.workspacePath || resumedDraft.workspacePath,
        createdAt: analysis.createdAt || resumedDraft.createdAt || new Date().toISOString(),
        originalFileName: analysis.originalFileName || resumedDraft.originalFileName || restoredFile.name,
      };

      setAnalysis(normalizedDraft);
      try {
        await persistAnalysis(normalizedDraft);
        void refreshWorkspaceData();
      } catch (saveError) {
        console.error('Auto-save resumed draft session failed:', saveError);
      }

      if (analysis.context === SessionContext.TRANSCRIPTION) {
        setStep(3);
        setProcessingState({
          status: 'success',
          phase: 'saving',
          stageLabel: t('App.processing_done'),
          progressLabel: '100%',
        });
        return;
      }

      const finalizedAnalysis = await analyzeSessionDraft({
        draft: normalizedDraft,
        file: restoredFile,
        additionalFiles,
        onStageChange: (stage) =>
          setProcessingState((prev) => ({ ...prev, stageLabel: stage })),
        onProgress: (progress) =>
          setProcessingState((prev) => ({
            ...prev,
            ...progress,
          })),
      });

      const normalizedFinal: SessionAnalysis = {
        ...finalizedAnalysis,
        workspacePath: normalizedDraft.workspacePath || finalizedAnalysis.workspacePath,
        createdAt: normalizedDraft.createdAt || finalizedAnalysis.createdAt || new Date().toISOString(),
        originalFileName: normalizedDraft.originalFileName || finalizedAnalysis.originalFileName,
      };

      setAnalysis(normalizedFinal);
      setStep(3);
      setProcessingState({
        status: 'success',
        phase: 'saving',
        stageLabel: t('App.processing_done'),
        progressLabel: '100%',
      });

      try {
        await persistAnalysis(normalizedFinal);
        void refreshWorkspaceData();
      } catch (saveError) {
        console.error('Auto-save resumed session failed:', saveError);
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, t('App.errors.resumeTranscription'));
      setProcessingState({
        status: 'error',
        errorMessage: message,
      });
      showToast(message);
      setTimeout(() => {
        setProcessingState((prev) =>
          prev.status === 'error' ? { status: 'idle' } : prev
        );
      }, 3000);
    }
  }, [analysis, additionalFiles, t, showToast, persistAnalysis, refreshWorkspaceData]);

  const handleReset = useCallback(() => {
    if (!activeModule) {
      handleLeaveModule();
      return;
    }

    activateModule(activeModule);
  }, [activeModule, activateModule, handleLeaveModule]);

  const handleAudioEditorSendToTranscribe = useCallback((editedFile: File) => {
    setShowWorkspace(false);
    setActiveModule(AppModule.TRANSCRIBE);
    exportEnginesPrefetchedRef.current = false;
    setSource(InputSource.UPLOAD);
    setSessionContext(SessionContext.TRANSCRIPTION);
    setFile(editedFile);
    setAdditionalFiles([]);
    setSavedRecording(null);
    setAnalysis(null);
    setProcessingState({ status: 'idle' });
    setFileName('');
    setEmail('');
    setMode(ExtractionMode.TIMELINE);
    setStep(2);
  }, []);

  const moduleTitle = useMemo(() => {
    return showWorkspace
      ? t('App.titleWorkspace')
      : activeModule === AppModule.RECORD_NOTES
      ? t('App.titleRecord')
      : activeModule === AppModule.TRANSCRIBE
        ? t('App.titleTranscribe')
        : activeModule === AppModule.AUDIO_EDITOR
          ? titleAudioEditorT === 'App.titleAudioEditor'
            ? 'Audio Editor'
            : titleAudioEditorT
        : t('App.title');
  }, [showWorkspace, activeModule, titleAudioEditorT, t]);

  const moduleSubtitle = useMemo(() => {
    return showWorkspace
      ? t('App.titleWorkspace')
      : activeModule === AppModule.RECORD_NOTES
      ? t('App.subtitleRecord')
      : activeModule === AppModule.TRANSCRIBE
        ? t('App.subtitleTranscribe')
        : activeModule === AppModule.AUDIO_EDITOR
          ? subtitleAudioEditorT === 'App.subtitleAudioEditor'
            ? 'AUDIO EDITING MODULE'
            : subtitleAudioEditorT
        : t('App.subtitle');
  }, [showWorkspace, activeModule, subtitleAudioEditorT, t]);

  const visibleWorkspaceSessions = useMemo(
    () => filterWorkspaceSessions(workspaceSessions, deferredWorkspaceQuery),
    [workspaceSessions, deferredWorkspaceQuery]
  );
  const latestWorkspaceSession = workspaceSessions[0];

  const handleCreateProject = useCallback(async (name: string) => {
    try {
      const projects = await createWorkspaceProject(name);
      setWorkspaceProjects(projects);
      setActiveProjectId(projects[0]?.id || null);
    } catch (error: unknown) {
      showToast(getErrorMessage(error, t('App.errors.createProject')));
    }
  }, [t, showToast]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    const target = workspaceProjects.find((project) => project.id === projectId);
    if (!target) return;

    const confirmed = window.confirm(
      t('App.deleteProjectConfirm', { name: target.name })
    );
    if (!confirmed) return;

    const projects = await deleteWorkspaceProject(projectId);
    setWorkspaceProjects(projects);
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
  }, [workspaceProjects, activeProjectId, t]);

  const handleToggleProjectPin = useCallback(async (projectId: string) => {
    const projects = await toggleWorkspaceProjectPin(projectId);
    setWorkspaceProjects(projects);
  }, []);

  const handleUpdateProject = useCallback(async (
    projectId: string,
    updates: Partial<Pick<WorkspaceProject, 'name' | 'note'>>
  ) => {
    const projects = await updateWorkspaceProject(projectId, updates);
    setWorkspaceProjects(projects);
  }, []);

  const handleAssignSessionToProject = useCallback(async (projectId: string, sessionId: string) => {
    const projects = await assignSessionToProject(projectId, sessionId);
    setWorkspaceProjects(projects);
  }, []);

  const handleRemoveSessionFromProject = useCallback(async (projectId: string, sessionId: string) => {
    const projects = await removeSessionFromProject(projectId, sessionId);
    setWorkspaceProjects(projects);
  }, []);

  const handleUpdateSessionNote = useCallback(async (sessionId: string, note: string) => {
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
  }, []);

  return (
    <div className="app-shell min-h-screen text-slate-950 selection:bg-[#0d7c66] selection:text-white">
      <div className="app-shell__mesh" />

      {!isOnline && (
        <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-md">
          <WifiOff className="h-4 w-4" />
          {t('common.offline_warning')}
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/75 backdrop-blur-xl app-header">
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
                title={t('common.home')}
              >
                <ArrowLeft className="h-4 w-4" />
                {t('common.home')}
              </button>
            )}
            <LanguageSwitcher />
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-full border border-slate-200 bg-white p-3 text-slate-500 transition-all hover:border-[#0d7c66] hover:text-[#0d7c66]"
              title={t('common.settings')}
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

      <main className={`mx-auto flex w-full max-w-6xl flex-col px-3 sm:px-4 pt-5 sm:pt-8 md:px-6 md:pt-10 ${
        licenseInfo?.adsEnabled === 1 ? 'pb-28 sm:pb-36' : 'pb-14 sm:pb-20'
      }`}>
        {!activeModule && !showWorkspace && (
          <ModuleHome
            onSelect={activateModule}
            onOpenWorkspace={handleOpenWorkspace}
            sessionCount={workspaceSessions.length}
            recentSessionTitle={latestWorkspaceSession?.title}
          />
        )}

        {showWorkspace && (
          <Suspense fallback={<ScreenSkeleton variant="workspace" label={t('App.skeleton.workspace')} />}>
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
          <Suspense fallback={<ScreenSkeleton variant="upload" label={t('App.skeleton.upload')} />}>
            <StepUpload
              sessionContext={sessionContext}
              setSessionContext={setSessionContext}
              file={file}
              setFile={setFile}
              additionalFiles={additionalFiles}
              setAdditionalFiles={setAdditionalFiles}
              onNext={handleInputNext}
              isFreeAdTier={isFreeAdTier}
            />
          </Suspense>
        )}

        {activeModule === AppModule.RECORD_NOTES && step === 1 && (
          <Suspense fallback={<ScreenSkeleton variant="record" label={t('App.skeleton.record')} />}>
            <StepRecord
              sessionContext={sessionContext}
              setSessionContext={setSessionContext}
              file={file}
              setFile={setFile}
              savedRecording={savedRecording}
              setSavedRecording={setSavedRecording}
              additionalFiles={additionalFiles}
              setAdditionalFiles={setAdditionalFiles}
              onNext={handleInputNext}
            />
          </Suspense>
        )}

        {activeModule === AppModule.AUDIO_EDITOR && step === 1 && (
          <Suspense fallback={<ScreenSkeleton variant="audioEditor" label={t('App.skeleton.audioEditor')} />}>
            <StepAudioEditor onSendToTranscribe={handleAudioEditorSendToTranscribe} />
          </Suspense>
        )}

        {activeModule && step === 2 && (
          <Suspense fallback={<ScreenSkeleton variant="mode" label={t('App.skeleton.mode')} />}>
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
          <Suspense fallback={<ScreenSkeleton variant="result" label={t('App.skeleton.result')} />}>
            <StepResult
              analysis={analysis}
              setAnalysis={setAnalysis}
              onNext={handleResultNext}
              onReanalyze={analysis.context === SessionContext.TRANSCRIPTION ? undefined : handleReanalyzeDraft}
              onResumeTranscription={handleResumeTranscription}
              isReanalyzing={processingState.status === 'processing'}
              isResumingTranscription={processingState.status === 'processing'}
            />
          </Suspense>
        )}

        {activeModule && step === 4 && analysis && (
          <Suspense fallback={<ScreenSkeleton variant="export" label={t('App.skeleton.export')} />}>
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
              onClose={() => {
                setShowSettings(false);
                void fetchLicenseAndSettings();
              }}
              onStorageCleared={async () => {
                setAnalysis(null);
                setSavedRecording(null);
                setFile(null);
                setFileName('');
                setEmail('');
                setProcessingState({ status: 'idle' });
                await refreshWorkspaceData();
                void fetchLicenseAndSettings();
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

      {/* Bottom Ad Banner */}
      {licenseInfo?.adsEnabled === 1 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200 py-2.5 px-4 backdrop-blur-md flex items-center justify-center shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
          <div className="w-full max-w-4xl flex items-center justify-center relative min-h-[50px]">
            {customBannerEnabled && customBannerHtml ? (
              <div 
                dangerouslySetInnerHTML={{ __html: customBannerHtml }}
                className="w-full text-center flex justify-center"
              />
            ) : (
              <a 
                href="#upgrade" 
                onClick={(e) => {
                  e.preventDefault();
                  setShowSettings(true);
                }}
                className="flex items-center gap-3 bg-gradient-to-r from-[#006b68] to-[#0d7c66] hover:from-[#005553] hover:to-[#0a6352] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all hover:scale-[1.01] max-w-full text-center"
              >
                <Sparkles className="h-4.5 w-4.5 text-[#7af2d1] shrink-0 animate-pulse" />
                <span>Nâng cấp TSrecord Premium chỉ từ 39k/tháng: Trích xuất không giới hạn thời lượng, không quảng cáo!</span>
                <span className="bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0">Mua Ngay</span>
              </a>
            )}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-100 text-slate-400 text-[8px] font-extrabold px-1 rounded uppercase tracking-wider scale-90 select-none">
              Quảng cáo
            </div>
          </div>
        </div>
      )}

      {/* Rewarded Ad Dialog (Mock) */}
      {showAdModal && (
        <div className="fixed inset-0 bg-slate-950/85 z-[150] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-center relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                const ok = window.confirm('Bạn có chắc chắn muốn bỏ qua quảng cáo? Bạn sẽ không thể sử dụng Key Admin dùng thử miễn phí.');
                if (ok) {
                  setShowAdModal(false);
                  setAdCountdown(0);
                }
              }}
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-bold text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                Video tài trợ
              </div>
              <h3 className="text-lg font-extrabold text-white">Xem quảng cáo dùng thử Key Admin</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sau khi xem hết quảng cáo ngắn này, bạn sẽ nhận được 1 lượt dùng thử dịch và xử lý file âm thanh lên đến 5 phút.
              </p>
              
              <div className="w-full aspect-video rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center overflow-hidden border border-slate-800 relative mt-2">
                {adCountdown > 0 ? (
                  <>
                    <Loader2 className="h-10 w-10 text-[#0d7c66] animate-spin mb-3" />
                    <div className="text-2xl font-black text-white">{adCountdown}s</div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Quảng cáo đang tải...</div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2 animate-bounce" />
                    <div className="text-sm font-bold text-white">Đã xem xong quảng cáo!</div>
                    <div className="text-xs text-slate-400 mt-1">Lượt dùng thử của bạn đã sẵn sàng.</div>
                  </div>
                )}
              </div>

              <button
                disabled={adCountdown > 0}
                onClick={handleAdFinished}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 text-white font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/10 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed mt-3"
              >
                {adCountdown > 0 ? `Đóng sau ${adCountdown}s` : 'Bắt đầu trích xuất (5 phút)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
