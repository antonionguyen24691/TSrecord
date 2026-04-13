import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import {
  ExtractionMode,
  InputSource,
  SessionAnalysis,
  SessionArtifacts,
  SessionContext,
  WorkspaceProject,
  WorkspaceSessionSummary,
} from '../types';

const STORAGE_ROOT = 'TSrecord';
const SESSION_CACHE_INDEX_KEY = 'tsrecord.workspace.index.v1';
const SESSION_CACHE_ITEM_PREFIX = 'tsrecord.workspace.session.';
const PROJECTS_STORAGE_KEY = 'tsrecord.workspace.projects.v1';
const SESSION_NOTES_STORAGE_KEY = 'tsrecord.workspace.sessionNotes.v1';

interface CachedSessionRecord {
  id: string;
  workspacePath: string;
  analysis: SessionAnalysis;
  updatedAt: string;
}

type SessionNotesRecord = Record<string, string>;

const emptyArtifacts = (): SessionArtifacts => ({
  transcript: '',
  summary: '',
  decisions: '',
  risks: '',
  folderTree: '',
  mindmap: '',
  actionItems: '',
});

const trimPreview = (value: string, limit = 220) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > limit ? `${normalized.slice(0, limit).trim()}...` : normalized;
};

const buildSessionId = (workspacePath: string, createdAt: string) =>
  `${workspacePath}::${createdAt}`;

const normalizeAnalysis = (
  analysis: SessionAnalysis,
  workspacePath: string,
  fallbackCreatedAt?: string
): SessionAnalysis => ({
  ...analysis,
  artifacts: {
    ...emptyArtifacts(),
    ...analysis.artifacts,
  },
  workspacePath,
  createdAt: analysis.createdAt || fallbackCreatedAt || new Date().toISOString(),
});

const toSummary = (
  analysis: SessionAnalysis,
  isNative: boolean,
  note = ''
): WorkspaceSessionSummary => {
  const workspacePath = analysis.workspacePath || analysis.savedRecording?.workspacePath || STORAGE_ROOT;
  const createdAt = analysis.createdAt || new Date().toISOString();

  return {
    id: buildSessionId(workspacePath, createdAt),
    title: analysis.title || 'Phiên chưa đặt tên',
    context: analysis.context,
    source: analysis.source,
    mode: analysis.mode,
    createdAt,
    workspacePath,
    transcriptPreview: trimPreview(analysis.artifacts.transcript),
    summaryPreview: trimPreview(analysis.artifacts.summary),
    actionItemsPreview: trimPreview(analysis.artifacts.actionItems),
    note,
    savedRecordingPath: analysis.savedRecording?.path || null,
    isNative,
  };
};

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const readJson = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const compareProjects = (a: WorkspaceProject, b: WorkspaceProject) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return b.updatedAt.localeCompare(a.updatedAt);
};

const sanitizeProjects = (projects: WorkspaceProject[]) =>
  projects
    .map((project) => ({
      id: project.id,
      name: project.name?.trim() || 'Dự án chưa đặt tên',
      note: project.note || '',
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: project.updatedAt || project.createdAt || new Date().toISOString(),
      pinned: Boolean(project.pinned),
      sessionIds: Array.from(new Set(project.sessionIds || [])),
    }))
    .sort(compareProjects);

const readProjects = async () => {
  const result = await Preferences.get({ key: PROJECTS_STORAGE_KEY });
  return sanitizeProjects(readJson<WorkspaceProject[]>(result.value) || []);
};

const writeProjects = async (projects: WorkspaceProject[]) => {
  const normalized = sanitizeProjects(projects);
  await Preferences.set({
    key: PROJECTS_STORAGE_KEY,
    value: JSON.stringify(normalized),
  });
  return normalized;
};

const sanitizeSessionNotes = (notes: SessionNotesRecord) =>
  Object.fromEntries(
    Object.entries(notes)
      .map(([sessionId, note]) => [sessionId, typeof note === 'string' ? note : ''])
      .filter(([sessionId, note]) => sessionId && note.trim())
  );

const readSessionNotes = async () => {
  const result = await Preferences.get({ key: SESSION_NOTES_STORAGE_KEY });
  return sanitizeSessionNotes(readJson<SessionNotesRecord>(result.value) || {});
};

const writeSessionNotes = async (notes: SessionNotesRecord) => {
  const normalized = sanitizeSessionNotes(notes);
  await Preferences.set({
    key: SESSION_NOTES_STORAGE_KEY,
    value: JSON.stringify(normalized),
  });
  return normalized;
};

