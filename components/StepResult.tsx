import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  FilePenLine,
  FileWarning,
  FolderTree,
  ListTodo,
  ScrollText,
  ShieldAlert,
  Share2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArtifactKey, SessionAnalysis, SessionContext } from '../types';

interface StepResultProps {
  analysis: SessionAnalysis;
  setAnalysis: React.Dispatch<React.SetStateAction<SessionAnalysis | null>>;
  onNext: () => void;
}

interface ArtifactItem {
  key: ArtifactKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  content: string;
}

interface TreeNode {
  label: string;
  children: TreeNode[];
}

interface TranscriptSegment {
  timestamp: string | null;
  text: string;
}

interface MindmapNode {
  label: string;
  depth: number;
}

interface MindmapTreeNode {
  label: string;
  children: MindmapTreeNode[];
}

interface MindmapRenderNode {
  id: string;
  label: string;
  depth: number;
  x: number;
  y: number;
}

interface MindmapRenderEdge {
  from: string;
  to: string;
}

const cleanLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const parseChecklist = (value: string) =>
  cleanLines(value).map((line) => {
    const checked = /^-\s*\[[xX]\]/.test(line);
    const text = line.replace(/^-\s*\[[ xX]\]\s*/, '').trim() || line;
    return { checked, text };
  });

const parseBulletList = (value: string) =>
  cleanLines(value).map((line) => line.replace(/^[-*]\s*/, '').trim() || line);

const parseFolderTree = (value: string) =>
  cleanLines(value).map((line) => {
    const normalized = line.replace(/\t/g, '    ');
    const depthBySpaces = Math.floor((normalized.match(/^\s*/)![0].length || 0) / 2);
    const depthByGlyphs = (normalized.match(/[│├└]/g) || []).length;
    const depth = Math.max(depthBySpaces, depthByGlyphs);
    const label = normalized
      .replace(/^[\s│├└─]+/, '')
      .replace(/^\/+/, '')
      .trim();

    return {
      depth,
      label: label || normalized.trim(),
    };
  });

const parseMindmap = (value: string) => {
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
      const text = normalized
        .trim()
        .replace(/^root\(\(/, '')
        .replace(/\)\)$/, '')
        .replace(/^["']|["']$/g, '');

      return {
        depth,
        label: text,
      };
    })
    .filter((node) => node.label);
};

