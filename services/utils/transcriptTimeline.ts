export interface TranscriptTimelineSegment {
  timestamp: string | null;
  text: string;
}

const TIMESTAMP_TOKEN = /\[(\d{2}:\d{2}:\d{2})\]/g;
const TIMESTAMP_LINE = /^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/;

const normalizeChunk = (value: string) => value.replace(/\r\n/g, '\n').trim();

const splitTimestampChunks = (line: string) => {
  const normalized = line.replace(/\r/g, '').trim();
  if (!normalized) return [] as string[];

  const chunks = normalized
    .split(/(?=\[\d{2}:\d{2}:\d{2}\])/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.length > 0 ? chunks : [normalized];
};

export const parseTranscriptTimeline = (value: string): TranscriptTimelineSegment[] => {
  const rawLines = value.replace(/\r\n/g, '\n').split('\n');
  const segments: TranscriptTimelineSegment[] = [];
  let current: TranscriptTimelineSegment | null = null;

  const pushCurrent = () => {
    if (!current) return;

    const normalizedText = normalizeChunk(current.text);
    if (!normalizedText && !current.timestamp) {
      current = null;
      return;
    }

    segments.push({
      timestamp: current.timestamp,
      text: normalizedText,
    });
    current = null;
  };

  rawLines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      if (current?.text) current.text = `${current.text}\n`;
      return;
    }

    splitTimestampChunks(line).forEach((chunk) => {
      const timestampMatch = chunk.match(TIMESTAMP_LINE);
      if (timestampMatch) {
        pushCurrent();
        current = {
          timestamp: timestampMatch[1],
          text: timestampMatch[2] || '',
        };
        return;
      }

      if (!current) {
        current = {
          timestamp: null,
          text: chunk,
        };
        return;
      }

      current.text = current.text ? `${current.text}\n${chunk}` : chunk;
    });
  });

  pushCurrent();

  if (segments.length === 0 && value.trim()) {
    return [{ timestamp: null, text: normalizeChunk(value) }];
  }

  return segments;
};

export const buildTranscriptTimelineText = (segments: TranscriptTimelineSegment[]) =>
  segments
    .map((segment) => {
      const text = normalizeChunk(segment.text);
      if (!text) return '';
      return segment.timestamp ? `[${segment.timestamp}] ${text}` : text;
    })
    .filter(Boolean)
    .join('\n\n');

export const transcriptHasTimeline = (value: string) => TIMESTAMP_TOKEN.test(value);
