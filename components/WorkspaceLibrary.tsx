import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  FileSearch,
  FileText,
  FolderOpen,
  FolderSearch,
  Mic,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { InputSource, SessionContext, WorkspaceProject, WorkspaceSessionSummary } from '../types';

interface WorkspaceLibraryProps {
  sessions: WorkspaceSessionSummary[];
  projects: WorkspaceProject[];
  activeProjectId: string | null;
  query: string;
  isLoading: boolean;
  errorMessage?: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onOpenSession: (session: WorkspaceSessionSummary) => void;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (projectId: string) => void;
  onToggleProjectPin: (projectId: string) => void;
  onUpdateProject: (projectId: string, updates: Partial<Pick<WorkspaceProject, 'name' | 'note'>>) => void;
  onAssignSessionToProject: (projectId: string, sessionId: string) => void;
  onRemoveSessionFromProject: (projectId: string, sessionId: string) => void;
  onUpdateSessionNote: (sessionId: string, note: string) => void;
}

const formatDateTime = (value: string, locale: string) => {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export const WorkspaceLibrary: React.FC<WorkspaceLibraryProps> = ({
  sessions,
  projects,
  activeProjectId,
  query,
  isLoading,
  errorMessage,
  onQueryChange,
  onRefresh,
  onOpenSession,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onToggleProjectPin,
  onUpdateProject,
  onAssignSessionToProject,
  onRemoveSessionFromProject,
  onUpdateSessionNote,
}) => {
  const { t, i18n } = useTranslation();
  const [newProjectName, setNewProjectName] = useState('');
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [projectNoteDraft, setProjectNoteDraft] = useState('');
  const [sessionNoteDrafts, setSessionNoteDrafts] = useState<Record<string, string>>({});
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const locale = i18n.language.startsWith('vi')
    ? 'vi-VN'
    : i18n.language.startsWith('zh')
      ? 'zh-CN'
      : i18n.language.startsWith('ko')
        ? 'ko-KR'
        : 'en-US';
  const contextMeta: Record<
    SessionContext,
    { label: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    [SessionContext.MEETING]: { label: t('WorkspaceLibrary.contexts.meeting'), icon: BriefcaseBusiness },
    [SessionContext.INTERVIEW]: { label: t('WorkspaceLibrary.contexts.interview'), icon: Users },
    [SessionContext.TRANSCRIPTION]: { label: t('WorkspaceLibrary.contexts.transcription'), icon: FileText },
  };
  const sourceMeta: Record<InputSource, string> = {
    [InputSource.RECORDING]: t('WorkspaceLibrary.sources.recording'),
    [InputSource.UPLOAD]: t('WorkspaceLibrary.sources.upload'),
  };

  const activeProject = projects.find((project) => project.id === activeProjectId) || null;
  const sessionProjectMap = useMemo(() => {
    const map = new Map<string, WorkspaceProject[]>();
    projects.forEach((project) => {
      project.sessionIds.forEach((sessionId) => {
        const current = map.get(sessionId) || [];
        current.push(project);
        map.set(sessionId, current);
      });
    });
    return map;
  }, [projects]);

  useEffect(() => {
    setProjectNameDraft(activeProject?.name || '');
    setProjectNoteDraft(activeProject?.note || '');
  }, [activeProjectId, activeProject?.name, activeProject?.note]);

  useEffect(() => {
    setSessionNoteDrafts((current) => {
      let changed = false;
      const nextDrafts = { ...current };

      sessions.forEach((session) => {
        const nextValue = session.note || '';
        if (nextDrafts[session.id] !== nextValue) {
          nextDrafts[session.id] = nextValue;
          changed = true;
        }
      });

      Object.keys(nextDrafts).forEach((sessionId) => {
        if (!sessions.some((session) => session.id === sessionId)) {
          delete nextDrafts[sessionId];
          changed = true;
        }
      });

      return changed ? nextDrafts : current;
    });
  }, [sessions]);

  useEffect(() => {
    if (!expandedSessionId) return;
    if (!sessions.some((session) => session.id === expandedSessionId)) {
      setExpandedSessionId(null);
    }
  }, [expandedSessionId, sessions]);

  const meetingCount = sessions.filter((session) => session.context === SessionContext.MEETING).length;
  const recordingCount = sessions.filter((session) => session.source === InputSource.RECORDING).length;

  const handleCreateProject = () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) return;
    onCreateProject(trimmedName);
    setNewProjectName('');
  };

  return (
    <div className="animate-fade-in">
      <section className="overflow-hidden rounded-[24px] border border-white/60 bg-white/88 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl md:rounded-[36px] md:p-8">
        <div className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-5">
            <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(145deg,#f8fffc,#ffffff_52%,#eef7ff)] p-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#0d7c66]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#0d7c66]">
                <FolderSearch className="h-4 w-4" />
                {t('WorkspaceLibrary.workspaceBadge')}
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                {t('WorkspaceLibrary.title')}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {t('WorkspaceLibrary.description')}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="col-span-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:col-span-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    {t('WorkspaceLibrary.statsSessions')}
                  </div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{sessions.length}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    {t('WorkspaceLibrary.statsProjects')}
                  </div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{projects.length}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    {t('WorkspaceLibrary.statsMeetings')}
                  </div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{meetingCount}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={onRefresh}
                className="mt-4 inline-flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:-translate-y-0.5"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                {t('WorkspaceLibrary.refresh')}
              </button>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-black uppercase tracking-[0.24em] text-slate-500">
                  {t('WorkspaceLibrary.oldProjects')}
                </div>
                <FolderOpen className="h-5 w-5 text-[#0d7c66]" />
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleCreateProject();
                    }
                  }}
                  placeholder={t('WorkspaceLibrary.newProjectPlaceholder')}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-[#0d7c66] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleCreateProject}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0d7c66] px-4 text-sm font-bold text-white shadow-lg shadow-[#0d7c66]/20 transition-all hover:-translate-y-0.5 sm:flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  {t('WorkspaceLibrary.createProject')}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => onSelectProject(null)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                    !activeProject
                      ? 'border-[#0d7c66] bg-[#0d7c66]/8 text-slate-950'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="text-sm font-bold">{t('WorkspaceLibrary.allSessions')}</div>
                  <div className="mt-1 text-xs text-slate-500">{t('WorkspaceLibrary.allSessionsDescription')}</div>
                </button>

                {projects.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    {t('WorkspaceLibrary.noProjects')}
                  </div>
                )}

                {projects.map((project) => {
                  const isActive = activeProjectId === project.id;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                        isActive
                          ? 'border-[#0d7c66] bg-[#0d7c66]/8 text-slate-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-bold">{project.name}</span>
                            {project.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {t('WorkspaceLibrary.projectCount', { count: project.sessionIds.length })}
                            {project.note.trim() ? ` • ${t('WorkspaceLibrary.projectHasNote')}` : ''}
                          </div>
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          {formatDateTime(project.updatedAt, locale)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <label className="block break-words text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:tracking-[0.28em]">
                {t('WorkspaceLibrary.searchLabel')}
              </label>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder={
                    activeProject
                      ? t('WorkspaceLibrary.searchInProject', { name: activeProject.name })
                      : t('WorkspaceLibrary.searchPlaceholder')
                  }
                  className="h-8 w-full border-0 bg-transparent text-base font-medium text-slate-900 outline-none"
                />
              </div>
              {errorMessage && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </div>
              )}
            </div>

            {activeProject && (
              <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(145deg,#f8fffc,#ffffff_52%,#f8fbff)] p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#0d7c66]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0d7c66]">
                        <FolderOpen className="h-3.5 w-3.5" />
                        {t('WorkspaceLibrary.activeProject')}
                      </div>
                      <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">
                        {t('WorkspaceLibrary.projectCount', { count: activeProject.sessionIds.length })}
                      </div>
                      <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        {t('WorkspaceLibrary.recordingCount', { count: recordingCount })}
                      </div>
                    </div>

                    <input
                      value={projectNameDraft}
                      onChange={(event) => setProjectNameDraft(event.target.value)}
                      onBlur={() => {
                        if (projectNameDraft.trim() && projectNameDraft.trim() !== activeProject.name) {
                          onUpdateProject(activeProject.id, { name: projectNameDraft.trim() });
                        } else {
                          setProjectNameDraft(activeProject.name);
                        }
                      }}
                      className="mt-4 h-14 w-full rounded-2xl border border-transparent bg-white px-4 text-2xl font-black text-slate-950 outline-none transition-all focus:border-[#0d7c66]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleProjectPin(activeProject.id)}
                      className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:-translate-y-0.5"
                    >
                      {activeProject.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      {activeProject.pinned ? t('WorkspaceLibrary.unpinProject') : t('WorkspaceLibrary.pinProject')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(activeProject.id)}
                      className="inline-flex h-12 items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 transition-all hover:-translate-y-0.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('WorkspaceLibrary.deleteProject')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectProject(null)}
                      className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-all hover:border-slate-300"
                    >
                      <X className="h-4 w-4" />
                      {t('WorkspaceLibrary.closeProject')}
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <StickyNote className="h-4 w-4 text-[#0d7c66]" />
                    {t('WorkspaceLibrary.projectNoteTitle')}
                  </div>
                  <textarea
                    value={projectNoteDraft}
                    onChange={(event) => setProjectNoteDraft(event.target.value)}
                    onBlur={() => {
                      if (projectNoteDraft !== activeProject.note) {
                        onUpdateProject(activeProject.id, { note: projectNoteDraft });
                      }
                    }}
                    className="mt-3 min-h-[150px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 outline-none transition-all focus:border-[#0d7c66] focus:bg-white"
                    placeholder={t('WorkspaceLibrary.projectNotePlaceholder')}
                  />
                </div>
              </section>
            )}

            <section className="space-y-3">
              {isLoading && sessions.length === 0 && (
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                  {t('WorkspaceLibrary.loading')}
                </div>
              )}

              {!isLoading && sessions.length === 0 && (
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#0d7c66] shadow-sm">
                    <FileSearch className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 text-xl font-black text-slate-900">
                    {query.trim() ? t('WorkspaceLibrary.emptySearchTitle') : t('WorkspaceLibrary.emptyScopeTitle')}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {query.trim()
                      ? t('WorkspaceLibrary.emptySearchDescription')
                      : activeProject
                        ? t('WorkspaceLibrary.emptyProjectDescription')
                        : t('WorkspaceLibrary.emptyGeneralDescription')}
                  </p>
                </div>
              )}

              {sessions.map((session) => {
                const meta = contextMeta[session.context];
                const ContextIcon = meta.icon;
                const memberships = sessionProjectMap.get(session.id) || [];
                const isInActiveProject =
                  activeProject ? activeProject.sessionIds.includes(session.id) : false;
                const isExpanded = expandedSessionId === session.id;

                return (
                  <article
                    key={session.id}
                    className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_10px_35px_rgba(15,23,42,0.05)] md:p-4"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setExpandedSessionId((current) => (current === session.id ? null : session.id))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setExpandedSessionId((current) => (current === session.id ? null : session.id));
                        }
                      }}
                      className="flex w-full flex-col gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#0d7c66]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0d7c66] sm:text-[11px] sm:tracking-[0.2em]">
                            <ContextIcon className="h-3.5 w-3.5" />
                            {meta.label}
                          </span>
                          <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 sm:text-[11px] sm:tracking-[0.2em]">
                            {session.source === InputSource.RECORDING ? (
                              <Mic className="h-3.5 w-3.5" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                            {sourceMeta[session.source]}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px] sm:tracking-[0.2em]">
                            {formatDateTime(session.createdAt, locale)}
                          </span>
                          {session.note.trim() && (
                            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 sm:text-[11px] sm:tracking-[0.2em]">
                              {t('WorkspaceLibrary.sessionNoteBadge')}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 break-words text-base font-black text-slate-950 md:text-lg">
                          {session.title}
                        </h3>
                      </div>

                      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenSession(session);
                          }}
                          className="inline-flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-bold uppercase tracking-[0.16em] text-white transition-all hover:-translate-y-0.5"
                        >
                          {t('WorkspaceLibrary.open')}
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                        <div className="text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                        <p className="break-all text-xs text-slate-400">{session.workspacePath}</p>

                        {memberships.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {memberships.map((project) => (
                              <button
                                key={project.id}
                                type="button"
                                onClick={() => onSelectProject(project.id)}
                                className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 transition-colors hover:bg-slate-200"
                              >
                                {project.name}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl bg-white px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                              {t('WorkspaceLibrary.summary')}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">
                              {session.summaryPreview || t('WorkspaceLibrary.summaryEmpty')}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                              {t('WorkspaceLibrary.transcript')}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">
                              {session.transcriptPreview || t('WorkspaceLibrary.transcriptEmpty')}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                              {t('WorkspaceLibrary.actionItems')}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">
                              {session.actionItemsPreview || t('WorkspaceLibrary.actionItemsEmpty')}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-[24px] border border-slate-200 bg-[linear-gradient(145deg,#fcfffd,#f8fafc)] p-4">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                            <StickyNote className="h-4 w-4 text-[#0d7c66]" />
                            {t('WorkspaceLibrary.sessionNoteTitle')}
                          </div>
                          <textarea
                            value={sessionNoteDrafts[session.id] ?? session.note ?? ''}
                            onChange={(event) =>
                              setSessionNoteDrafts((current) => ({
                                ...current,
                                [session.id]: event.target.value,
                              }))
                            }
                            onBlur={() => {
                              const nextNote = sessionNoteDrafts[session.id] ?? '';
                              if (nextNote !== session.note) {
                                onUpdateSessionNote(session.id, nextNote);
                              }
                            }}
                            className="mt-3 min-h-[118px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700 outline-none transition-all focus:border-[#0d7c66]"
                            placeholder={t('WorkspaceLibrary.sessionNotePlaceholder')}
                          />
                        </div>

                        {activeProject && (
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                isInActiveProject
                                  ? onRemoveSessionFromProject(activeProject.id, session.id)
                                  : onAssignSessionToProject(activeProject.id, session.id)
                              }
                              className={`inline-flex h-12 items-center justify-center gap-3 rounded-2xl px-5 text-sm font-bold uppercase tracking-[0.16em] transition-all ${
                                isInActiveProject
                                  ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:-translate-y-0.5'
                                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:-translate-y-0.5'
                              }`}
                            >
                              {isInActiveProject ? t('WorkspaceLibrary.removeFromProject') : t('WorkspaceLibrary.addToProject')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          </div>
        </div>
      </section>
    </div>
  );
};
