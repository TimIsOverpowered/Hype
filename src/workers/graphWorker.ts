import {
  MIN_LOG_LINE_LENGTH,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  SIMPLIFICATION_TOLERANCE,
  TOP_EMOTES_COUNT,
} from '../constants/ui';
import type {
  AggregateClipsPayload,
  AggregatePayload,
  IncomingWorkerMessage,
  OutgoingWorkerMessage,
  TopEmote,
} from '../types/graph';

interface ChapterEntry {
  readonly positionMilliseconds: number;
  readonly durationMilliseconds: number;
  readonly game?: string;
}

function buildChapterLookup(chapters: AggregatePayload['chapters']): ChapterEntry[] {
  if (!chapters) return [];
  return chapters.map((c) => ({
    positionMilliseconds: c.node.positionMilliseconds,
    durationMilliseconds: c.node.durationMilliseconds,
    game: c.node.details?.game?.displayName,
  }));
}

function getGameForTimestamp(timestampMs: number, chapterLookup: ChapterEntry[]): string | undefined {
  for (const chapter of chapterLookup) {
    if (
      timestampMs >= chapter.positionMilliseconds &&
      timestampMs < chapter.positionMilliseconds + chapter.durationMilliseconds
    ) {
      return chapter.game;
    }
  }
  return undefined;
}

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
    const code = emote.code || emote.text;
    const name = emote.name || code || String(emote.id);
    const key = code || name;
    lookup.set(key, { id: emote.id, code: key, name, provider: 'FFZ' });
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

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function aggregateLogs(payload: AggregatePayload): {
  results: Array<{
    x: number;
    y: number;
    subs: number;
    messages: number;
    emotes: Map<string, number>;
    searchMatches: number;
    game?: string;
  }>;
  threshold: number;
  percentile: number;
} {
  const { logs, duration, interval, emotes, searchType, searchTerm, threshold: userThreshold, chapters } = payload;

  const emoteLookup = buildEmoteLookup(emotes.bttv, emotes.ffz, emotes.seventv);
  const chapterLookup = buildChapterLookup(chapters);

  const buckets = new Map<
    number,
    { messages: number; subs: number; emotes: Map<string, number>; searchMatches: number; game?: string }
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

    if (!bucket.game && chapterLookup.length > 0) {
      const game = getGameForTimestamp(bucketKey * 1000, chapterLookup);
      if (game) {
        bucket.game = game;
      }
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

  const results: Array<{
    x: number;
    y: number;
    subs: number;
    messages: number;
    emotes: Map<string, number>;
    searchMatches: number;
    game?: string;
  }> = [];

  if (searchType === 'search') {
    const searchThreshold = userThreshold > 0 ? userThreshold : 1;
    for (const [bucketKey, data] of buckets) {
      if (data.searchMatches >= searchThreshold) {
        results.push({
          x: bucketKey,
          y: data.searchMatches,
          subs: data.subs,
          messages: data.messages,
          emotes: data.emotes,
          searchMatches: data.searchMatches,
          game: data.game,
        });
      }
    }
    results.sort((a, b) => a.x - b.x);
    return { results, threshold: searchThreshold, percentile: 0 };
  }

  const allCounts: number[] = [];
  for (const [, data] of buckets) {
    allCounts.push(data.messages);
  }
  allCounts.sort((a, b) => a - b);

  const percentileValue = percentile(allCounts, 25);
  const effectiveThreshold = userThreshold > 0 ? userThreshold : Math.max(1, Math.round(percentileValue));

  for (const [bucketKey, data] of buckets) {
    if (data.messages >= effectiveThreshold) {
      results.push({
        x: bucketKey,
        y: data.messages,
        subs: data.subs,
        messages: data.messages,
        emotes: data.emotes,
        searchMatches: data.searchMatches,
        game: data.game,
      });
    }
  }

  results.sort((a, b) => a.x - b.x);
  return { results, threshold: effectiveThreshold, percentile: Math.round(percentileValue) };
}

function buildGraphData(
  rawBuckets: Array<{
    x: number;
    y: number;
    subs: number;
    messages: number;
    emotes: Map<string, number>;
    searchMatches: number;
    game?: string;
  }>,
): Array<{
  x: number;
  y: number;
  duration: string;
  subs?: number;
  emotes?: TopEmote[];
  messages?: number;
  game?: string;
}> {
  const simplified = ramerDouglasPeucker(rawBuckets, SIMPLIFICATION_TOLERANCE);

  return simplified.map((point) => {
    const bucket = rawBuckets.find((b) => b.x === point.x);
    const emoteMap = bucket?.emotes;
    const topEmotes: TopEmote[] = emoteMap
      ? [...emoteMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, TOP_EMOTES_COUNT)
          .map(([name, count]) => ({ name, count }))
      : [];

    return {
      x: point.x,
      y: point.y,
      duration: toHHMMSS(point.x),
      subs: bucket && bucket.subs > 0 ? bucket.subs : undefined,
      messages: bucket ? bucket.messages : point.y,
      emotes: topEmotes.length > 0 ? topEmotes : undefined,
      game: bucket?.game,
    };
  });
}

function aggregateClips(payload: AggregateClipsPayload): Array<{
  x: number;
  y: number;
  duration: string;
  title?: string;
  slug?: string;
  clipDuration?: number;
  views?: number;
  game?: string;
}> {
  const { clips, chapters } = payload;

  const data: Array<{
    x: number;
    y: number;
    title?: string;
    slug?: string;
    clipDuration?: number;
    views?: number;
    game?: string;
  }> = [];

  for (const clip of clips) {
    const game = chapters.find((chapter) => chapter.node.positionMilliseconds <= clip.vod_offset * 1000);
    if (game) {
      data.push({
        x: clip.vod_offset,
        y: clip.views,
        title: clip.title,
        slug: clip.slug,
        clipDuration: clip.duration,
        views: clip.views,
        game: game.node.details?.game?.displayName,
      });
    } else {
      data.push({
        x: clip.vod_offset,
        y: clip.views,
        title: clip.title,
        slug: clip.slug,
        clipDuration: clip.duration,
        views: clip.views,
      });
    }
  }

  const simplified = ramerDouglasPeucker(
    data.map((d) => ({ x: d.x, y: d.y })),
    10,
  );

  return simplified.map((point) => {
    const original = data.find((d) => d.x === point.x);
    return {
      x: point.x,
      y: point.y,
      duration: toHHMMSS(point.x),
      title: original?.title,
      slug: original?.slug,
      clipDuration: original?.clipDuration,
      views: original?.views,
      game: original?.game,
    };
  });
}

self.onmessage = (e: MessageEvent<IncomingWorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'aggregate') {
    try {
      const { results: rawBuckets, threshold, percentile } = aggregateLogs(msg.payload);
      const data = buildGraphData(rawBuckets);

      self.postMessage({
        type: 'aggregateResult',
        payload: { data, computedThreshold: threshold, percentile },
      } as OutgoingWorkerMessage);
    } catch (err) {
      console.error('Worker aggregation failed:', err);
    }
  }

  if (msg.type === 'aggregateClips') {
    try {
      const data = aggregateClips(msg.payload);
      const totalViews = data.reduce((sum, d) => sum + d.y, 0);
      self.postMessage({ type: 'aggregateClipsResult', payload: { data, totalViews } } as OutgoingWorkerMessage);
    } catch (err) {
      console.error('Worker clips aggregation failed:', err);
    }
  }
};
