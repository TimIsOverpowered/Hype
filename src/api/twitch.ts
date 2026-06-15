import { M3U8_DOMAINS, Twitch } from '../constants/twitch';
import type {
  BadgeItem,
  BadgeSet,
  ChapterEdge,
  CheerBadge,
  CommentsConnection,
  GqlRequest,
  GqlResponse,
  M3u8Variant,
  TwitchUser,
  VodNode,
  VodPage,
} from '../types/twitch';

const PRIMARY_CLIENT_ID = Twitch.GQL_CLIENT_ID;
const GQL_URL = Twitch.GQL_URL;

function buildHeaders(clientId: string): Record<string, string> {
  return {
    Accept: '*/*',
    'Client-Id': clientId,
    'Content-Type': 'text/plain;charset=UTF-8',
  };
}

async function gqlPost<T>(clientId: string, body: GqlRequest): Promise<T> {
  const response = await fetch(GQL_URL, {
    method: 'POST',
    headers: buildHeaders(clientId),
    body: JSON.stringify(body),
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

function gql<T>(clientId: string, body: GqlRequest): Promise<T> {
  return gqlPost<T>(clientId, body);
}

// ─── Persisted query hashes ────────────────────────────────────────────────

const PERSISTED_QUERIES = {
  userVideos: '2778cc72eb7c90124e1e8149fd07ae5e7c15f93b08df8f9d19bc4d092e481a94',
  videoPage: 'd5b0545d288f50872d0e4c8a86fcb18b3c47c0bfb2f46d4d38b48b2c47fc037d',
  videoComments: 'b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a',
  videoMoments: '7399051b2d46f528d5f0eedf8b0db8d485bb1bb4c0a2c6707be6f1290cdcb31a',
  playbackAccessToken: 'ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9',
  videoCommentsBadges: 'be06407e8d7cda72f2ee086ebb11abb6b062a7deb8985738e648090904d2f0eb',
} as const;

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

export async function getVods(channel: string): Promise<VodPage> {
  const result = await gql<{
    user: {
      id: string;
      login: string;
      displayName: string;
      profileImageURL: string | null;
      videos: {
        edges: Array<{
          cursor: string;
          node: {
            id: string;
            title: string;
            lengthSeconds: number;
            broadcastType: string;
            previewThumbnailURL: string | null;
            viewCount: number;
            createdAt: string;
            creator: {
              id: string;
              login: string;
              displayName: string;
              profileImageURL: string | null;
            };
          };
        }> | null;
        pageInfo: { hasNextPage: boolean };
      };
    };
  }>(PRIMARY_CLIENT_ID, {
    operationName: 'UserVideos',
    variables: {
      username: channel,
      count: 25,
      offset: 0,
      includeReceivedRequestUser: false,
      platform: 'web',
      slugType: 'user',
    },
    extensions: {
      persistedQueries: {
        version: 1,
        sha256Hash: PERSISTED_QUERIES.userVideos,
      },
    },
  });

  const user = result.user;
  if (!user) {
    throw new Error(`User "${channel}" not found`);
  }

  type VodEdgeRaw = {
    cursor: string;
    node: {
      id: string;
      title: string;
      lengthSeconds: number;
      broadcastType: string;
      previewThumbnailURL: string | null;
      viewCount: number;
      createdAt: string;
      creator: {
        id: string;
        login: string;
        displayName: string;
        profileImageURL: string | null;
      };
    };
  };

  const edges = user.videos.edges?.filter((e): e is VodEdgeRaw => e != null) ?? [];

  return {
    user: {
      id: user.id,
      login: user.login,
      displayName: user.displayName,
      profileImageURL: user.profileImageURL ?? '',
    },
    edges: edges.map((e) => ({
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
          id: e.node.creator.id,
          login: e.node.creator.login,
          displayName: e.node.creator.displayName,
          profileImageURL: e.node.creator.profileImageURL ?? '',
        },
      },
    })),
    pageInfo: user.videos.pageInfo,
  };
}

export async function getNextVods(channel: string, cursor: string): Promise<VodPage> {
  type VodEdgeRaw = {
    cursor: string;
    node: {
      id: string;
      title: string;
      lengthSeconds: number;
      broadcastType: string;
      previewThumbnailURL: string | null;
      viewCount: number;
      createdAt: string;
      creator: {
        id: string;
        login: string;
        displayName: string;
        profileImageURL: string | null;
      };
    };
  };

  const result = await gql<{
    user: {
      id: string;
      login: string;
      displayName: string;
      profileImageURL: string | null;
      videos: {
        edges: Array<VodEdgeRaw> | null;
        pageInfo: { hasNextPage: boolean };
      };
    };
  }>(PRIMARY_CLIENT_ID, {
    operationName: 'UserVideos',
    variables: {
      username: channel,
      cursor,
      count: 25,
      includeReceivedRequestUser: false,
      platform: 'web',
      slugType: 'user',
    },
    extensions: {
      persistedQueries: {
        version: 1,
        sha256Hash: PERSISTED_QUERIES.userVideos,
      },
    },
  });

  const user = result.user;
  if (!user) {
    throw new Error(`User "${channel}" not found`);
  }

  const edges = user.videos.edges?.filter((e): e is VodEdgeRaw => e != null) ?? [];

  return {
    user: {
      id: user.id,
      login: user.login,
      displayName: user.displayName,
      profileImageURL: user.profileImageURL ?? '',
    },
    edges: edges.map((e) => ({
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
          id: e.node.creator.id,
          login: e.node.creator.login,
          displayName: e.node.creator.displayName,
          profileImageURL: e.node.creator.profileImageURL ?? '',
        },
      },
    })),
    pageInfo: user.videos.pageInfo,
  };
}

