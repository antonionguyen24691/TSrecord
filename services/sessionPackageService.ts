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
import { cacheWorkspaceSession, clearWorkspaceStorage } from './workspaceService';

const STORAGE_ROOT = 'TSrecord';

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

const blobToBase64 = async (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const saveNativeExportText = async ({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}): Promise<SavedDeviceFile> => {
  await ensureFilesystemPermission();
  await ensureDirectory(`${STORAGE_ROOT}/exports`);

  const exportPath = `${STORAGE_ROOT}/exports/${fileName}`;
  await Filesystem.writeFile({
    path: exportPath,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  const uriResult = await Filesystem.getUri({
    path: exportPath,
    directory: Directory.Documents,
  });

  return {
    fileName,
    path: exportPath,
    uri: uriResult.uri,
    workspacePath: `${STORAGE_ROOT}/exports`,
    directoryLabel: `Documents/${STORAGE_ROOT}/exports`,
    webPath: Capacitor.convertFileSrc(uriResult.uri),
  };
};

const saveNativeExportBlob = async ({
  fileName,
  blob,
}: {
  fileName: string;
  blob: Blob;
}): Promise<SavedDeviceFile> => {
  await ensureFilesystemPermission();
  await ensureDirectory(`${STORAGE_ROOT}/exports`);

  const exportPath = `${STORAGE_ROOT}/exports/${fileName}`;
  await Filesystem.writeFile({
    path: exportPath,
    data: await blobToBase64(blob),
    directory: Directory.Documents,
    recursive: true,
  });

  const uriResult = await Filesystem.getUri({
    path: exportPath,
    directory: Directory.Documents,
  });

  return {
    fileName,
    path: exportPath,
    uri: uriResult.uri,
    workspacePath: `${STORAGE_ROOT}/exports`,
    directoryLabel: `Documents/${STORAGE_ROOT}/exports`,
    webPath: Capacitor.convertFileSrc(uriResult.uri),
  };
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
      '## Các quyết định đã chốt',
      analysis.artifacts.decisions.trim() || '- Chưa có quyết định nào được ghi nhận.',
      '',
      '## Rủi ro / điểm còn mở',
      analysis.artifacts.risks.trim() || '- Chưa có rủi ro nào được ghi nhận.',
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

const markdownLineToHtml = (line: string) => {
  const escaped = escapeHtml(line)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>');

  if (/^###\s+/.test(line)) return `<h3>${escaped.replace(/^###\s+/, '')}</h3>`;
  if (/^##\s+/.test(line)) return `<h2>${escaped.replace(/^##\s+/, '')}</h2>`;
  if (/^#\s+/.test(line)) return `<h1>${escaped.replace(/^#\s+/, '')}</h1>`;
  return `<p>${escaped}</p>`;
};

const markdownSectionToHtml = (value: string) => {
  const lines = value.split(/\r?\n/).map((line) => line.trim());
  const html: string[] = [];
  let inList = false;

  lines.forEach((line) => {
    if (!line) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      return;
    }

    const checklist = line.match(/^- \[[ xX]\]\s+(.+)$/);
    if (checklist) {
      if (!inList) {
        html.push('<ul class="list">');
        inList = true;
      }
      html.push(`<li>${escapeHtml(checklist[1])}</li>`);
      return;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) {
        html.push('<ul class="list">');
        inList = true;
      }
      html.push(`<li>${escapeHtml(bullet[1])}</li>`);
      return;
    }

    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    html.push(markdownLineToHtml(line));
  });

  if (inList) html.push('</ul>');
  return html.join('\n');
};

const transcriptTimelineToHtml = (transcript: string) => {
  const normalized = transcript.replace(/\s*(\[\d{2}:\d{2}:\d{2}\])/g, '\n$1');
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: string[] = [];
  let currentTime = '--:--:--';
  let currentText = '';

  const pushRow = () => {
    if (!currentText) return;
    rows.push(
      `<div class="timeline-row"><div class="time">${escapeHtml(currentTime)}</div><div class="text">${escapeHtml(currentText)}</div></div>`
    );
  };

  lines.forEach((line) => {
    const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/);
    if (match) {
      pushRow();
      currentTime = match[1];
      currentText = match[2] || '';
      return;
    }

    currentText = `${currentText} ${line}`.trim();
  });
  pushRow();

  if (rows.length === 0) {
    return `<div class="plain-transcript">${escapeHtml(transcript || 'Chua co transcript')}</div>`;
  }
  return `<div class="timeline">${rows.join('')}</div>`;
};

export const buildPresentationHtml = (analysis: SessionAnalysis) => {
  const summaryHtml = markdownSectionToHtml(analysis.artifacts.summary || '');
  const decisionsHtml = markdownSectionToHtml(analysis.artifacts.decisions || '');
  const risksHtml = markdownSectionToHtml(analysis.artifacts.risks || '');
  const actionsHtml = markdownSectionToHtml(analysis.artifacts.actionItems || '');
  const folderTreeHtml = `<pre>${escapeHtml(analysis.artifacts.folderTree || '(trong)')}</pre>`;
  const mindmapHtml = `<pre>${escapeHtml(analysis.artifacts.mindmap || '(trong)')}</pre>`;
  const transcriptHtml = transcriptTimelineToHtml(analysis.artifacts.transcript || '');
  const title = escapeHtml(analysis.title || 'TSrecord Session');

  return `
<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    :root { --bg:#f1f5f9; --card:#ffffff; --ink:#0f172a; --muted:#475569; --line:#dbe5ef; --brand:#0d7c66; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Be Vietnam Pro","Segoe UI",sans-serif; color:var(--ink); background:radial-gradient(circle at 10% 10%,#ddfff4 0,#f8fafc 34%,#edf2ff 100%); }
    .page { max-width:1180px; margin:26px auto; padding:0 18px 38px; }
    .hero { background:var(--card); border:1px solid var(--line); border-radius:24px; padding:24px; box-shadow:0 18px 45px rgba(15,23,42,.08); }
    h1 { margin:0; font-size:36px; line-height:1.18; }
    .meta { margin-top:14px; display:flex; gap:10px; flex-wrap:wrap; }
    .chip { border:1px solid var(--line); background:#f8fbff; border-radius:999px; padding:8px 12px; font-size:12px; color:var(--muted); }
    .grid { margin-top:18px; display:grid; gap:16px; grid-template-columns:repeat(12,1fr); }
    .card { grid-column:span 12; background:var(--card); border:1px solid var(--line); border-radius:20px; padding:18px; box-shadow:0 8px 24px rgba(15,23,42,.05); }
    .card h2 { margin:0 0 10px; font-size:22px; }
    .card h3 { margin:10px 0 6px; font-size:18px; }
    .card p { margin:8px 0; color:#243045; line-height:1.6; }
    .list { margin:8px 0; padding-left:20px; color:#1f2a3f; }
    .list li { margin:7px 0; }
    pre { margin:0; background:#f8fafc; border:1px solid var(--line); border-radius:14px; padding:14px; white-space:pre-wrap; line-height:1.6; font-family:"JetBrains Mono","Consolas",monospace; font-size:13px; }
    .timeline { display:grid; gap:10px; }
    .timeline-row { display:grid; gap:12px; grid-template-columns:120px 1fr; border:1px solid var(--line); border-radius:14px; padding:10px 12px; background:#fcfdff; }
    .time { background:#0f172a; color:#7af2d1; border-radius:10px; font-family:monospace; font-weight:700; text-align:center; padding:6px 8px; height:fit-content; }
    .text { line-height:1.6; color:#1e293b; }
    .plain-transcript { white-space:pre-wrap; line-height:1.65; color:#1e293b; border:1px solid var(--line); border-radius:14px; padding:12px; background:#fcfdff; }
    .half { grid-column:span 6; }
    @media (max-width:980px){ .half{grid-column:span 12;} .timeline-row{grid-template-columns:1fr;} }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${title}</h1>
      <div class="meta">
        <div class="chip">Nguon: ${escapeHtml(labelSource(analysis.source))}</div>
        <div class="chip">Ngu canh: ${escapeHtml(labelContext(analysis.context))}</div>
        <div class="chip">Transcript mode: ${escapeHtml(labelMode(analysis.mode))}</div>
      </div>
    </section>

    <section class="grid">
      <article class="card"><h2>Transcript</h2>${transcriptHtml}</article>
      <article class="card"><h2>Summary</h2>${summaryHtml || '<p>Chua co du lieu.</p>'}</article>
      <article class="card half"><h2>Decisions</h2>${decisionsHtml || '<p>Chua co du lieu.</p>'}</article>
      <article class="card half"><h2>Risks</h2>${risksHtml || '<p>Chua co du lieu.</p>'}</article>
      <article class="card"><h2>Action Items</h2>${actionsHtml || '<p>Chua co du lieu.</p>'}</article>
      ${analysis.context === SessionContext.MEETING ? `<article class="card half"><h2>Folder Tree</h2>${folderTreeHtml}</article><article class="card half"><h2>Mindmap Source</h2>${mindmapHtml}</article>` : ''}
    </section>
  </div>
  </div>
</body>
</html>
  `.trim();
};

export const downloadDocxReport = async ({
  analysis,
  fileName,
}: {
  analysis: SessionAnalysis;
  fileName: string;
}): Promise<SavedDeviceFile | void> => {
  const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');

  const parseMarkdownToDocx = (text: string) => {
    const lines = text.split(/\r?\n/);
    const paragraphs: any[] = [];
    
    lines.forEach(line => {
      if (!line.trim()) {
         paragraphs.push(new Paragraph(""));
         return;
      }
      
      if (line.match(/^###\s+/)) {
         paragraphs.push(new Paragraph({
           text: line.replace(/^###\s+/, ''),
           heading: HeadingLevel.HEADING_3,
         }));
      } else if (line.match(/^##\s+/)) {
         paragraphs.push(new Paragraph({
           text: line.replace(/^##\s+/, ''),
           heading: HeadingLevel.HEADING_2,
         }));
      } else if (line.match(/^#\s+/)) {
         paragraphs.push(new Paragraph({
           text: line.replace(/^#\s+/, ''),
           heading: HeadingLevel.HEADING_1,
         }));
      } else if (line.match(/^-\s+\[/)) {
         paragraphs.push(new Paragraph({
           text: line.replace(/^-\s+\[[ xX]\]\s*/, ''),
           bullet: { level: 0 }
         }));
      } else if (line.match(/^[-*]\s+/)) {
         paragraphs.push(new Paragraph({
           text: line.replace(/^[-*]\s+/, ''),
           bullet: { level: 0 }
         }));
      } else if (line.match(/^> /)) {
         paragraphs.push(new Paragraph({
           text: line.replace(/^> /, ''),
           indent: { left: 720 },
         }));
      } else {
         paragraphs.push(new Paragraph(line));
      }
    });
    return paragraphs;
  };

  const sections = [
    new Paragraph({ text: analysis.title || 'TSrecord Session', heading: HeadingLevel.HEADING_1 }),
    new Paragraph(""),
    new Paragraph(`Nguồn dữ liệu: ${labelSource(analysis.source)}`),
    new Paragraph(`Ngữ cảnh: ${labelContext(analysis.context)}`),
    new Paragraph(`Định dạng transcript: ${labelMode(analysis.mode)}`),
    new Paragraph(""),
    new Paragraph({ text: 'Transcript', heading: HeadingLevel.HEADING_2 }),
    ...parseMarkdownToDocx(analysis.artifacts.transcript || "Chưa có transcript"),
  ];

  if (analysis.context === SessionContext.MEETING) {
    sections.push(
      new Paragraph(""),
      new Paragraph({ text: 'Tóm tắt cuộc họp', heading: HeadingLevel.HEADING_2 }),
      ...parseMarkdownToDocx(analysis.artifacts.summary || 'Chưa có phần tóm tắt.'),
      new Paragraph(""),
      new Paragraph({ text: 'Các quyết định đã chốt', heading: HeadingLevel.HEADING_2 }),
      ...parseMarkdownToDocx(analysis.artifacts.decisions || 'Chưa có quyết định.'),
      new Paragraph(""),
      new Paragraph({ text: 'Rủi ro / điểm còn mở', heading: HeadingLevel.HEADING_2 }),
      ...parseMarkdownToDocx(analysis.artifacts.risks || 'Chưa có rủi ro.'),
      new Paragraph(""),
      new Paragraph({ text: 'Việc cần làm', heading: HeadingLevel.HEADING_2 }),
      ...parseMarkdownToDocx(analysis.artifacts.actionItems || 'Chưa có mục hành động.')
    );
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }]
  });

  const blob = await Packer.toBlob(doc);
  return downloadBlobFile({ blob, fileName: `${fileName}.docx` });
};

export const downloadHtmlReport = ({
  analysis,
  fileName,
}: {
  analysis: SessionAnalysis;
  fileName: string;
}): Promise<SavedDeviceFile | void> => {
  return downloadTextFile({
    content: buildPresentationHtml(analysis),
    fileName,
    mimeType: 'text/html;charset=utf-8',
  });
};

export const downloadTextFile = async ({
  content,
  fileName,
  mimeType = 'text/plain;charset=utf-8',
}: {
  content: string;
  fileName: string;
  mimeType?: string;
}): Promise<SavedDeviceFile | void> => {
  if (Capacitor.isNativePlatform()) {
    return saveNativeExportText({ fileName, content });
  }

  const element = document.createElement('a');
  const file = new Blob([content], { type: mimeType });

  element.href = URL.createObjectURL(file);
  element.download = fileName;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const downloadBlobFile = async ({
  blob,
  fileName,
}: {
  blob: Blob;
  fileName: string;
}): Promise<SavedDeviceFile | void> => {
  if (Capacitor.isNativePlatform()) {
    return saveNativeExportBlob({ fileName, blob });
  }

  const element = document.createElement('a');

  element.href = URL.createObjectURL(blob);
  element.download = fileName;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

const stripMarkdown = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .trim();

const toBulletItems = (value: string, fallback = 'Chưa có dữ liệu') => {
  const items = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^-\s*\[[ xX]\]\s*/, '').replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);

  if (items.length === 0) return [fallback];
  return items;
};

interface DeckMindmapNode {
  label: string;
  depth: number;
}

interface DeckMindmapTreeNode {
  label: string;
  children: DeckMindmapTreeNode[];
}

const parseDeckMindmapNodes = (value: string) => {
  const lines = value.split(/\r?\n/).filter((line) => line.trim());
  const relevantLines = lines.filter((line) => line.trim().toLowerCase() !== 'mindmap');
  const minIndent = relevantLines.reduce((currentMin, line) => {
    const indent = line.replace(/\t/g, '  ').match(/^\s*/)![0].length;
    return Math.min(currentMin, indent);
  }, Number.POSITIVE_INFINITY);

  return relevantLines
    .map((line) => {
      const normalized = line.replace(/\t/g, '  ');
      const indent = normalized.match(/^\s*/)![0].length;
      const normalizedIndent = Number.isFinite(minIndent) ? Math.max(0, indent - minIndent) : indent;
      const depth = /^root\(\(/.test(normalized.trim())
        ? 0
        : Math.max(1, Math.floor(normalizedIndent / 2));
      const label = normalized
        .trim()
        .replace(/^root\(\(/, '')
        .replace(/\)\)$/, '')
        .replace(/^["']|["']$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      return { label, depth };
    })
    .filter((node) => node.label);
};

const deckMindmapTreeFromNodes = (nodes: DeckMindmapNode[]) => {
  if (nodes.length === 0) return null;
  const rootNode = nodes.find((node) => node.depth === 0) || nodes[0];
  const root: DeckMindmapTreeNode = { label: rootNode.label, children: [] };
  const stack: Array<{ depth: number; node: DeckMindmapTreeNode }> = [{ depth: 0, node: root }];

  nodes
    .filter((node) => node !== rootNode)
    .forEach((node) => {
      const safeDepth = Math.max(1, node.depth);
      while (stack.length > 1 && stack[stack.length - 1].depth >= safeDepth) {
        stack.pop();
      }
      const parent = stack[stack.length - 1]?.node || root;
      const child: DeckMindmapTreeNode = { label: node.label, children: [] };
      parent.children.push(child);
      stack.push({ depth: safeDepth, node: child });
    });

  return root;
};

const toDeckMindmapTree = (mindmapText: string, fallbackTitle: string) => {
  const parsedTree = deckMindmapTreeFromNodes(parseDeckMindmapNodes(mindmapText));
  if (parsedTree && parsedTree.children.length > 0) return parsedTree;

  const summarySeeds = toBulletItems(stripMarkdown(mindmapText), 'Noi dung').slice(0, 4);
  return {
    label: fallbackTitle,
    children: summarySeeds.map((seed) => ({
      label: seed,
      children: [],
    })),
  };
};

export const downloadPresentationDeck = async ({
  analysis,
  preferredBaseName,
}: {
  analysis: SessionAnalysis;
  preferredBaseName?: string;
}): Promise<SavedDeviceFile | void> => {
  const [{ default: PptxGenJS }] = await Promise.all([import('pptxgenjs')]);
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'TSrecord';
  pptx.company = 'TSrecord';
  pptx.subject = analysis.title;
  pptx.title = `${analysis.title} - Meeting Deck`;

  const slideTitle = (slide: any, title: string, subtitle?: string) => {
    slide.background = { color: 'F8FAFC' };
    slide.addText(title, {
      x: 0.5,
      y: 0.3,
      w: 12.3,
      h: 0.6,
      fontFace: 'Calibri',
      bold: true,
      fontSize: 26,
      color: '0F172A',
    });
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.5,
        y: 1.0,
        w: 12.3,
        h: 0.35,
        fontFace: 'Calibri',
        fontSize: 13,
        color: '475569',
      });
    }
  };

  const addBulletBlock = (slide: any, title: string, items: string[], x: number, y: number, w: number, h: number) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w,
      h,
      radius: 0.08,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', pt: 1 },
      shadow: {
        type: 'outer',
        color: 'E2E8F0',
        blur: 2,
        angle: 45,
        distance: 1,
        opacity: 0.4,
      },
    });

    slide.addText(title, {
      x: x + 0.2,
      y: y + 0.15,
      w: w - 0.4,
      h: 0.3,
      fontFace: 'Calibri',
      bold: true,
      fontSize: 14,
      color: '0F172A',
    });

    slide.addText(
      items.map((item) => ({ text: stripMarkdown(item), options: { bullet: { indent: 12 } } })),
      {
        x: x + 0.2,
        y: y + 0.55,
        w: w - 0.4,
        h: h - 0.7,
        fontFace: 'Calibri',
        fontSize: 12,
        color: '334155',
        valign: 'top',
      }
    );
  };

  const overview = pptx.addSlide();
  slideTitle(overview, analysis.title, 'AI Meeting Briefing Deck');
  addBulletBlock(
    overview,
    'Metadata',
    [
      `Nguon du lieu: ${labelSource(analysis.source)}`,
      `Ngu canh: ${labelContext(analysis.context)}`,
      `Dinh dang transcript: ${labelMode(analysis.mode)}`,
      analysis.savedRecording?.path ? `File ghi am: ${analysis.savedRecording.path}` : 'File ghi am: Khong co',
    ],
    0.5,
    1.5,
    12.3,
    2.2
  );
  addBulletBlock(
    overview,
    'Tom tat nhanh',
    toBulletItems(stripMarkdown(analysis.artifacts.summary), 'Chua co summary'),
    0.5,
    3.95,
    12.3,
    3.0
  );

  const decisionsAndRisks = pptx.addSlide();
  slideTitle(decisionsAndRisks, 'Decisions & Risks', 'Tong hop diem da chot va diem can theo doi');
  addBulletBlock(
    decisionsAndRisks,
    'Decisions',
    toBulletItems(analysis.artifacts.decisions, 'Chua co decision'),
    0.5,
    1.5,
    6.0,
    5.4
  );
  addBulletBlock(
    decisionsAndRisks,
    'Risks',
    toBulletItems(analysis.artifacts.risks, 'Chua co risk'),
    6.8,
    1.5,
    6.0,
    5.4
  );

  const actionSlide = pptx.addSlide();
  slideTitle(actionSlide, 'Action Plan', 'Checklist cong viec tu cuoc hop');
  addBulletBlock(
    actionSlide,
    'Action items',
    toBulletItems(analysis.artifacts.actionItems, 'Chua co action item'),
    0.5,
    1.5,
    12.3,
    5.4
  );

  const transcriptSlide = pptx.addSlide();
  slideTitle(transcriptSlide, 'Transcript Highlights', 'Ban tom luoc transcript de trinh chieu');
  addBulletBlock(
    transcriptSlide,
    'Transcript',
    toBulletItems(analysis.artifacts.transcript, 'Chua co transcript').slice(0, 12),
    0.5,
    1.5,
    12.3,
    5.4
  );

  if (analysis.context === SessionContext.MEETING) {
    const treeSlide = pptx.addSlide();
    slideTitle(treeSlide, 'Folder Tree', 'Cau truc thu muc de xuat');
    addBulletBlock(
      treeSlide,
      'Folder hierarchy',
      toBulletItems(analysis.artifacts.folderTree, 'Chua co folder tree'),
      0.5,
      1.5,
      12.3,
      5.4
    );

    const mindmapSlide = pptx.addSlide();
    slideTitle(mindmapSlide, 'Mindmap');
    const mindmapTree = toDeckMindmapTree(analysis.artifacts.mindmap, analysis.title);
    const topBranches = mindmapTree.children.slice(0, 6);
    const leftBranches = topBranches.filter((_, index) => index % 2 === 1);
    const rightBranches = topBranches.filter((_, index) => index % 2 === 0);
    const branchPalette = ['2563EB', '0D9488', 'F59E0B', 'EC4899', '8B5CF6', '14B8A6'];

    const rootX = 5.45;
    const rootY = 3.25;
    const rootW = 2.4;
    const rootH = 0.7;
    const rootCenterX = rootX + rootW / 2;
    const rootCenterY = rootY + rootH / 2;

    mindmapSlide.addShape(pptx.ShapeType.roundRect, {
      x: rootX,
      y: rootY,
      w: rootW,
      h: rootH,
      fill: { color: '0F172A' },
      line: { color: '0F172A', pt: 1 },
    });
    mindmapSlide.addText(mindmapTree.label, {
      x: rootX + 0.1,
      y: rootY + 0.17,
      w: rootW - 0.2,
      h: 0.35,
      fontFace: 'Calibri',
      fontSize: 14,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
    });

    const drawConnector = (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      color: string,
      thickness: number
    ) => {
      const midX = (fromX + toX) / 2;
      mindmapSlide.addShape(pptx.ShapeType.line, {
        x: Math.min(fromX, midX),
        y: fromY,
        w: Math.abs(midX - fromX),
        h: 0,
        line: { color, pt: thickness },
      });
      mindmapSlide.addShape(pptx.ShapeType.line, {
        x: midX,
        y: Math.min(fromY, toY),
        w: 0,
        h: Math.abs(toY - fromY),
        line: { color, pt: Math.max(0.75, thickness - 0.2) },
      });
      mindmapSlide.addShape(pptx.ShapeType.line, {
        x: Math.min(midX, toX),
        y: toY,
        w: Math.abs(toX - midX),
        h: 0,
        line: { color, pt: thickness },
      });
    };

    const drawBranchSet = (branches: DeckMindmapTreeNode[], side: 'left' | 'right') => {
      if (branches.length === 0) return;
      const startY = 1.35;
      const branchBandHeight = 4.9;
      const stepY = branches.length > 1 ? branchBandHeight / (branches.length - 1) : 0;

      branches.forEach((branch, branchIndex) => {
        const y = startY + stepY * branchIndex;
        const branchW = 2.25;
        const branchH = 0.58;
        const branchX = side === 'left' ? 2.15 : 8.95;
        const color = branchPalette[branchIndex % branchPalette.length];
        const branchCenterX = branchX + branchW / 2;
        const branchCenterY = y + branchH / 2;

        drawConnector(rootCenterX, rootCenterY, branchCenterX, branchCenterY, color, 1.5);

        mindmapSlide.addShape(pptx.ShapeType.roundRect, {
          x: branchX,
          y,
          w: branchW,
          h: branchH,
          fill: { color: 'FFFFFF' },
          line: { color, pt: 1.4 },
        });
        mindmapSlide.addText(branch.label, {
          x: branchX + 0.08,
          y: y + 0.15,
          w: branchW - 0.16,
          h: 0.3,
          fontFace: 'Calibri',
          fontSize: 11,
          bold: true,
          color: '0F172A',
          align: 'center',
        });

        branch.children.slice(0, 3).forEach((child, childIndex) => {
          const childW = 2.05;
          const childH = 0.48;
          const childX = side === 'left' ? 0.15 : 10.95;
          const childStartY =
            y -
            ((Math.min(branch.children.length, 3) - 1) * 0.54) / 2;
          const childY = childStartY + childIndex * 0.54;
          const childCenterX = childX + childW / 2;
          const childCenterY = childY + childH / 2;

          drawConnector(branchCenterX, branchCenterY, childCenterX, childCenterY, color, 1.2);

          mindmapSlide.addShape(pptx.ShapeType.roundRect, {
            x: childX,
            y: childY,
            w: childW,
            h: childH,
            fill: { color: 'FFFFFF' },
            line: { color: 'CBD5E1', pt: 1 },
          });
          mindmapSlide.addText(child.label, {
            x: childX + 0.08,
            y: childY + 0.11,
            w: childW - 0.16,
            h: 0.28,
            fontFace: 'Calibri',
            fontSize: 8.5,
            color: '334155',
            align: 'center',
            valign: 'middle',
          });
        });
      });
    };

    drawBranchSet(leftBranches, 'left');
    drawBranchSet(rightBranches, 'right');
  }

  const safeName = sanitizeFileSegment(preferredBaseName || analysis.suggestedFolderName || analysis.title || 'session');
  const outputFileName = `${safeName || 'session'}-deck.pptx`;

  if (Capacitor.isNativePlatform()) {
    const blob = await pptx.write({ outputType: 'blob' });
    if (!(blob instanceof Blob)) {
      throw new Error('Khong the tao file PPTX.');
    }
    return downloadBlobFile({ blob, fileName: outputFileName });
  }

  await pptx.writeFile({ fileName: outputFileName });
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
    analysis.workspacePath ||
    analysis.savedRecording?.workspacePath ||
    `${STORAGE_ROOT}/${createSessionWorkspaceName(baseName)}`;
  const normalizedAnalysis: SessionAnalysis = {
    ...analysis,
    workspacePath,
    createdAt: analysis.createdAt || new Date().toISOString(),
  };

  const analysisPath = `${workspacePath}/analysis`;
  const mapsPath = `${workspacePath}/maps`;
  const exportsPath = `${workspacePath}/exports`;

  await ensureDirectory(analysisPath);
  await ensureDirectory(exportsPath);

  if (analysis.context === SessionContext.MEETING) {
    await ensureDirectory(mapsPath);
  }

  await writeTextFile(`${analysisPath}/transcript.txt`, normalizedAnalysis.artifacts.transcript);
  await writeTextFile(
    `${analysisPath}/metadata.json`,
    JSON.stringify(
      {
        title: normalizedAnalysis.title,
        source: normalizedAnalysis.source,
        context: normalizedAnalysis.context,
        mode: normalizedAnalysis.mode,
        createdAt: normalizedAnalysis.createdAt,
        originalFileName: normalizedAnalysis.originalFileName || null,
        recordingPath: normalizedAnalysis.savedRecording?.path || null,
      },
      null,
      2
    )
  );
  await writeTextFile(`${analysisPath}/session.json`, JSON.stringify(normalizedAnalysis, null, 2));

  if (normalizedAnalysis.context === SessionContext.MEETING) {
    await writeTextFile(`${analysisPath}/summary.md`, normalizedAnalysis.artifacts.summary);
    await writeTextFile(`${analysisPath}/decisions.md`, normalizedAnalysis.artifacts.decisions);
    await writeTextFile(`${analysisPath}/risks.md`, normalizedAnalysis.artifacts.risks);
    await writeTextFile(`${analysisPath}/action-items.md`, normalizedAnalysis.artifacts.actionItems);
    await writeTextFile(`${mapsPath}/folder-tree.txt`, normalizedAnalysis.artifacts.folderTree);
    await writeTextFile(`${mapsPath}/mindmap.md`, normalizedAnalysis.artifacts.mindmap);
  }

  const reportText = buildPresentationHtml(normalizedAnalysis);
  const reportFileName = `${baseName}-report.html`;
  const reportPath = `${exportsPath}/${reportFileName}`;

  await writeTextFile(reportPath, reportText);
  cacheWorkspaceSession(normalizedAnalysis, workspacePath);

  const uriResult = await Filesystem.getUri({
    path: reportPath,
    directory: Directory.Documents,
  });

  return {
    fileName: reportFileName,
    path: reportPath,
    uri: uriResult.uri,
    workspacePath,
    directoryLabel: `Documents/TSrecord`,
    webPath: Capacitor.convertFileSrc(uriResult.uri),
  };
};

export const clearAppStorage = async () => {
  if (Capacitor.isNativePlatform()) {
    await ensureFilesystemPermission();

    try {
      await Filesystem.rmdir({
        path: STORAGE_ROOT,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (error: any) {
      const message = `${error?.message || ''}`.toLowerCase();
      if (
        !message.includes('not found') &&
        !message.includes('exist') &&
        !message.includes('no such file')
      ) {
        throw error;
      }
    }
  }

  await clearWorkspaceStorage();
  await initAppStorage();
};

export const initAppStorage = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const root = await Filesystem.readdir({
      path: '',
      directory: Directory.Documents,
    });

    const rootExists = root.files.some((f) => f.name === STORAGE_ROOT);
    if (!rootExists) {
      await Filesystem.mkdir({
        path: STORAGE_ROOT,
        directory: Directory.Documents,
        recursive: true,
      });
    }
  } catch {
    try {
      await Filesystem.mkdir({
        path: STORAGE_ROOT,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (e) {
      console.error('Failed to init storage:', e);
    }
  }
};
