import type { BttvEmote, FfzEmote, SevenTVEmote } from './twitch';

export type GraphType = 'messages' | 'volume' | 'clips' | 'search';

export interface TopEmote {
  readonly name: string;
  readonly count: number;
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

export interface WorkerEmoteData {
  readonly bttv: readonly BttvEmote[];
  readonly ffz: readonly FfzEmote[];
  readonly seventv: readonly SevenTVEmote[];
}

export interface AggregatePayload {
  readonly logs: readonly string[];
  readonly duration: number;
  readonly interval: number;
  readonly emotes: WorkerEmoteData;
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

export interface SetEmotesPayload {
  readonly emotes: WorkerEmoteData;
}

export interface SetSearchTermPayload {
  readonly term: string;
}

export interface AggregateMessage {
  readonly type: 'aggregate';
  readonly payload: AggregatePayload;
}

export interface SetEmotesMessage {
  readonly type: 'setEmotes';
  readonly payload: SetEmotesPayload;
}

export interface SetSearchTermMessage {
  readonly type: 'setSearchTerm';
  readonly payload: SetSearchTermPayload;
}

export type IncomingWorkerMessage = AggregateMessage | SetEmotesMessage | SetSearchTermMessage | AggregateClipsMessage;

export interface AggregateResult {
  readonly type: 'aggregateResult';
  readonly payload: {
    readonly data: readonly GraphDataPoint[];
    readonly computedThreshold: number;
    readonly percentile: number;
    readonly chapters?: Array<{
      positionMilliseconds: number;
      durationMilliseconds: number;
      game?: string;
      boxArtURL?: string;
    }>;
  };
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

export interface AggregateClipsMessage {
  readonly type: 'aggregateClips';
  readonly payload: AggregateClipsPayload;
}

export interface AggregateClipsResult {
  readonly type: 'aggregateClipsResult';
  readonly payload: {
    readonly data: readonly ClipDataPoint[];
    readonly totalViews: number;
    readonly chapters?: Array<{
      positionMilliseconds: number;
      durationMilliseconds: number;
      game?: string;
      boxArtURL?: string;
    }>;
  };
}

export type OutgoingWorkerMessage = AggregateResult | AggregateClipsResult;
