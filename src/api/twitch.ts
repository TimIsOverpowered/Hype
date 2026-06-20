import { parse as hlsParse } from 'hls-parser';
import { M3U8_DOMAINS, Twitch } from '../constants/twitch';
import type {
  BadgeSet,
  ChapterEdge,
  CheerBadge,
  CommentsConnection,
  GqlResponse,
  M3u8Variant,
  TwitchBadge,
  TwitchUser,
  VodNode,
  VodPage,
} from '../types/twitch';

const PRIMARY_CLIENT_ID = Twitch.GQL_CLIENT_ID;
const BACKUP_CLIENT_ID = Twitch.BACKUP_GQL_CLIENT_ID;
const GQL_URL = Twitch.GQL_URL;

function buildHeaders(clientId: string): Record<string, string> {
  return {
    Accept: '*/*',
    'Client-Id': clientId,
    'Content-Type': 'text/plain;charset=UTF-8',
  };
}

async function gqlPost<T>(clientId: string, body: Record<string, unknown>): Promise<T> {
  const bodyStr = JSON.stringify(body);
  const response = await fetch(GQL_URL, {
    method: 'POST',
    headers: buildHeaders(clientId),
    body: bodyStr,
  });

  const json: GqlResponse<T> = await response.json();

  if (json.errors && json.errors.length > 0) {
    const messages = json.errors.map((e) => e.message);
    throw new Error(`GQL request failed: ${messages.join(', ')}`);
  }

  if (json.data == null) {
    throw new Error('GQL request returned no data');
  }

  return json.data as T;
}

// ─── Core API functions ────────────────────────────────────────────────────

export async function getUsers(channels: string[]): Promise<TwitchUser[]> {
  if (channels.length === 0) return [];

  const loginList = channels.map((c) => `"${c}"`).join(', ');
  const query = `{ users(logins: [${loginList}]) { id login displayName profileImageURL(width: 300) } }`;

  const response = await fetch(GQL_URL, {
    method: 'POST',
    headers: buildHeaders(PRIMARY_CLIENT_ID),
    body: JSON.stringify({ query }),
  });

  const json: GqlResponse<{ users: TwitchUser[] }> = await response.json();
  return json.data?.users ?? [];
}

type VodEdgeRaw = {
  cursor: string;
  node: {
    id: string;
    title: string;
    viewCount: number;
    createdAt: string;
    lengthSeconds: number;
    broadcastType: string;
    previewThumbnailURL: string | null;
    creator: { login: string };
  } | null;
};

type VodsResponse = {
  user: {
    id: string;
    login: string;
    displayName: string;
    profileImageURL: string | null;
    videos: {
      edges: VodEdgeRaw[] | null;
      pageInfo: { hasNextPage: boolean };
    };
  };
};

type VodsOnlyResponse = {
  user: {
    videos: {
      edges: VodEdgeRaw[] | null;
      pageInfo: { hasNextPage: boolean };
    };
  };
};

function mapEdges(edges: VodEdgeRaw[]) {
  return edges
    .filter((e): e is NonNullable<VodEdgeRaw> => e != null)
    .filter((e): e is { cursor: string; node: NonNullable<VodEdgeRaw['node']> } => e.node != null)
    .map((e) => ({
      cursor: e.cursor,
      node: {
        id: e.node.id,
        title: e.node.title,
        lengthSeconds: e.node.lengthSeconds,
        broadcastType: e.node.broadcastType,
        previewThumbnailURL: e.node.previewThumbnailURL ?? '',
        viewCount: e.node.viewCount,
        createdAt: e.node.createdAt,
        creator: {
          login: e.node.creator.login,
          id: '',
          displayName: '',
          profileImageURL: '',
        },
      },
    }));
}

