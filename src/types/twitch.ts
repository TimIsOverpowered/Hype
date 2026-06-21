export interface TwitchUser {
  readonly id: string;
  readonly login: string;
  readonly displayName: string;
  readonly profileImageURL: string;
}

export interface SearchResult {
  readonly channel: string;
  readonly profileImageURL: string | null;
  readonly displayName: string;
}

export interface WhitelistChannel {
  readonly channel: string;
  readonly profileImageURL: string | null;
  readonly displayName: string;
}

export interface PaginatedWhitelistResponse {
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly channels: readonly WhitelistChannel[];
}

export interface VodNode {
  readonly id: string;
  readonly title: string;
  readonly lengthSeconds: number;
  readonly broadcastType: string;
  readonly previewThumbnailURL: string;
  readonly viewCount?: number;
  readonly createdAt?: string;
  readonly creator: Partial<TwitchUser>;
}

export interface VodEdge {
  readonly cursor: string;
  readonly node: VodNode;
}

export interface VodPage {
  readonly user: TwitchUser;
  readonly edges: readonly VodEdge[];
  readonly pageInfo: { readonly hasNextPage: boolean };
}

export interface ChatBadge {
  readonly setID: string;
  readonly version: string;
}

export interface ChatFragment {
  readonly text: string;
  readonly emote: { readonly emote_id: string } | null;
}

export interface ChatMessage {
  readonly fragments: ChatFragment[];
  readonly userBadges: ChatBadge[] | null;
  readonly userColor: string;
}

export interface CommentNode {
  readonly id: string;
  readonly commenter: { readonly displayName: string } | null;
  readonly contentOffsetSeconds: number;
  readonly message: ChatMessage;
}

export interface CommentEdge {
  readonly cursor: string;
  readonly node: CommentNode;
}

export interface CommentsConnection {
  readonly edges: readonly CommentEdge[];
  readonly pageInfo: { readonly hasNextPage: boolean };
}

export interface BadgeSet {
  readonly global_badges: readonly TwitchBadge[] | null;
  readonly channel_badges: readonly TwitchBadge[] | null;
  readonly channel_cheer_badges: readonly CheerBadge[] | null;
}

export interface TwitchBadge {
  readonly setID: string;
  readonly version: string;
  readonly image_1x: string;
  readonly image_2x: string;
  readonly image_4x: string;
}

export interface CheerBadge {
  readonly image_1x: string;
  readonly image_2x: string;
  readonly image_4x: string;
  readonly can_show_globally: boolean;
  readonly minimum_cheer_amount: number;
}

export interface ChapterEdge {
  readonly cursor: string | null;
  readonly node: ChapterNode;
}

export interface ChapterNode {
  readonly positionMilliseconds: number;
  readonly durationMilliseconds: number;
  readonly details: ChapterDetails;
}

export interface ChapterDetails {
  readonly game: ChapterGame | null;
}

export interface ChapterGame {
  readonly id: string;
  readonly displayName: string;
  readonly boxArtURL?: string;
}

export interface GqlRequest {
  readonly operationName?: string;
  readonly variables?: Record<string, unknown>;
  readonly extensions?: Record<string, unknown>;
  readonly query?: string;
}

export interface GqlResponse<T = unknown> {
  readonly data?: T;
  readonly errors?: readonly GqlError[];
}

export interface GqlError {
  readonly message: string;
  readonly extensions?: Record<string, unknown>;
}

export interface M3u8Variant {
  readonly uri: string;
  readonly name: string;
  readonly codec?: string;
}

// ─── Third-party emote types ───────────────────────────────────────────────

export type EmoteProvider = '7TV' | 'BTTV' | 'FFZ' | 'Twitch';

export interface BttvEmote {
  readonly id: string;
  readonly code: string;
  readonly width?: number;
  readonly height?: number;
}

export interface FfzEmote {
  readonly id: number | string;
  readonly code?: string;
  readonly name?: string;
  readonly text?: string;
  readonly width?: number;
  readonly height?: number;
}

export interface SevenTVEmote {
  readonly id: string;
  readonly code: string;
  readonly name?: string;
  readonly flags: number;
  readonly width?: number;
  readonly height?: number;
}

export interface EmoteEntry {
  readonly id: string | number;
  readonly code: string;
  readonly name?: string;
  readonly provider: EmoteProvider;
  readonly flags?: number;
}

// ─── Worker → Main thread serializable types ──────────────────────────────

export type FragmentType = 'text' | 'twitch' | 'custom' | 'emoji' | 'url';

export interface TextFragment {
  readonly type: 'text';
  readonly text: string;
}

export interface TwitchEmoteFragment {
  readonly type: 'twitch';
  readonly emote_id: string;
  readonly text: string;
}

export interface CustomEmoteFragment {
  readonly type: 'custom';
  readonly id: string;
  readonly code: string;
  readonly name?: string;
  readonly provider: EmoteProvider;
  readonly isZeroWidth?: boolean;
  readonly width?: number;
  readonly height?: number;
}

export interface EmojiFragment {
  readonly type: 'emoji';
  readonly text: string;
}

export interface UrlFragment {
  readonly type: 'url';
  readonly text: string;
}

export type FormattedFragment = TextFragment | TwitchEmoteFragment | CustomEmoteFragment | EmojiFragment | UrlFragment;

export interface FormattedMessage {
  readonly id: string;
  readonly displayName: string;
  readonly userColor: string;
  readonly contentOffsetSeconds: number;
  readonly badges: readonly ChatBadge[] | null;
  readonly fragments: readonly FormattedFragment[];
}

export interface WorkerEmoteData {
  readonly bttv: readonly BttvEmote[];
  readonly ffz: readonly FfzEmote[];
  readonly seventv: readonly SevenTVEmote[];
}

export interface WorkerProcessPayload {
  readonly timestamp: number;
  readonly rawComments: readonly CommentNode[];
  readonly filterWords: readonly string[];
  readonly emotes: WorkerEmoteData;
}

export interface WorkerProcessMessage {
  readonly type: 'process';
  readonly payload: WorkerProcessPayload;
}

export interface WorkerResultMessage {
  readonly type: 'result';
  readonly payload: {
    readonly messages: readonly FormattedMessage[];
  };
}

export type IncomingWorkerMessage = WorkerProcessMessage;
export type OutgoingWorkerMessage = WorkerResultMessage;