const readCachedIndex = () => {
  const storage = getStorage();
  if (!storage) return [] as string[];
  return readJson<string[]>(storage.getItem(SESSION_CACHE_INDEX_KEY)) || [];
};

const writeCachedIndex = (ids: string[]) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(SESSION_CACHE_INDEX_KEY, JSON.stringify(ids));
};

const readCachedRecord = (id: string) => {
  const storage = getStorage();
  if (!storage) return null as CachedSessionRecord | null;
  return readJson<CachedSessionRecord>(storage.getItem(`${SESSION_CACHE_ITEM_PREFIX}${id}`));
};

const writeCachedRecord = (record: CachedSessionRecord) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(`${SESSION_CACHE_ITEM_PREFIX}${record.id}`, JSON.stringify(record));
};

const readTextFile = async (path: string) => {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    return typeof result.data === 'string' ? result.data : '';
  } catch {
    return '';
  }
};

const loadNativeWorkspaceSession = async (workspacePath: string): Promise<SessionAnalysis | null> => {
  const sessionJsonPath = `${workspacePath}/analysis/session.json`;
  const sessionJson = await readTextFile(sessionJsonPath);

  if (sessionJson) {
    const parsed = readJson<SessionAnalysis>(sessionJson);
    if (parsed) {
      return normalizeAnalysis(parsed, workspacePath);
    }
  }

  const metadataText = await readTextFile(`${workspacePath}/analysis/metadata.json`);
  const metadata = readJson<{
    title?: string;
    source?: InputSource;
    context?: SessionContext;
    mode?: ExtractionMode;
    createdAt?: string;
    originalFileName?: string;
    recordingPath?: string | null;
  }>(metadataText);

  if (!metadata) return null;

  const context = metadata.context || SessionContext.TRANSCRIPTION;
  const artifacts: SessionArtifacts = {
    transcript: await readTextFile(`${workspacePath}/analysis/transcript.txt`),
    summary:
      context === SessionContext.MEETING
        ? await readTextFile(`${workspacePath}/analysis/summary.md`)
        : '',
    decisions:
      context === SessionContext.MEETING
        ? await readTextFile(`${workspacePath}/analysis/decisions.md`)
        : '',
    risks:
      context === SessionContext.MEETING
        ? await readTextFile(`${workspacePath}/analysis/risks.md`)
        : '',
    folderTree:
      context === SessionContext.MEETING
        ? await readTextFile(`${workspacePath}/maps/folder-tree.txt`)
        : '',
    mindmap:
      context === SessionContext.MEETING
        ? await readTextFile(`${workspacePath}/maps/mindmap.md`)
        : '',
    actionItems:
      context === SessionContext.MEETING
        ? await readTextFile(`${workspacePath}/analysis/action-items.md`)
        : '',
  };

  return normalizeAnalysis(
    {
      title: metadata.title || 'Phiên làm việc',
      source: metadata.source || InputSource.UPLOAD,
      context,
      mode: metadata.mode || ExtractionMode.TIMELINE,
      suggestedFolderName: workspacePath.split('/').pop() || 'session',
      artifacts,
      savedRecording: metadata.recordingPath
        ? {
            fileName: metadata.recordingPath.split('/').pop() || 'recording',
            path: metadata.recordingPath,
            uri: '',
            workspacePath,
            directoryLabel: `Documents/${STORAGE_ROOT}`,
          }
        : null,
      originalFileName: metadata.originalFileName,
      createdAt: metadata.createdAt,
      workspacePath,
    },
    workspacePath,
    metadata.createdAt
  );
};