export async function getVod(vodId: string): Promise<VodNode> {
  const result = await gql<{
    video: {
      id: string;
      title: string;
      lengthSeconds: number;
      broadcastType: string;
      previewThumbnailURL: string | null;
      viewCount: number;
      creator: {
        id: string;
        login: string;
        displayName: string;
        profileImageURL: string | null;
      };
    };
  }>(PRIMARY_CLIENT_ID, {
    operationName: 'VideoPage',
    variables: {
      videoID: vodId,
      platform: 'web',
    },
    extensions: {
      persistedQueries: {
        version: 1,
        sha256Hash: PERSISTED_QUERIES.videoPage,
      },
    },
  });

  const video = result.video;
  if (!video) {
    throw new Error(`VOD "${vodId}" not found`);
  }

  return {
    id: video.id,
    title: video.title,
    lengthSeconds: video.lengthSeconds,
    broadcastType: video.broadcastType,
    previewThumbnailURL: video.previewThumbnailURL ?? '',
    viewCount: video.viewCount,
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

  const result = await gql<{
    video: {
      comments: {
        edges: Array<CommentEdgeRaw> | null;
        pageInfo: { hasNextPage: boolean };
      };
    };
  }>(PRIMARY_CLIENT_ID, {
    operationName: 'VideoCommentsByOffsetOrCursor',
    variables: {
      videoID: vodId,
      contentOffsetSeconds: offset,
    },
    extensions: {
      persistedQueries: {
        version: 1,
        sha256Hash: PERSISTED_QUERIES.videoComments,
      },
    },
  });

  const comments = result.video?.comments;
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
  const data = await gql<{
    videoPlaybackAccessToken: { value: string; signature: string };
  }>(PRIMARY_CLIENT_ID, {
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
      persistedQueries: {
        version: 1,
        sha256Hash: PERSISTED_QUERIES.playbackAccessToken,
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
  const data = await gql<{
    badges: BadgeItem[];
    video: { owner: { broadcastBadges: BadgeItem[]; cheer: CheerBadge[] } };
  }>(PRIMARY_CLIENT_ID, {
    operationName: 'VideoComments',
    variables: {
      videoID: vodId,
      hasVideoID: true,
    },
    extensions: {
      persistedQueries: {
        version: 1,
        sha256Hash: PERSISTED_QUERIES.videoCommentsBadges,
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
  const data = await gql<{
    video: { moments: { edges: ChapterEdge[] } };
  }>(PRIMARY_CLIENT_ID, {
    operationName: 'VideoPreviewCard__VideoMoments',
    variables: {
      videoId: vodId,
    },
    extensions: {
      persistedQueries: {
        version: 1,
        sha256Hash: PERSISTED_QUERIES.videoMoments,
      },
    },
  });

  return data.video?.moments?.edges ?? [];
}

export async function fetchM3u8(vodId: string, token: string, sig: string): Promise<string> {
  const codecs = encodeURIComponent('av1,h265,h264');
  const url = `${Twitch.USHER_BASE_URL}/${vodId}.m3u8?allow_source=true&allow_audio_only=true&player=twitchweb&playlist_include_framerate=true&allow_spectre=true&supported_codecs=${codecs}&nauthsig=${sig}&nauth=${token}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch M3U8: ${response.status}`);
  }

  return response.text();
}

export async function checkM3u8(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function findM3u8(hash: string): Promise<{ domains: string[]; variants: M3u8Variant[] }> {
  let foundDomain: string | null = null;

  for (const domain of M3U8_DOMAINS) {
    const exists = await checkM3u8(`${domain}/${hash}/chunked/index-dvr.m3u8`);
    if (exists) {
      foundDomain = domain;
      break;
    }
  }

  if (!foundDomain) {
    return { domains: [], variants: [] };
  }

  const knownVariants = ['chunked', '720p60', '480p30', 'audio_only', '360p30', '160p30'];
  const variants: M3u8Variant[] = [];

  for (const variant of knownVariants) {
    const exists = await checkM3u8(`${foundDomain}/${hash}/${variant}/index-dvr.m3u8`);
    if (exists) {
      variants.push({
        uri: `${foundDomain}/${hash}/${variant}/index-dvr.m3u8`,
        name: variant === 'chunked' ? 'Source' : variant,
      });
    }
  }

  const domains = variants.map(() => foundDomain);

  return { domains, variants };
}
