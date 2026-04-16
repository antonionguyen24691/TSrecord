export enum ExtractionMode {
  TIMELINE = 'TIMELINE',
  PLAIN = 'PLAIN',
}

export enum AppModule {
  TRANSCRIBE = 'TRANSCRIBE',
  RECORD_NOTES = 'RECORD_NOTES',
}

export enum InputSource {
  UPLOAD = 'UPLOAD',
  RECORDING = 'RECORDING',
}

export enum SessionContext {
  TRANSCRIPTION = 'TRANSCRIPTION',
  MEETING = 'MEETING',
  INTERVIEW = 'INTERVIEW',
}

export type ArtifactKey =
  | 'transcript'
  | 'summary'
  | 'decisions'
  | 'risks'
  | 'folderTree'
  | 'mindmap'
  | 'actionItems';

export interface ProcessingState {
  status: 'idle' | 'processing' | 'success' | 'error';
  errorMessage?: string;
  stageLabel?: string;
  phase?: 'preparing' | 'transcribing' | 'analyzing' | 'saving' | 'complete';
  progressCurrent?: number;
  progressTotal?: number;
  progressLabel?: string;
  chunkStatuses?: Array<{
    id: string;
    label: string;
    status: 'pending' | 'waiting' | 'processing' | 'done' | 'error';
    detail?: string;
  }>;
}

export interface SavedDeviceFile {
  fileName: string;
  path: string;
  uri: string;
  workspacePath: string;
  directoryLabel: string;
  webPath?: string;
}

export interface SessionArtifacts {
  transcript: string;
  summary: string;
  decisions: string;
  risks: string;
  folderTree: string;
  mindmap: string;
  actionItems: string;
}

export interface SessionAnalysis {
  title: string;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  suggestedFolderName: string;
  artifacts: SessionArtifacts;
  savedRecording?: SavedDeviceFile | null;
  workspacePath?: string;
  createdAt?: string;
  originalFileName?: string;
}

export interface WorkspaceSessionSummary {
  id: string;
  title: string;
  context: SessionContext;
  source: InputSource;
  mode: ExtractionMode;
  createdAt: string;
  workspacePath: string;
  transcriptPreview: string;
  summaryPreview: string;
  actionItemsPreview: string;
  note: string;
  savedRecordingPath?: string | null;
  isNative: boolean;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  sessionIds: string[];
}