export async function getVods(channel: string): Promise<VodPage> {
  const query = `query { user(login: "${channel}") { id login displayName profileImageURL(width: 300) videos(first: 100) { edges { cursor node { id creator { login } title viewCount createdAt lengthSeconds broadcastType previewThumbnailURL(width: 320, height: 180) } } pageInfo { hasNextPage } } }}`;

  const response = await fetch(GQL_URL, {
    method: 'POST',
    headers: buildHeaders(BACKUP_CLIENT_ID),
    body: JSON.stringify({ query }),
  });

  const json: GqlResponse<VodsResponse> = await response.json();

  if (json.errors) {
    const messages = json.errors.map((e) => e.message);
    throw new Error(`GQL request failed: ${messages.join(', ')}`);
  }

  const user = json.data?.user;
  if (!user) {
    throw new Error(`User "${channel}" not found`);
  }

  return {
    user: {
      id: user.id,
      login: user.login,
      displayName: user.displayName,
      profileImageURL: user.profileImageURL ?? '',
    },
    edges: mapEdges(user.videos.edges?.filter(Boolean) ?? []),
    pageInfo: user.videos.pageInfo,
  };
}

export async function getNextVods(channel: string, cursor: string): Promise<VodPage> {
  const query = `query { user(login: "${channel}") { videos(first: 25, after: "${cursor}") { edges { cursor node { id creator { login } title viewCount createdAt lengthSeconds broadcastType previewThumbnailURL(width: 320, height: 180) } } pageInfo { hasNextPage } } }}`;

  const response = await fetch(GQL_URL, {
    method: 'POST',
    headers: buildHeaders(BACKUP_CLIENT_ID),
    body: JSON.stringify({ query }),
  });

  const json: GqlResponse<VodsOnlyResponse> = await response.json();

  if (json.errors) {
    const messages = json.errors.map((e) => e.message);
    throw new Error(`GQL request failed: ${messages.join(', ')}`);
  }

  const user = json.data?.user;
  if (!user) {
    throw new Error(`User "${channel}" not found`);
  }

  return {
    user: {
      id: '',
      login: channel,
      displayName: '',
      profileImageURL: '',
    },
    edges: mapEdges(user.videos.edges?.filter(Boolean) ?? []),
    pageInfo: user.videos.pageInfo,
  };
}

type GetVodResponse = {
  video: {
    id: string;
    title: string;
    lengthSeconds: number;
    broadcastType: string;
    previewThumbnailURL: string | null;
    creator: {
      id: string;
      login: string;
      displayName: string;
      createdAt: string;
      profileImageURL: string | null;
    };
  };
};

export async function getVod(vodId: string): Promise<VodNode> {
  const query = `query { video(id: "${vodId}") { id title lengthSeconds broadcastType previewThumbnailURL(width: 1920, height: 1080) creator { id login displayName createdAt profileImageURL(width: 50) } }}`;

  const response = await fetch(GQL_URL, {
    method: 'POST',
    headers: buildHeaders(PRIMARY_CLIENT_ID),
    body: JSON.stringify({ query }),
  });

  const json: GqlResponse<GetVodResponse> = await response.json();

  if (json.errors) {
    const messages = json.errors.map((e) => e.message);
    throw new Error(`GQL request failed: ${messages.join(', ')}`);
  }

  const video = json.data?.video;
  if (!video) {
    throw new Error(`VOD "${vodId}" not found`);
  }

  return {
    id: video.id,
    title: video.title,
    lengthSeconds: video.lengthSeconds,
    broadcastType: video.broadcastType,
    previewThumbnailURL: video.previewThumbnailURL ?? '',
    creator: {
      id: video.creator.id,
      login: video.creator.login,
      displayName: video.creator.displayName,
      profileImageURL: video.creator.profileImageURL ?? '',
    },
  };
}

