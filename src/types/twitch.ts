export interface TwitchUser {
  readonly id: string;
  readonly login: string;
  readonly displayName: string;
  readonly profileImageURL: string;
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
  readonly emote: { readonly emoteID: string } | null;
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
  readonly globalBadges: readonly BadgeItem[] | null;
  readonly channelBadges: readonly BadgeItem[] | null;
  readonly channelCheerBadges: readonly CheerBadge[] | null;
}

export interface BadgeItem {
  readonly id: string;
  readonly versions: readonly BadgeVersion[];
}

export interface BadgeVersion {
  readonly imageUrl1x: string;
  readonly imageUrl2x: string;
  readonly imageUrl4x: string;
  readonly title: string | null;
}

export interface CheerBadge extends BadgeVersion {
  readonly canShowGlobally: boolean;
  readonly minimumCheerAmount: number;
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
}
