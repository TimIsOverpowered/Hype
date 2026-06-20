import { MIN_LOG_LINE_LENGTH, SIMPLIFICATION_TOLERANCE, TOP_EMOTES_COUNT } from '../constants/ui';
import type {
  AggregateClipsPayload,
  AggregatePayload,
  IncomingWorkerMessage,
  OutgoingWorkerMessage,
  TopEmote,
} from '../types/graph';
import { buildEmoteLookup, type EmoteLookupEntry } from '../utils/emoteLookup';
import { toHHMMSS as toHHMMSSUtil } from '../utils/time';

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
  let lo = 0;
  let hi = chapterLookup.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const chapter = chapterLookup[mid];
    if (timestampMs < chapter.positionMilliseconds) {
      hi = mid - 1;
    } else if (timestampMs >= chapter.positionMilliseconds + chapter.durationMilliseconds) {
      lo = mid + 1;
    } else {
      return chapter.game;
    }
  }
  return undefined;
}

function toSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
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

  const result: Array<{ x: number; y: number }> = [];
  _rdp(points, 0, points.length - 1, tolerance, result);
  return result;
}

function _rdp(
  points: Array<{ x: number; y: number }>,
  start: number,
  end: number,
  tolerance: number,
  output: Array<{ x: number; y: number }>,
): void {
  output.push(points[start]);

  if (end - start <= 1) {
    if (end > start) output.push(points[end]);
    return;
  }

  let maxDist = 0;
  let maxIndex = start;
  const startPt = points[start];
  const endPt = points[end];

  const dx = endPt.x - startPt.x;
  const dy = endPt.y - startPt.y;
  const lenSq = dx * dx + dy * dy;

  for (let i = start + 1; i < end; i++) {
    let dist: number;
    if (lenSq === 0) {
      dist = Math.hypot(points[i].x - startPt.x, points[i].y - startPt.y);
    } else {
      const t = Math.max(0, Math.min(1, ((points[i].x - startPt.x) * dx + (points[i].y - startPt.y) * dy) / lenSq));
      const projX = startPt.x + t * dx;
      const projY = startPt.y + t * dy;
      dist = Math.hypot(points[i].x - projX, points[i].y - projY);
    }
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    _rdp(points, start, maxIndex, tolerance, output);
    _rdp(points, maxIndex, end, tolerance, output);
  }
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
  const bucketMap = new Map(rawBuckets.map((b) => [b.x, b]));
  const simplified = ramerDouglasPeucker(rawBuckets, SIMPLIFICATION_TOLERANCE);

  return simplified.map((point) => {
    const bucket = bucketMap.get(point.x);
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
      duration: toHHMMSSUtil(point.x),
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

  const dataMap = new Map(data.map((d) => [d.x, d]));
  const simplified = ramerDouglasPeucker(
    data.map((d) => ({ x: d.x, y: d.y })),
    10,
  );

  return simplified.map((point) => {
    const original = dataMap.get(point.x);
    return {
      x: point.x,
      y: point.y,
      duration: toHHMMSSUtil(point.x),
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
