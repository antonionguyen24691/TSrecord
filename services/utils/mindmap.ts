import { SessionAnalysis } from '../../types';
import { parseTranscriptTimeline } from './transcriptTimeline';

export interface MindmapNode {
  label: string;
  depth: number;
}

export interface MindmapTreeNode {
  label: string;
  children: MindmapTreeNode[];
}

export interface MindmapRenderNode {
  id: string;
  label: string;
  depth: number;
  x: number;
  y: number;
  side: -1 | 0 | 1;
  parentId: string | null;
  childIds: string[];
  collapsed: boolean;
}

export interface MindmapRenderEdge {
  from: string;
  to: string;
}

export interface MindmapGraphLayout {
  nodes: MindmapRenderNode[];
  edges: MindmapRenderEdge[];
  width: number;
  height: number;
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

export const sanitizeMindmapLabel = (value: string) =>
  value
    .replace(/[`"*#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const parseMindmap = (value: string): MindmapNode[] => {
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

const buildFallbackMindmapFromAnalysis = (analysis: SessionAnalysis) => {
  const root = sanitizeMindmapLabel(analysis.title || 'Meeting');
  const summarySections = parseMarkdownHeadingSections(analysis.artifacts.summary);
  const decisionItems = parseBulletsFromText(analysis.artifacts.decisions, 4);
  const riskItems = parseBulletsFromText(analysis.artifacts.risks, 4);
  const actionItems = parseChecklist(analysis.artifacts.actionItems)
    .map((item) => item.text)
    .filter(Boolean)
    .slice(0, 5);
  const transcriptSegments = parseTranscriptTimeline(analysis.artifacts.transcript)
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

export const normalizeMermaidMindmap = (rawMindmap: string, analysis: SessionAnalysis) => {
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

export const mindmapNodesToTree = (nodes: MindmapNode[]): MindmapTreeNode | null => {
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

export const buildMindmapGraphLayout = (tree: MindmapTreeNode): MindmapGraphLayout => {
  const nodes: MindmapRenderNode[] = [];
  const edges: MindmapRenderEdge[] = [];
  const centerX = 560;
  const centerY = 380;
  const levelGapX = 230;
  const leafGapY = 90;
  const topLevelGapY = 120;

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
    side: 0,
    parentId: null,
    childIds: [],
    collapsed: false,
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
      side,
      parentId,
      childIds: [],
      collapsed: false,
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

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  edges.forEach((edge) => {
    const parent = nodeMap.get(edge.from);
    if (parent) parent.childIds.push(edge.to);
  });

  return { nodes, edges, width: 1120, height: 760 };
};

const getNodeBox = (node: MindmapRenderNode) => {
  const width = node.depth === 0 ? 240 : 210;
  const height = node.depth === 0 ? 72 : 60;
  return {
    minX: node.x - width / 2,
    maxX: node.x + width / 2,
    minY: node.y - height / 2,
    maxY: node.y + height / 2,
    width,
    height,
  };
};

export const computeMindmapViewport = ({
  graphNodes,
  viewWidth,
  viewHeight,
  padding = 80,
}: {
  graphNodes: MindmapRenderNode[];
  viewWidth: number;
  viewHeight: number;
  padding?: number;
}) => {
  if (graphNodes.length === 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  const bounds = graphNodes.reduce(
    (acc, node) => {
      const box = getNodeBox(node);
      return {
        minX: Math.min(acc.minX, box.minX),
        maxX: Math.max(acc.maxX, box.maxX),
        minY: Math.min(acc.minY, box.minY),
        maxY: Math.max(acc.maxY, box.maxY),
      };
    },
    { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY }
  );

  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
  const usableWidth = Math.max(1, viewWidth - padding * 2);
  const usableHeight = Math.max(1, viewHeight - padding * 2);
  const scale = Math.min(1.35, Math.max(0.35, Math.min(usableWidth / contentWidth, usableHeight / contentHeight)));

  const centeredWidth = contentWidth * scale;
  const centeredHeight = contentHeight * scale;

  return {
    scale,
    x: padding + (usableWidth - centeredWidth) / 2 - bounds.minX * scale,
    y: padding + (usableHeight - centeredHeight) / 2 - bounds.minY * scale,
  };
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const wrapMindmapLabel = (value: string, maxCharsPerLine: number) => {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) lines.push(current);
  return lines.length > 0 ? lines.slice(0, 4) : [value];
};

const strokeForDepth = (depth: number) => {
  const palette = ['#0f172a', '#0d7c66', '#2563eb', '#f59e0b', '#ec4899', '#14b8a6'];
  return palette[Math.min(depth, palette.length - 1)];
};

const renderMindmapLabelSvg = (node: MindmapRenderNode, _width: number, _height: number) => {
  const fontSize = node.depth === 0 ? 22 : 16;
  const lineHeight = node.depth === 0 ? 26 : 20;
  const maxChars = node.depth === 0 ? 18 : 20;
  const lines = wrapMindmapLabel(node.label, maxChars);
  const totalHeight = lines.length * lineHeight;
  const startY = node.y - totalHeight / 2 + fontSize - 3;
  const fill = node.depth === 0 ? '#ffffff' : '#1e293b';

  return `
    <text
      x="${node.x}"
      y="${startY}"
      text-anchor="middle"
      font-family="'Be Vietnam Pro', 'Segoe UI', sans-serif"
      font-size="${fontSize}"
      font-weight="${node.depth === 0 ? 800 : 650}"
      fill="${fill}"
    >
      ${lines
        .map(
          (line, index) =>
            `<tspan x="${node.x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
        )
        .join('')}
    </text>
  `.trim();
};

export const renderMindmapSvgMarkup = ({
  layout,
  title,
  viewWidth = 1400,
  viewHeight = 980,
}: {
  layout: MindmapGraphLayout;
  title?: string;
  viewWidth?: number;
  viewHeight?: number;
}) => {
  const viewport = computeMindmapViewport({
    graphNodes: layout.nodes,
    viewWidth,
    viewHeight,
    padding: 84,
  });

  const edgesMarkup = layout.edges
    .map((edge) => {
      const from = layout.nodes.find((node) => node.id === edge.from);
      const to = layout.nodes.find((node) => node.id === edge.to);
      if (!from || !to) return '';
      const midpoint = (from.x + to.x) / 2;
      const curve = `M ${from.x} ${from.y} C ${midpoint} ${from.y}, ${midpoint} ${to.y}, ${to.x} ${to.y}`;
      return `<path d="${curve}" fill="none" stroke="${strokeForDepth(to.depth)}" stroke-width="3.2" stroke-linecap="round" opacity="0.78" />`;
    })
    .join('\n');

  const nodesMarkup = layout.nodes
    .map((node) => {
      const width = node.depth === 0 ? 240 : 210;
      const height = node.depth === 0 ? 72 : 60;
      const x = node.x - width / 2;
      const y = node.y - height / 2;
      const fill = node.depth === 0 ? '#0f172a' : '#ffffff';
      const border = node.depth === 0 ? '#0f172a' : strokeForDepth(node.depth);

      return `
        <g>
          <rect
            x="${x}"
            y="${y}"
            width="${width}"
            height="${height}"
            rx="18"
            ry="18"
            fill="${fill}"
            stroke="${border}"
            stroke-width="${node.depth === 0 ? 0 : 2.5}"
          />
          ${renderMindmapLabelSvg(node, width, height)}
        </g>
      `.trim();
    })
    .join('\n');

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="${escapeXml(title || 'Mindmap')}">
  <defs>
    <linearGradient id="mindmap-surface" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fbff" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
    <filter id="mindmap-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.08" />
    </filter>
  </defs>
  <rect x="12" y="12" width="${viewWidth - 24}" height="${viewHeight - 24}" rx="30" ry="30" fill="url(#mindmap-surface)" stroke="#dbe5ef" stroke-width="2" />
  <g filter="url(#mindmap-card-shadow)" transform="translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})">
    ${edgesMarkup}
    ${nodesMarkup}
  </g>
</svg>
  `.trim();
};