const sanitizeMindmapLabel = (value: string) =>
  value
    .replace(/[`"*#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeSummaryMarkdown = (value: string) => {
  let normalized = value.replace(/\r\n/g, '\n').trim();
  normalized = normalized.replace(/\s*(##\s+)/g, '\n\n$1');
  normalized = normalized.replace(/\s+\*\s+(?=\*\*|[A-Za-zÀ-ỹ0-9])/g, '\n- ');
  normalized = normalized.replace(/([^\n])\s+(-\s+)/g, '$1\n$2');
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  return normalized.trim();
};

const parseMarkdownHeadingSections = (value: string) => {
  const lines = value.split(/\r?\n/);
  const sections: Array<{ heading: string; lines: string[] }> = [];
  let current: { heading: string; lines: string[] } | null = null;

  lines.forEach((line) => {
    const headingMatch = line.trim().match(/^##\s+(.+)$/);
    if (headingMatch) {
      current = {
        heading: sanitizeMindmapLabel(headingMatch[1]),
        lines: [],
      };
      sections.push(current);
      return;
    }

    if (!current) {
      current = { heading: 'Tong quan', lines: [] };
      sections.push(current);
    }

    if (line.trim()) current.lines.push(line.trim());
  });

  return sections;
};

const parseBulletsFromText = (value: string, maxItems = 5) =>
  cleanLines(value)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, maxItems);

const tokenizeForRelevance = (value: string) => {
  const stopwords = new Set([
    'va',
    'voi',
    'cac',
    'nhung',
    'mot',
    'nhu',
    'cho',
    'tren',
    'trong',
    'theo',
    'duoc',
    'khong',
    'co',
    'la',
    'toi',
    'ban',
    'noi',
    'nay',
    'kia',
    'cua',
    'choi',
  ]);

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stopwords.has(token));
};

const hasMindmapRelevance = (mindmapText: string, analysis: SessionAnalysis) => {
  const mapTokens = tokenizeForRelevance(mindmapText);
  if (mapTokens.length === 0) return false;

  const sourceTokens = new Set(
    tokenizeForRelevance(
      `${analysis.artifacts.transcript}\n${analysis.artifacts.summary}\n${analysis.artifacts.decisions}\n${analysis.artifacts.risks}`
    )
  );
  if (sourceTokens.size === 0) return true;

  const overlap = mapTokens.filter((token) => sourceTokens.has(token)).length;
  const ratio = overlap / Math.max(mapTokens.length, 1);
  return ratio >= 0.12;
};

const buildFallbackMindmapFromAnalysis = (analysis: SessionAnalysis) => {
  const root = sanitizeMindmapLabel(analysis.title || 'Meeting');
  const summarySections = parseMarkdownHeadingSections(analysis.artifacts.summary);
  const decisionItems = parseBulletsFromText(analysis.artifacts.decisions, 4);
  const riskItems = parseBulletsFromText(analysis.artifacts.risks, 4);
  const actionItems = parseChecklist(analysis.artifacts.actionItems)
    .map((item) => item.text)
    .filter(Boolean)
    .slice(0, 5);
  const transcriptSegments = parseTimelineTranscript(analysis.artifacts.transcript)
    .map((segment) => segment.text)
    .filter(Boolean)
    .slice(0, 3);

  const lines: string[] = ['mindmap', `  root((${root}))`];

  summarySections.slice(0, 4).forEach((section) => {
    lines.push(`    ${sanitizeMindmapLabel(section.heading || 'Tong quan')}`);
    const sectionPoints = parseBulletsFromText(section.lines.join('\n'), 3);
    if (sectionPoints.length === 0) {
      const plainPoint = sanitizeMindmapLabel(section.lines.join(' ').slice(0, 80) || 'Noi dung');
      lines.push(`      ${plainPoint}`);
    } else {
      sectionPoints.forEach((point) => lines.push(`      ${sanitizeMindmapLabel(point)}`));
    }
  });

  if (decisionItems.length > 0) {
    lines.push('    Decisions');
    decisionItems.forEach((item) => lines.push(`      ${sanitizeMindmapLabel(item)}`));
  }

  if (riskItems.length > 0) {
    lines.push('    Risks');
    riskItems.forEach((item) => lines.push(`      ${sanitizeMindmapLabel(item)}`));
  }

  if (actionItems.length > 0) {
    lines.push('    Action items');
    actionItems.forEach((item) => lines.push(`      ${sanitizeMindmapLabel(item)}`));
  }

  if (transcriptSegments.length > 0) {
    lines.push('    Key statements');
    transcriptSegments.forEach((item) => lines.push(`      ${sanitizeMindmapLabel(item.slice(0, 90))}`));
  }

  return lines.join('\n');
};

const normalizeMermaidMindmap = (rawMindmap: string, analysis: SessionAnalysis) => {
  const raw = rawMindmap.trim();
  if (!raw) {
    return buildFallbackMindmapFromAnalysis(analysis);
  }

  if (/^mindmap\s*\n/i.test(raw) && raw.includes('root((')) {
    if (!hasMindmapRelevance(raw, analysis)) {
      return buildFallbackMindmapFromAnalysis(analysis);
    }
    return raw;
  }

  const compactRootMatch = raw.match(/root\(\(([^)]+)\)\)/i);
  if (compactRootMatch) {
    const root = sanitizeMindmapLabel(compactRootMatch[1]);
    const compactNodes = Array.from(raw.matchAll(/[A-Za-z0-9_]+\(([^()]+)\)/g))
      .map((match) => sanitizeMindmapLabel(match[1]))
      .filter((node) => node && node.toLowerCase() !== root.toLowerCase());

    if (compactNodes.length > 0) {
      const lines: string[] = ['mindmap', `  root((${root}))`];
      compactNodes.slice(0, 8).forEach((node, index) => {
        lines.push(`    Nhanh ${index + 1}`);
        lines.push(`      ${node}`);
      });
      return lines.join('\n');
    }
  }

  return buildFallbackMindmapFromAnalysis(analysis);
};

const parseTimelineTranscript = (value: string): TranscriptSegment[] => {
  const normalizedText = value
    .replace(/\s*(\[\d{2}:\d{2}:\d{2}\])/g, '\n$1')
    .replace(/\n{3,}/g, '\n\n');
  const lines = cleanLines(normalizedText);
  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  lines.forEach((line) => {
    const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/);

    if (match) {
      current = {
        timestamp: match[1],
        text: match[2].trim(),
      };
      segments.push(current);
      return;
    }

    if (current) {
      current.text = `${current.text} ${line}`.trim();
      return;
    }

    segments.push({
      timestamp: null,
      text: line,
    });
  });

  return segments;
};

const mindmapNodesToTree = (nodes: MindmapNode[]): MindmapTreeNode | null => {
  if (nodes.length === 0) return null;
  const rootNode = nodes.find((node) => node.depth === 0) || nodes[0];
  const root: MindmapTreeNode = { label: rootNode.label?.trim() || 'Mindmap', children: [] };
  const stack: Array<{ depth: number; node: MindmapTreeNode }> = [{ depth: 0, node: root }];

  nodes
    .filter((node) => node !== rootNode)
    .forEach((node) => {
      const safeDepth = Math.max(1, node.depth);
      while (stack.length > 1 && stack[stack.length - 1].depth >= safeDepth) {
        stack.pop();
      }
      const parent = stack[stack.length - 1]?.node || root;
      const child: MindmapTreeNode = { label: node.label?.trim() || 'Node', children: [] };
      parent.children.push(child);
      stack.push({ depth: safeDepth, node: child });
    });

  return root;
};

const countLeaves = (node: MindmapTreeNode): number =>
  node.children.length === 0 ? 1 : node.children.map(countLeaves).reduce((sum, leaves) => sum + leaves, 0);

const buildMindmapGraphLayout = (tree: MindmapTreeNode) => {
  const nodes: MindmapRenderNode[] = [];
  const edges: MindmapRenderEdge[] = [];
  const centerX = 560;
  const centerY = 380;
  const levelGapX = 230;
  const leafGapY = 90;
  const topLevelGapY = 110;

  const idFromLabel = (label: string | undefined, seed: string) => {
    const safeLabel = `${label ?? ''}`.trim() || 'node';
    return `${seed}-${safeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+/g, '-');
  };

  const rootId = idFromLabel(tree.label, 'root');
  nodes.push({
    id: rootId,
    label: tree.label,
    depth: 0,
    x: centerX,
    y: centerY,
  });

  const distributeRootChildren = (children: MindmapTreeNode[]) => {
    const left: MindmapTreeNode[] = [];
    const right: MindmapTreeNode[] = [];
    children.forEach((child, index) => {
      (index % 2 === 0 ? right : left).push(child);
    });
    return { left, right };
  };

  const placeSubtree = (
    node: MindmapTreeNode,
    side: -1 | 1,
    depth: number,
    yMin: number,
    yMax: number,
    parentId: string,
    seed: string
  ) => {
    const id = idFromLabel(node.label, `${seed}-${depth}`);
    const y = (yMin + yMax) / 2;
    const x = centerX + side * levelGapX * depth;

    nodes.push({
      id,
      label: node.label,
      depth,
      x,
      y,
    });
    edges.push({ from: parentId, to: id });

    if (node.children.length === 0) return;

    const totalLeaves = node.children.map(countLeaves).reduce((sum, leaves) => sum + leaves, 0);
    let cursor = yMin;
    node.children.forEach((child, index) => {
      const childLeaves = countLeaves(child);
      const span = ((yMax - yMin) * childLeaves) / Math.max(totalLeaves, 1);
      const nextMin = cursor;
      const nextMax = cursor + span;
      placeSubtree(child, side, depth + 1, nextMin, nextMax, id, `${seed}-${index}`);
      cursor += span;
    });
  };

  const { left, right } = distributeRootChildren(tree.children);
  const layoutTopSide = (items: MindmapTreeNode[], side: -1 | 1) => {
    if (items.length === 0) return;
    const totalHeight = Math.max(topLevelGapY * (items.length - 1), leafGapY);
    let yStart = centerY - totalHeight / 2;
    items.forEach((item, index) => {
      const yEnd = yStart + topLevelGapY;
      placeSubtree(item, side, 1, yStart, yEnd, rootId, `branch-${side}-${index}`);
      yStart += topLevelGapY;
    });
  };

  layoutTopSide(left, -1);
  layoutTopSide(right, 1);

  return { nodes, edges, width: 1120, height: 760 };
};

