export type GraphType = 'messages' | 'volume' | 'clips' | 'search';

export interface SerializedEmote {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly provider: string;
  readonly width?: number;
  readonly height?: number;
}

export interface SerializedEmoteSet {
  readonly bttv: readonly SerializedEmote[];
  readonly ffz: readonly SerializedEmote[];
  readonly seventv: readonly SerializedEmote[];
}

export interface TopEmote {
  readonly name: string;
  readonly count: number;
}

export interface TopSpike {
  readonly time: number;
  readonly duration: string;
  readonly messages: number;
}

export interface GraphDataPoint {
  readonly x: number;
  readonly y: number;
  readonly duration: string;
  readonly subs?: number;
  readonly emotes?: readonly TopEmote[];
  readonly game?: string;
  readonly title?: string;
  readonly slug?: string;
  readonly clipDuration?: number;
  readonly views?: number;
  readonly messages?: number;
}

export interface AggregatePayload {
  readonly logs: readonly string[];
  readonly duration: number;
  readonly interval: number;
  readonly emotes: SerializedEmoteSet;
  readonly threshold: number;
  readonly searchType: GraphType;
  readonly searchTerm?: string;
  readonly chapters?: Array<{
    node: {
      positionMilliseconds: number;
      durationMilliseconds: number;
      details: {
        game?: { displayName?: string; boxArtURL?: string };
      };
    };
  }>;
}

export interface ClipDataPoint {
  readonly x: number;
  readonly y: number;
  readonly duration: string;
  readonly title?: string;
  readonly slug?: string;
  readonly clipDuration?: number;
  readonly views?: number;
  readonly game?: string;
}

export interface AggregateClipsPayload {
  clips: Array<{
    vod_offset: number;
    title: string;
    views: number;
    slug: string;
    duration: number;
  }>;
  chapters: Array<{
    node: {
      positionMilliseconds: number;
      durationMilliseconds: number;
      details: {
        game?: { displayName?: string; boxArtURL?: string };
        title?: string;
      };
    };
  }>;
}

export interface ChapterEntry {
  positionMilliseconds: number;
  durationMilliseconds: number;
  game?: string;
  boxArtURL?: string;
}

export interface GraphResult {
  data: readonly GraphDataPoint[];
  computedThreshold: number;
  percentile: number;
  chapters?: readonly ChapterEntry[];
  totalMessages?: number;
  topEmotes?: readonly TopEmote[];
  topSpikes?: readonly TopSpike[];
}

export interface ClipsResult {
  data: readonly ClipDataPoint[];
  totalViews: number;
  chapters?: readonly ChapterEntry[];
}
