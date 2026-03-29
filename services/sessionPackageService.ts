import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import {
  ExtractionMode,
  InputSource,
  SessionAnalysis,
  SessionContext,
  SavedDeviceFile,
} from '../types';
import {
  createSessionWorkspaceName,
  sanitizeFileSegment,
} from './recordingService';

const STORAGE_ROOT = 'AITranscriber';

const labelSource = (source: InputSource) =>
  source === InputSource.RECORDING ? 'Ghi âm trực tiếp' : 'Tải file có sẵn';

const labelContext = (context: SessionContext) =>
  context === SessionContext.MEETING
    ? 'Cuộc họp'
    : context === SessionContext.INTERVIEW
      ? 'Phỏng vấn'
      : 'Trích xuất transcript';

const labelMode = (mode: ExtractionMode) =>
  mode === ExtractionMode.TIMELINE ? 'Transcript có timeline' : 'Transcript văn bản liền mạch';

const ensureDirectory = async (path: string) => {
  try {
    await Filesystem.mkdir({
      path,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch (error: any) {
    const message = `${error?.message || ''}`.toLowerCase();
    if (!message.includes('exist')) {
      throw error;
    }
  }
};

const ensureFilesystemPermission = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Filesystem.requestPermissions();
  } catch {
    // Ignore on web or when the platform handles app-scoped storage automatically.
  }
};

const writeTextFile = async (path: string, content: string) => {
  await Filesystem.writeFile({
    path,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const buildCombinedReport = (analysis: SessionAnalysis) => {
  const sections = [
    `# ${analysis.title}`,
    '',
    `- Nguồn dữ liệu: ${labelSource(analysis.source)}`,
    `- Ngữ cảnh: ${labelContext(analysis.context)}`,
    `- Định dạng transcript: ${labelMode(analysis.mode)}`,
    analysis.savedRecording?.path
      ? `- File ghi âm đã lưu: ${analysis.savedRecording.path}`
      : null,
    '',
    '## Transcript',
    analysis.artifacts.transcript.trim() || 'Chưa có transcript.',
  ].filter(Boolean) as string[];

  if (analysis.context === SessionContext.MEETING) {
    sections.push(
      '',
      '## Tóm tắt cuộc họp',
      analysis.artifacts.summary.trim() || 'Chưa có phần tóm tắt.',
      '',
      '## Cây thư mục đề xuất',
      '```text',
      analysis.artifacts.folderTree.trim() || '(trống)',
      '```',
      '',
      '## Mindmap hệ thống',
      '```mermaid',
      analysis.artifacts.mindmap.trim() || 'mindmap\n  root((Meeting))',
      '```',
      '',
      '## Việc cần làm',
      analysis.artifacts.actionItems.trim() || '- [ ] Chưa có mục hành động.'
    );
  }

  return sections.join('\n');
};

export const buildWordHtml = (title: string, reportText: string) => {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(reportText);

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>${safeTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.55; padding: 24px; color: #0f172a; }
          h1 { font-size: 22px; margin-bottom: 18px; }
          pre {
            white-space: pre-wrap;
            font-family: Consolas, 'JetBrains Mono', monospace;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
          }
        </style>
      </head>
      <body>
        <h1>${safeTitle}</h1>
        <pre>${safeBody}</pre>
      </body>
    </html>
  `.trim();
};

export const downloadTextFile = ({
  content,
  fileName,
  mimeType = 'text/plain;charset=utf-8',
}: {
  content: string;
  fileName: string;
  mimeType?: string;
}) => {
  const element = document.createElement('a');
  const file = new Blob([content], { type: mimeType });

  element.href = URL.createObjectURL(file);
  element.download = fileName;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const downloadBlobFile = ({
  blob,
  fileName,
}: {
  blob: Blob;
  fileName: string;
}) => {
  const element = document.createElement('a');

  element.href = URL.createObjectURL(blob);
  element.download = fileName;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const saveSessionPackage = async ({
  analysis,
  preferredBaseName,
}: {
  analysis: SessionAnalysis;
  preferredBaseName?: string;
}): Promise<SavedDeviceFile> => {
  await ensureFilesystemPermission();

  const baseName =
    sanitizeFileSegment(
      preferredBaseName || analysis.suggestedFolderName || analysis.title || 'session'
    ) || 'session';

  const workspacePath =
    analysis.savedRecording?.workspacePath ||
    `${STORAGE_ROOT}/${createSessionWorkspaceName(baseName)}`;

  const analysisPath = `${workspacePath}/analysis`;
  const mapsPath = `${workspacePath}/maps`;
  const exportsPath = `${workspacePath}/exports`;

  await ensureDirectory(analysisPath);
  await ensureDirectory(exportsPath);

  if (analysis.context === SessionContext.MEETING) {
    await ensureDirectory(mapsPath);
  }

  await writeTextFile(`${analysisPath}/transcript.txt`, analysis.artifacts.transcript);
  await writeTextFile(
    `${analysisPath}/metadata.json`,
    JSON.stringify(
      {
        title: analysis.title,
        source: analysis.source,
        context: analysis.context,
        mode: analysis.mode,
        recordingPath: analysis.savedRecording?.path || null,
      },
      null,
      2
    )
  );

  if (analysis.context === SessionContext.MEETING) {
    await writeTextFile(`${analysisPath}/summary.md`, analysis.artifacts.summary);
    await writeTextFile(`${analysisPath}/action-items.md`, analysis.artifacts.actionItems);
    await writeTextFile(`${mapsPath}/folder-tree.txt`, analysis.artifacts.folderTree);
    await writeTextFile(`${mapsPath}/mindmap.md`, analysis.artifacts.mindmap);
  }

  const reportText = buildCombinedReport(analysis);
  const reportFileName = `${baseName}-report.md`;
  const reportPath = `${exportsPath}/${reportFileName}`;

  await writeTextFile(reportPath, reportText);

  const uriResult = await Filesystem.getUri({
    path: reportPath,
    directory: Directory.Documents,
  });

  return {
    fileName: reportFileName,
    path: reportPath,
    uri: uriResult.uri,
    workspacePath,
    directoryLabel: `Documents/${STORAGE_ROOT}`,
    webPath: Capacitor.convertFileSrc(uriResult.uri),
  };
};