const listNativeWorkspaceSessions = async () => {
  if (!Capacitor.isNativePlatform()) return [] as WorkspaceSessionSummary[];

  try {
    const root = await Filesystem.readdir({
      path: STORAGE_ROOT,
      directory: Directory.Documents,
    });

    const workspaceNames = root.files
      .map((entry: any) => (typeof entry === 'string' ? entry : (entry?.name as string | undefined)))
      .filter((name): name is string => Boolean(name) && name !== 'exports');

    const sessions = await Promise.all(
      workspaceNames.map(async (name) => {
        const workspacePath = `${STORAGE_ROOT}/${name}`;
        const analysis = await loadNativeWorkspaceSession(workspacePath);
        return analysis ? toSummary(analysis, true) : null;
      })
    );

    return sessions
      .filter((session): session is WorkspaceSessionSummary => Boolean(session))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
};

const listCachedWorkspaceSessions = () => {
  const ids = readCachedIndex();
  const records = ids
    .map((id) => readCachedRecord(id))
    .filter((record): record is CachedSessionRecord => Boolean(record))
    .map((record) => toSummary(record.analysis, false));

  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const cacheWorkspaceSession = (analysis: SessionAnalysis, workspacePath: string) => {
  const normalized = normalizeAnalysis(analysis, workspacePath);
  const id = buildSessionId(workspacePath, normalized.createdAt || new Date().toISOString());
  const record: CachedSessionRecord = {
    id,
    workspacePath,
    analysis: normalized,
    updatedAt: new Date().toISOString(),
  };

  writeCachedRecord(record);
  const nextIndex = [id, ...readCachedIndex().filter((currentId) => currentId !== id)];
  writeCachedIndex(nextIndex.slice(0, 200));
};

export const listWorkspaceSessions = async () => {
  const nativeSessions = await listNativeWorkspaceSessions();
  const cachedSessions = listCachedWorkspaceSessions();
  const sessionNotes = await readSessionNotes();
  const deduped = new Map<string, WorkspaceSessionSummary>();

  [...nativeSessions, ...cachedSessions].forEach((session) => {
    if (!deduped.has(session.id)) {
      deduped.set(session.id, {
        ...session,
        note: sessionNotes[session.id] || session.note || '',
      });
    }
  });

  return Array.from(deduped.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const filterWorkspaceSessions = (
  sessions: WorkspaceSessionSummary[],
  query: string
) => {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return sessions;

  return sessions.filter((session) => {
    const haystack = [
      session.title,
      session.workspacePath,
      session.transcriptPreview,
      session.summaryPreview,
      session.actionItemsPreview,
      session.note,
      session.savedRecordingPath || '',
      session.context,
      session.source,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(keyword);
  });
};

export const loadWorkspaceSession = async (session: WorkspaceSessionSummary) => {
  if (session.isNative && session.workspacePath) {
    const nativeSession = await loadNativeWorkspaceSession(session.workspacePath);
    if (nativeSession) return nativeSession;
  }

  const cached = readCachedRecord(session.id);
  if (cached?.analysis) {
    return normalizeAnalysis(cached.analysis, cached.workspacePath, cached.analysis.createdAt);
  }

  return null;
};

export const listWorkspaceProjects = async () => readProjects();

export const createWorkspaceProject = async (name: string) => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Vui lòng nhập tên dự án.');
  }

  const projects = await readProjects();
  const timestamp = new Date().toISOString();
  const nextProject: WorkspaceProject = {
    id: `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    note: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    pinned: false,
    sessionIds: [],
  };

  return writeProjects([nextProject, ...projects]);
};

export const updateWorkspaceProject = async (
  projectId: string,
  updates: Partial<Pick<WorkspaceProject, 'name' | 'note' | 'pinned' | 'sessionIds'>>
) => {
  const projects = await readProjects();
  const nextProjects = projects.map((project) => {
    if (project.id !== projectId) return project;

    const nextName = updates.name !== undefined ? updates.name.trim() || project.name : project.name;
    return {
      ...project,
      name: nextName,
      note: updates.note ?? project.note,
      pinned: updates.pinned ?? project.pinned,
      sessionIds: updates.sessionIds ? Array.from(new Set(updates.sessionIds)) : project.sessionIds,
      updatedAt: new Date().toISOString(),
    };
  });

  return writeProjects(nextProjects);
};

export const deleteWorkspaceProject = async (projectId: string) => {
  const projects = await readProjects();
  return writeProjects(projects.filter((project) => project.id !== projectId));
};

export const toggleWorkspaceProjectPin = async (projectId: string) => {
  const projects = await readProjects();
  const target = projects.find((project) => project.id === projectId);
  if (!target) return projects;
  return updateWorkspaceProject(projectId, { pinned: !target.pinned });
};

export const assignSessionToProject = async (projectId: string, sessionId: string) => {
  const projects = await readProjects();
  const target = projects.find((project) => project.id === projectId);
  if (!target) return projects;
  return updateWorkspaceProject(projectId, {
    sessionIds: [...target.sessionIds, sessionId],
  });
};

export const removeSessionFromProject = async (projectId: string, sessionId: string) => {
  const projects = await readProjects();
  const target = projects.find((project) => project.id === projectId);
  if (!target) return projects;
  return updateWorkspaceProject(projectId, {
    sessionIds: target.sessionIds.filter((id) => id !== sessionId),
  });
};

export const updateWorkspaceSessionNote = async (sessionId: string, note: string) => {
  const notes = await readSessionNotes();
  const nextNotes = {
    ...notes,
    [sessionId]: note,
  };

  if (!note.trim()) {
    delete nextNotes[sessionId];
  }

  return writeSessionNotes(nextNotes);
};
