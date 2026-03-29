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
  | 'folderTree'
  | 'mindmap'
  | 'actionItems';

export interface ProcessingState {
  status: 'idle' | 'processing' | 'success' | 'error';
  errorMessage?: string;
  stageLabel?: string;
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
}