export async function getComments(vodId: string, offset: number): Promise<CommentsConnection> {
  type CommentEdgeRaw = {
    cursor: string;
    node: {
      id: string;
      commenter: { displayName: string } | null;
      contentOffsetSeconds: number;
      message: {
        fragments: Array<{
          text: string;
          emote: { emoteID: string } | null;
        }>;
        userBadges: Array<{ setID: string; version: string }> | null;
        userColor: string;
      };
    };
  };

  const data = await gqlPost<{
    video: { comments: { edges: CommentEdgeRaw[] | null; pageInfo: { hasNextPage: boolean } } };
  }>(BACKUP_CLIENT_ID, {
    operationName: 'VideoCommentsByOffsetOrCursor',
    variables: {
      videoID: vodId,
      contentOffsetSeconds: Math.floor(offset),
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: 'b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a',
      },
    },
  });

  const comments = data.video?.comments;
  if (!comments) {
    return { edges: [], pageInfo: { hasNextPage: false } };
  }

  const edges = comments.edges?.filter((e): e is CommentEdgeRaw => e != null) ?? [];

  return {
    edges: edges.map((e) => ({
      cursor: e.cursor,
      node: {
        id: e.node.id,
        commenter: e.node.commenter,
        contentOffsetSeconds: e.node.contentOffsetSeconds,
        message: {
          fragments: e.node.message.fragments.map((f) => ({
            text: f.text ?? '',
            emote: f.emote ? { emoteID: f.emote.emoteID } : null,
          })),
          userBadges: e.node.message.userBadges
            ? e.node.message.userBadges.map((b) => ({ setID: b.setID, version: b.version }))
            : null,
          userColor: e.node.message.userColor ?? '',
        },
      },
    })),
    pageInfo: comments.pageInfo ?? { hasNextPage: false },
  };
}

// ─── Helper functions ──────────────────────────────────────────────────────

export async function getVodToken(vodId: string): Promise<{ value: string; signature: string }> {
  const data = await gqlPost<{ videoPlaybackAccessToken: { value: string; signature: string } }>(PRIMARY_CLIENT_ID, {
    operationName: 'PlaybackAccessToken',
    variables: {
      isLive: false,
      login: '',
      isVod: true,
      vodID: vodId,
      platform: 'web',
      playerBackend: 'mediaplayer',
      playerType: 'site',
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: 'ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9',
      },
    },
  });

  const token = data.videoPlaybackAccessToken;
  if (!token) {
    throw new Error('Failed to get VOD token');
  }

  return { value: token.value, signature: token.signature };
}

export async function getBadges(vodId: string): Promise<BadgeSet> {
  const data = await gqlPost<{
    badges: TwitchBadge[];
    video: { owner: { broadcastBadges: TwitchBadge[]; cheer: CheerBadge[] } };
  }>(PRIMARY_CLIENT_ID, {
    operationName: 'VideoComments',
    variables: {
      videoID: vodId,
      hasVideoID: true,
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: 'be06407e8d7cda72f2ee086ebb11abb6b062a7deb8985738e648090904d2f0eb',
      },
    },
  });

  return {
    globalBadges: data.badges ?? null,
    channelBadges: data.video?.owner?.broadcastBadges ?? null,
    channelCheerBadges: data.video?.owner?.cheer ?? null,
  };
}

export async function getChapters(vodId: string): Promise<ReadonlyArray<ChapterEdge>> {
  const data = await gqlPost<{ video: { moments: { edges: ChapterEdge[] } } }>(BACKUP_CLIENT_ID, {
    operationName: 'VideoPreviewCard__VideoMoments',
    variables: {
      videoId: vodId,
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: '7399051b2d46f528d5f0eedf8b0db8d485bb1bb4c0a2c6707be6f1290cdcb31a',
      },
    },
  });

  return data.video?.moments?.edges ?? [];
}

export async function getChapter(vodId: string, lengthSeconds: number): Promise<ChapterEdge | null> {
  const data = await gqlPost<{ video: { game?: { id: string; displayName: string } | null } }>(BACKUP_CLIENT_ID, {
    operationName: 'NielsenContentMetadata',
    variables: {
      isCollectionContent: false,
      isLiveContent: false,
      isVODContent: true,
      collectionID: '',
      login: '',
      vodID: vodId,
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: '2dbf505ee929438369e68e72319d1106bb3c142e295332fac157c90638968586',
      },
    },
  });

  const game = data.video?.game;
  if (!game) return null;

  return {
    cursor: null,
    node: {
      positionMilliseconds: 0,
      durationMilliseconds: lengthSeconds * 1000,
      details: {
        game: { id: game.id, displayName: game.displayName },
      },
    },
  };
}

