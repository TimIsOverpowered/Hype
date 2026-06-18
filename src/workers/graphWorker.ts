import {
  MIN_LOG_LINE_LENGTH,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  SIMPLIFICATION_TOLERANCE,
  TOP_EMOTES_COUNT,
} from '../constants/ui';
import type {
  AggregatePayload,
  IncomingWorkerMessage,
  OutgoingWorkerMessage,
  TopEmote,
  WorkerEmoteData,
} from '../types/graph';
import type { BttvEmote, FfzEmote, SevenTVEmote } from '../types/twitch';

interface EmoteLookupEntry {
  readonly id: string | number;
  readonly code: string;
  readonly name: string;
  readonly provider: string;
  readonly flags?: number;
}

function buildEmoteLookup(
  bttv: readonly BttvEmote[],
  ffz: readonly FfzEmote[],
  seventv: readonly SevenTVEmote[],
): Map<string, EmoteLookupEntry> {
  const lookup = new Map<string, EmoteLookupEntry>();

  for (const emote of bttv) {
    lookup.set(emote.code, { id: emote.id, code: emote.code, name: emote.code, provider: 'BTTV' });
  }

  for (const emote of ffz) {
    const key = emote.code ?? emote.text;
    if (key) {
      const name = emote.name ?? key;
      lookup.set(key, { id: emote.id, code: key, name, provider: 'FFZ' });
    }
  }

  for (const emote of seventv) {
    const name = emote.name ?? emote.code;
    lookup.set(name, { id: emote.id, code: emote.code, name, provider: '7TV', flags: emote.flags });
  }

  return lookup;
}

function toSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * SECONDS_PER_HOUR + parts[1] * SECONDS_PER_MINUTE + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * SECONDS_PER_MINUTE + parts[1];
  }
  return parts[0] ?? 0;
}

function parseLogLine(line: string): { timestamp: number; username: string; message: string } | null {
  const bracketOpen = line.indexOf('[');
  const bracketClose = line.indexOf(']');
  if (bracketOpen === -1 || bracketClose === -1) return null;

  const timeStr = line.substring(bracketOpen + 1, bracketClose);
  const timestamp = toSeconds(timeStr);

  const afterBracket = line.substring(bracketClose + 1);
  const colonIndex = afterBracket.indexOf(': ');
  if (colonIndex === -1) return null;

  const username = afterBracket.substring(1, colonIndex).trim();
  const message = afterBracket.substring(colonIndex + 2).trim();

  return { timestamp, username, message };
}

function ramerDouglasPeucker(
  points: Array<{ x: number; y: number }>,
  tolerance: number,
): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    let dist: number;
    if (lenSq === 0) {
      dist = Math.hypot(points[i].x - start.x, points[i].y - start.y);
    } else {
      const t = Math.max(0, Math.min(1, ((points[i].x - start.x) * dx + (points[i].y - start.y) * dy) / lenSq));
      const projX = start.x + t * dx;
      const projY = start.y + t * dy;
      dist = Math.hypot(points[i].x - projX, points[i].y - projY);
    }
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = ramerDouglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = ramerDouglasPeucker(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function detectEmotesInMessage(
  message: string,
  lookup: Map<string, EmoteLookupEntry>,
  emoteCounts: Map<string, number>,
): void {
  const words = message.split(/\s+/);
  for (const word of words) {
    const emote = lookup.get(word);
    if (emote) {
      emoteCounts.set(word, (emoteCounts.get(word) ?? 0) + 1);
    }
  }
}

function toHHMMSS(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hours, minutes, secs].map((a: number) => a.toString().padStart(2, '0')).join(':');
}

function aggregateLogs(payload: AggregatePayload): Array<{ x: number; y: number }> {
  const { logs, duration, interval, emotes, threshold, searchType, searchTerm } = payload;

  const emoteLookup = buildEmoteLookup(emotes.bttv, emotes.ffz, emotes.seventv);

  const buckets = new Map<
    number,
    { messages: number; subs: number; emotes: Map<string, number>; searchMatches: number }
  >();

  for (const log of logs) {
    if (!log || log.length < MIN_LOG_LINE_LENGTH) continue;

    const parsed = parseLogLine(log);
    if (!parsed) continue;

    const bucketKey = Math.floor(parsed.timestamp / interval) * interval;
    if (bucketKey >= duration) continue;

    let bucket = buckets.get(bucketKey);
    if (!bucket) {
      bucket = { messages: 0, subs: 0, emotes: new Map(), searchMatches: 0 };
      buckets.set(bucketKey, bucket);
    }

    bucket.messages++;

    if (parsed.username === 'twitchnotify') {
      bucket.subs++;
    }

    detectEmotesInMessage(parsed.message, emoteLookup, bucket.emotes);

    if (searchType === 'search' && searchTerm) {
      const words = parsed.message.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.toLowerCase() === searchTerm.toLowerCase()) {
          bucket.searchMatches++;
        }
      }
    }
  }

  const results: Array<{ x: number; y: number }> = [];

  for (const [bucketKey, data] of buckets) {
    let y: number;
    if (searchType === 'search') {
      y = data.searchMatches;
    } else {
      y = data.messages;
    }

    if (y >= threshold) {
      results.push({ x: bucketKey, y });
    }
  }

  results.sort((a, b) => a.x - b.x);
  return results;
}

function buildGraphData(
  rawBuckets: Array<{ x: number; y: number }>,
  logs: readonly string[],
  emotes: WorkerEmoteData,
): Array<{ x: number; y: number; duration: string; subs?: number; emotes?: TopEmote[]; messages?: number }> {
  const emoteLookup = buildEmoteLookup(emotes.bttv, emotes.ffz, emotes.seventv);

  const emoteCounts = new Map<string, number>();
  let subsTotal = 0;
  let messagesTotal = 0;

  for (const log of logs) {
    if (!log || log.length < MIN_LOG_LINE_LENGTH) continue;
    const parsed = parseLogLine(log);
    if (!parsed) continue;

    detectEmotesInMessage(parsed.message, emoteLookup, emoteCounts);

    if (parsed.username === 'twitchnotify') {
      subsTotal++;
    }
    messagesTotal++;
  }

  const topEmotes: TopEmote[] = [...emoteCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_EMOTES_COUNT)
    .map(([name, count]) => ({ name, count }));

  const simplified = ramerDouglasPeucker(rawBuckets, SIMPLIFICATION_TOLERANCE);

  return simplified.map((point) => ({
    x: point.x,
    y: point.y,
    duration: toHHMMSS(point.x),
    subs: subsTotal,
    messages: messagesTotal,
    emotes: topEmotes.length > 0 ? topEmotes : undefined,
  }));
}

self.onmessage = (e: MessageEvent<IncomingWorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'aggregate') {
    try {
      const rawBuckets = aggregateLogs(msg.payload);
      const data = buildGraphData(rawBuckets, msg.payload.logs, msg.payload.emotes);

      self.postMessage({ type: 'aggregateResult', payload: { data } } as OutgoingWorkerMessage);
    } catch (err) {
      console.error('Worker aggregation failed:', err);
    }
  }
};
