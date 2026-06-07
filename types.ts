export enum ExtractionMode {
  TIMELINE = 'TIMELINE',
  PLAIN = 'PLAIN',
}

export enum AppModule {
  TRANSCRIBE = 'TRANSCRIBE',
  RECORD_NOTES = 'RECORD_NOTES',
  AUDIO_EDITOR = 'AUDIO_EDITOR',
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
  transcriptPreview?: string;
  completedBatchCount?: number;
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
  analysisStatus?: 'draft_transcript' | 'complete';
  savedRecording?: SavedDeviceFile | null;
  workspacePath?: string;
  createdAt?: string;
  originalFileName?: string;
  processingJobId?: string;
  processingJobStatus?: TranscriptProcessingJob['status'];
  processingJobCurrentBatch?: number;
  processingJobTotalBatches?: number;
  processingSavedBatchCount?: number;
  processingFailedBatchCount?: number;
  processingLastFailedBatchIndex?: number | null;
  processingLastErrorMessage?: string | null;
  transcriptBatches?: TranscriptBatchRecord[];
}

export interface TranscriptBatchRecord {
  batchIndex: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface TranscriptProcessingBatchCheckpoint {
  batchIndex: number;
  microChunkIndexes: number[];
  startMs: number;
  endMs: number;
  uploadStatus: 'pending' | 'uploaded' | 'failed';
  transcribeStatus: 'pending' | 'done' | 'failed';
  saveStatus: 'pending' | 'saved' | 'failed';
  retryCount: number;
  audioTempPath?: string | null;
  textPath?: string | null;
  errorMessage?: string | null;
  updatedAt: string;
}

export interface TranscriptProcessingJob {
  id: string;
  workspacePath: string;
  sourceAudioPath: string;
  sourceAudioFileName: string;
  status: 'pending' | 'processing' | 'paused' | 'complete' | 'failed';
  provider: string;
  mode: ExtractionMode;
  source: InputSource;
  context: SessionContext;
  currentBatch: number;
  totalBatches: number;
  createdAt: string;
  updatedAt: string;
  transcriptTextPath: string;
  transcriptBatchesPath: string;
  microChunkMinutes: number;
  macroBatchMinutes: number;
}

export interface WorkspaceSessionSummary {
  id: string;
  title: string;
  context: SessionContext;
  source: InputSource;
  mode: ExtractionMode;
  analysisStatus?: 'draft_transcript' | 'complete';
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