export async function getChaptersWithFallback(
  vodId: string,
  lengthSeconds: number,
): Promise<ReadonlyArray<ChapterEdge>> {
  const edges = await getChapters(vodId);
  if (edges.length > 0) return edges;

  const chapter = await getChapter(vodId, lengthSeconds);
  if (chapter) return [chapter];

  return [];
}

export async function fetchM3u8(vodId: string, token: string, sig: string): Promise<string> {
  const codecs = encodeURIComponent('av1,h265,h264');
  const url = `${Twitch.USHER_BASE_URL}/${vodId}.m3u8?allow_source=true&allow_audio_only=true&player=mediaplayer&include_unavailable=true&supported_codecs=${codecs}&playlist_include_framerate=true&allow_spectre=true&nauthsig=${sig}&nauth=${token}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch M3U8: ${response.status}`);
  }

  return response.text();
}

export async function resolveM3u8(
  vodId: string,
  token: string,
  sig: string,
  previewThumbnailUrl?: string,
): Promise<{ m3u8Url: string; variants: M3u8Variant[] }> {
  try {
    const masterM3u8 = await fetchM3u8(vodId, token, sig);
    const parsed = hlsParse(masterM3u8);
    if ('variants' in parsed) {
      const variants = parsed.variants.map(
        (v: { uri: string; resolution?: { width: number; height: number }; video?: { name?: string }[] }) => ({
          uri: v.uri,
          name: v.video?.[0]?.name
            ? `${v.video[0].name}`
            : v.resolution
              ? `${v.resolution.width}x${v.resolution.height}`
              : 'Unknown',
        }),
      );
      return { m3u8Url: variants[0]?.uri ?? '', variants };
    }
    throw new Error('Received non-master playlist from usher');
  } catch {
    // Fallback: CloudFront scan
  }

  if (!previewThumbnailUrl) {
    throw new Error('Usher failed and no preview thumbnail URL available for fallback');
  }

  const regex = /(?:https:\/\/)?static-cdn\.jtvnw\.net\/cf_vods\/(?:[a-z0-9]+)\/([a-z0-9_]+)\//;
  const match = previewThumbnailUrl.match(regex);
  const hash = match?.[1];
  if (!hash) {
    throw new Error('Could not extract VOD hash from preview thumbnail URL');
  }

  const result = await findM3u8(hash);
  return { m3u8Url: result.variants[0]?.uri ?? '', variants: result.variants };
}

export async function checkM3u8(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', signal });
    return response.ok;
  } catch {
    return false;
  }
}

export async function findM3u8(hash: string): Promise<{ domains: string[]; variants: M3u8Variant[] }> {
  const controller = new AbortController();
  const { signal } = controller;

  const foundDomain = await Promise.any(
    M3U8_DOMAINS.map((domain) =>
      checkM3u8(`${domain}/${hash}/chunked/index-dvr.m3u8`, signal).then((exists) => {
        if (exists) return domain;
        throw new Error('not found');
      }),
    ),
  ).catch(() => null);

  if (!foundDomain) {
    return { domains: [], variants: [] };
  }

  const knownVariants = ['chunked', '1080p60', '720p60', '480p30', 'audio_only', '360p30', '160p30'];
  const foundVariant = await Promise.any(
    knownVariants.map((variant) =>
      checkM3u8(`${foundDomain}/${hash}/${variant}/index-dvr.m3u8`, signal).then((exists) => {
        if (exists) return variant;
        throw new Error('not found');
      }),
    ),
  ).catch(() => null);

  const variants: M3u8Variant[] = [];
  if (foundVariant) {
    variants.push({
      uri: `${foundDomain}/${hash}/${foundVariant}/index-dvr.m3u8`,
      name: foundVariant === 'chunked' ? 'Source' : foundVariant,
    });
  }

  const domains = variants.map(() => foundDomain);

  return { domains, variants };
}