const createTreeNode = (label: string): TreeNode => ({
  label,
  children: [],
});

const getOrCreateChild = (parent: TreeNode, label: string) => {
  const existingChild = parent.children.find((child) => child.label === label);
  if (existingChild) return existingChild;

  const child = createTreeNode(label);
  parent.children.push(child);
  return child;
};

const buildFolderTree = (rows: Array<{ depth: number; label: string }>) => {
  const root = createTreeNode('root');
  const stack: TreeNode[] = [root];

  rows.forEach((row) => {
    const pathSegments = row.label
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (pathSegments.length > 1) {
      let current = root;
      pathSegments.forEach((segment) => {
        current = getOrCreateChild(current, segment);
      });
      return;
    }

    const node = createTreeNode(row.label);
    const safeDepth = Math.max(0, row.depth);
    stack.length = safeDepth + 1;
    const parent = stack[stack.length - 1] || root;
    parent.children.push(node);
    stack[safeDepth + 1] = node;
  });

  return root.children;
};

const MindmapGraphPreview: React.FC<{ nodes: MindmapNode[] }> = ({ nodes }) => {
  const tree = mindmapNodesToTree(nodes);
  if (!tree) return <EmptyArtifactState message="Khong co du lieu mindmap de render." />;

  const layout = buildMindmapGraphLayout(tree);
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));

  const strokeForDepth = (depth: number) => {
    const palette = ['#0f172a', '#2563eb', '#0d9488', '#f59e0b', '#ec4899', '#8b5cf6'];
    return palette[Math.min(depth, palette.length - 1)];
  };

  

  return (
    <div className="overflow-auto rounded-[24px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_#ecfeff,_#ffffff_55%)] p-4">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-[560px] w-full min-w-[900px]"
        role="img"
        aria-label="Mindmap visualization"
      >
        {layout.edges.map((edge, index) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;
          const curve = `M ${from.x} ${from.y} C ${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x} ${to.y}`;
          return (
            <path
              key={`edge-${index}`}
              d={curve}
              fill="none"
              stroke={strokeForDepth(to.depth)}
              strokeWidth={2.2}
              opacity={0.8}
            />
          );
        })}

        {layout.nodes.map((node) => {
          const isRoot = node.depth === 0;
          const width = isRoot ? 210 : 180;
          const height = isRoot ? 58 : 52;
          const x = node.x - width / 2;
          const y = node.y - height / 2;
          const fill = isRoot ? '#0f172a' : '#ffffff';
          const textColor = isRoot ? '#ffffff' : '#0f172a';
          const border = isRoot ? '#0f172a' : strokeForDepth(node.depth);

          return (
            <g key={node.id}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={16}
                ry={16}
                fill={fill}
                stroke={border}
                strokeWidth={2}
              />
              <foreignObject x={x + 10} y={y + 8} width={width - 20} height={height - 12}>
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    fontFamily: 'Be Vietnam Pro, sans-serif',
                    fontWeight: isRoot ? 700 : 600,
                    fontSize: isRoot ? '14px' : '13px',
                    color: textColor,
                    lineHeight: '1.25',
                    padding: '0 6px',
                  }}
                >
                  {node.label}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const FolderTreeNodeView: React.FC<{ node: TreeNode; depth?: number }> = ({ node, depth = 0 }) => (
  <div className={depth === 0 ? '' : 'ml-6 mt-3 border-l border-slate-200 pl-4'}>
    <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
      <div className="h-2.5 w-2.5 rounded-full bg-[#0d7c66]" />
      {node.label}
    </div>
    {node.children.length > 0 && (
      <div className="mt-3 space-y-3">
        {node.children.map((child, index) => (
          <FolderTreeNodeView key={`${child.label}-${index}`} node={child} depth={depth + 1} />
        ))}
      </div>
    )}
  </div>
);

const PreviewCard: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
    <div className="text-sm font-bold text-slate-900">{title}</div>
    {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
    <div className="mt-4">{children}</div>
  </div>
);

const EmptyArtifactState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {message}
  </div>
);

const ArtifactPreview: React.FC<{ artifact: ArtifactItem; analysis: SessionAnalysis }> = ({
  artifact,
  analysis,
}) => {
  const content = artifact.content.trim();

  if (!content) {
    return <EmptyArtifactState message="Artifact này hiện chưa có dữ liệu." />;
  }

  if (artifact.key === 'transcript') {
    const timelineSegments = parseTimelineTranscript(content);
    const hasTimeline = timelineSegments.some((segment) => segment.timestamp);

    return (
      <PreviewCard title="Transcript đã chuẩn hóa" subtitle="Giữ nguyên nội dung chép lời, dễ rà soát và đối chiếu.">
        {hasTimeline ? (
          <div className="max-h-[60vh] space-y-3 overflow-auto rounded-2xl bg-[linear-gradient(180deg,#f8fbff,#ffffff)] p-4">
            {timelineSegments.map((segment, index) => (
              <div
                key={`segment-${index}`}
                className="grid grid-cols-1 gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[120px_1fr]"
              >
                <div className="inline-flex h-fit items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 font-mono text-sm font-bold text-[#7af2d1]">
                  {segment.timestamp || '--:--:--'}
                </div>
                <div className="text-sm leading-7 text-slate-800">{segment.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-2xl bg-slate-50 px-4 py-4 font-mono text-sm leading-7 text-slate-700 whitespace-pre-wrap">
            {content}
          </div>
        )}
      </PreviewCard>
    );
  }

  if (artifact.key === 'summary') {
    const normalizedMarkdown = normalizeSummaryMarkdown(content);
    return (
      <PreviewCard
        title="Meeting summary"
        subtitle="Markdown được render thành layout đọc được thay vì text thô."
      >
        <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-6 shadow-sm">
          <div className="space-y-4">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-3xl font-black tracking-tight text-slate-950">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mt-8 border-b border-slate-200 pb-3 text-2xl font-black text-slate-950">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mt-6 text-xl font-bold text-slate-900">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm leading-7 text-slate-700">{children}</p>
                ),
                ul: ({ children }) => <ul className="space-y-3 pl-0">{children}</ul>,
                ol: ({ children }) => <ol className="space-y-3 pl-0">{children}</ol>,
                li: ({ children }) => (
                  <li className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800">
                    <span className="mt-2 h-2 w-2 rounded-full bg-[#0d7c66]" />
                    <span className="flex-1">{children}</span>
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-slate-950">{children}</strong>
                ),
                em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
                code: ({ children }) => (
                  <code className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[13px] text-slate-800">
                    {children}
                  </code>
                ),
              }}
            >
              {normalizedMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      </PreviewCard>
    );
  }

  if (artifact.key === 'decisions' || artifact.key === 'risks') {
    const items = parseBulletList(content);

    return (
      <div className="grid grid-cols-1 gap-3">
        {items.map((item, index) => (
          <div
            key={`${artifact.key}-${index}`}
            className={`rounded-[22px] border px-4 py-4 text-sm leading-7 ${
              artifact.key === 'decisions'
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                : 'border-amber-200 bg-amber-50/80 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl ${
                  artifact.key === 'decisions'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {artifact.key === 'decisions' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
              </div>
              <div>{item}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (artifact.key === 'actionItems') {
    const items = parseChecklist(content);

    return (
      <div className="grid grid-cols-1 gap-3">
        {items.map((item, index) => (
          <div
            key={`action-${index}`}
            className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800"
          >
            <div
              className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border ${
                item.checked
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {item.checked ? <Check className="h-4 w-4" /> : null}
            </div>
            <div>{item.text}</div>
          </div>
        ))}
      </div>
    );
  }

  if (artifact.key === 'folderTree') {
    const rows = parseFolderTree(content);
    const tree = buildFolderTree(rows);

    return (
      <PreviewCard
        title="Cây thư mục đề xuất"
        subtitle="Hiển thị như một tree view thay vì raw text."
      >
        <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#f8fffc,#ffffff)] p-5">
          <div className="space-y-3">
            {tree.map((node, index) => (
              <FolderTreeNodeView key={`${node.label}-${index}`} node={node} />
            ))}
          </div>
        </div>
      </PreviewCard>
    );
  }

  if (artifact.key === 'mindmap') {
    const normalizedChart = normalizeMermaidMindmap(content, analysis);
    const nodes = parseMindmap(normalizedChart);

    return (
      <PreviewCard
        title="Mindmap"
        subtitle="Render trực tiếp từ Mermaid thành sơ đồ."
      >
        <div className="grid grid-cols-1 gap-4">
          <MindmapGraphPreview nodes={nodes} />
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Node Outline
            </div>
            <div className="mt-3 space-y-2">
              {nodes.map((node, index) => (
                <div
                  key={`mindmap-${index}`}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm"
                  style={{ marginLeft: `${node.depth * 18}px` }}
                >
                  {node.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </PreviewCard>
    );
  }

  return (
    <PreviewCard title={artifact.label}>
      <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
        {content}
      </div>
    </PreviewCard>
  );
};

export const StepResult: React.FC<StepResultProps> = ({
  analysis,
  setAnalysis,
  onNext,
}) => {
  const contextLabel =
    analysis.context === SessionContext.MEETING
      ? 'Meeting'
      : analysis.context === SessionContext.INTERVIEW
        ? 'Interview'
        : 'Transcription';

  const [copied, setCopied] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactKey>('transcript');
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');

  const artifactItems = useMemo<ArtifactItem[]>(
    () =>
      [
        {
          key: 'transcript',
          label: 'Transcript',
          description: 'Bản chép lời chính.',
          icon: ScrollText,
          content: analysis.artifacts.transcript,
        },
        ...(analysis.context === SessionContext.MEETING
          ? [
              {
                key: 'summary' as ArtifactKey,
                label: 'Summary',
                description: 'Tóm tắt cuộc họp.',
                icon: Share2,
                content: analysis.artifacts.summary,
              },
              {
                key: 'decisions' as ArtifactKey,
                label: 'Decisions',
                description: 'Các quyết định đã chốt.',
                icon: ListTodo,
                content: analysis.artifacts.decisions,
              },
              {
                key: 'risks' as ArtifactKey,
                label: 'Risks',
                description: 'Rủi ro và điểm còn mở.',
                icon: ShieldAlert,
                content: analysis.artifacts.risks,
              },
              {
                key: 'folderTree' as ArtifactKey,
                label: 'Folder tree',
                description: 'Cây thư mục đề xuất.',
                icon: FolderTree,
                content: analysis.artifacts.folderTree,
              },
              {
                key: 'mindmap' as ArtifactKey,
                label: 'Mindmap',
                description: 'Mindmap hệ thống.',
                icon: FileWarning,
                content: analysis.artifacts.mindmap,
              },
              {
                key: 'actionItems' as ArtifactKey,
                label: 'Action items',
                description: 'Checklist công việc.',
                icon: ListTodo,
                content: analysis.artifacts.actionItems,
              },
            ]
          : []),
      ] as ArtifactItem[],
    [analysis]
  );

  useEffect(() => {
    if (!artifactItems.some((item) => item.key === selectedArtifact)) {
      setSelectedArtifact('transcript');
    }
  }, [artifactItems, selectedArtifact]);

  const activeArtifact =
    artifactItems.find((item) => item.key === selectedArtifact) || artifactItems[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeArtifact.content || '');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const updateArtifact = (key: ArtifactKey, value: string) => {
    setAnalysis((current) => {
      if (!current) return current;

      return {
        ...current,
        artifacts: {
          ...current.artifacts,
          [key]: value,
        },
      };
    });
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl animate-fade-in">
      <div className="w-full rounded-[32px] border border-white/60 bg-white/90 p-6 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66]">
                Kết quả AI
              </p>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-100 shadow-sm">
                <Check className="h-3 w-3" />
                ĐÃ TỰ ĐỘNG LƯU VÀO MÁY
              </div>
            </div>
            <input
              type="text"
              value={analysis.title}
              onChange={(event) =>
                setAnalysis((current) =>
                  current
                    ? {
                        ...current,
                        title: event.target.value,
                      }
                    : current
                )
              }
              className="mt-3 w-full rounded-2xl border border-transparent bg-slate-50 px-4 py-3 text-3xl font-black text-slate-900 outline-none transition-all focus:border-[#0d7c66] focus:bg-white"
            />
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Mặc định app sẽ render artifact theo đúng dạng hiển thị. Khi cần chỉnh tay, bạn có
              thể chuyển sang chế độ sửa text gốc.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-[20px] bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Context
              </div>
              <div className="mt-2 font-bold text-slate-900">{contextLabel}</div>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Source
              </div>
              <div className="mt-2 font-bold text-slate-900">
                {analysis.source === 'RECORDING' ? 'Recording' : 'Upload'}
              </div>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Artifacts
              </div>
              <div className="mt-2 font-bold text-slate-900">{artifactItems.length}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-5">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-4 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7af2d1]">
              Artifact browser
            </div>
            <div className="mt-4 space-y-3">
              {artifactItems.map((item) => {
                const Icon = item.icon;
                const active = item.key === selectedArtifact;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSelectedArtifact(item.key);
                      setViewMode('preview');
                    }}
                    className={`w-full rounded-[22px] border p-4 text-left transition-all ${
                      active
                        ? 'border-[#7af2d1] bg-white/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                          active ? 'bg-[#7af2d1] text-slate-950' : 'bg-white/10 text-white'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-white">{item.label}</div>
                        <div className="mt-1 text-xs text-white/60">{item.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">{activeArtifact.label}</div>
                <div className="text-xs text-slate-500">{activeArtifact.description}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('preview')}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${
                      viewMode === 'preview'
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Xem dạng chuẩn
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('edit')}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${
                      viewMode === 'edit'
                        ? 'bg-slate-950 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <FilePenLine className="h-3.5 w-3.5" />
                    Sửa text
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    copied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Đã sao chép' : 'Sao chép phần này'}
                </button>
              </div>
            </div>

            <div className="min-h-[60vh] bg-white px-5 py-5">
              {viewMode === 'preview' ? (
                <ArtifactPreview artifact={activeArtifact} analysis={analysis} />
              ) : (
                <textarea
                  value={activeArtifact.content}
                  onChange={(event) => updateArtifact(activeArtifact.key, event.target.value)}
                  className="min-h-[56vh] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-sm leading-7 text-slate-800 outline-none transition-all focus:border-[#0d7c66] focus:bg-white"
                  placeholder="Nội dung sẽ hiển thị tại đây..."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex w-full max-w-6xl justify-center">
          <button
            onClick={onNext}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#0d7c66] px-6 text-base font-bold uppercase tracking-[0.2em] text-white shadow-lg shadow-[#0d7c66]/25 transition-all hover:-translate-y-0.5 md:w-auto md:min-w-[320px]"
          >
            Sang bước xuất
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="h-24 md:hidden" />
    </div>
  );
};
