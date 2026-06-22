import { parse as hlsParse } from 'hls-parser';
import { M3U8_DOMAINS, Twitch } from '../constants/twitch';
import type { ChapterEdge, GqlResponse, M3u8Variant, TwitchUser, VodNode, VodPage } from '../types/twitch';

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

  const data = await gqlPost<{ users: TwitchUser[] }>(PRIMARY_CLIENT_ID, {
    query: `
      query GetUsers($logins: [String!]!) {
        users(logins: $logins) { id login displayName profileImageURL(width: 300) }
      }
    `,
    variables: { logins: channels },
  });

  return data.users ?? [];
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
  const data = await gqlPost<VodsResponse>(BACKUP_CLIENT_ID, {
    query: `
      query GetUserVods($login: String!) {
        user(login: $login) {
          id login displayName profileImageURL(width: 300)
          videos(first: 100) {
            edges {
              cursor
              node {
                id title viewCount createdAt lengthSeconds broadcastType
                previewThumbnailURL(width: 320, height: 180)
                creator { login }
              }
            }
            pageInfo { hasNextPage }
          }
        }
      }
    `,
    variables: { login: channel },
  });

  const user = data.user;
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
  const data = await gqlPost<VodsOnlyResponse>(BACKUP_CLIENT_ID, {
    query: `
      query GetUserVodPage($login: String!, $cursor: Cursor!) {
        user(login: $login) {
          videos(first: 25, after: $cursor) {
            edges {
              cursor
              node {
                id title viewCount createdAt lengthSeconds broadcastType
                previewThumbnailURL(width: 320, height: 180)
                creator { login }
              }
            }
            pageInfo { hasNextPage }
          }
        }
      }
    `,
    variables: { login: channel, cursor },
  });

  const user = data.user;
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
  const data = await gqlPost<GetVodResponse>(PRIMARY_CLIENT_ID, {
    query: `
      query GetVideo($id: ID!) {
        video(id: $id) {
          id title lengthSeconds broadcastType
          previewThumbnailURL(width: 1920, height: 1080)
          creator { id login displayName createdAt profileImageURL(width: 50) }
        }
      }
    `,
    variables: { id: vodId },
  });

  const video = data.video;
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
  const data = await gqlPost<{ video: { game?: { id: string; displayName: string; boxArtURL?: string } | null } }>(
    BACKUP_CLIENT_ID,
    {
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
    },
  );

  const game = data.video?.game;
  if (!game) return null;

  let boxArtURL = game.boxArtURL;
  if (!boxArtURL) {
    const standardUrl = `https://static-cdn.jtvnw.net/ttv-boxart/${game.id}-40x53.jpg`;
    const standardCheck = await fetch(standardUrl);
    if (standardCheck.redirected) {
      boxArtURL = `https://static-cdn.jtvnw.net/ttv-boxart/${game.id}_IGDB-40x53.jpg`;
    } else {
      boxArtURL = standardUrl;
    }
  }

  return {
    cursor: null,
    node: {
      positionMilliseconds: 0,
      durationMilliseconds: lengthSeconds * 1000,
      details: {
        game: { id: game.id, displayName: game.displayName, boxArtURL },
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
  const p = Math.floor(Math.random() * 9000000) + 1000000;
  const url = `${Twitch.USHER_BASE_URL}/v2/${vodId}.m3u8?allow_source=true&allow_audio_only=true&player=twitchweb&platform=web&p=${p}&include_unavailable=true&supported_codecs=${codecs}&playlist_include_framerate=true&allow_spectre=true&nauthsig=${sig}&nauth=${token}&transcode_mode=cbr_v1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch M3U8: ${response.status}`);
  }

  return response.text();
}

interface UnavailableIvsVariant {
  'STABLE-VARIANT-ID': string;
  IVS_NAME: string;
  BANDWIDTH: number;
  CODECS: string;
  RESOLUTION: string;
  'FRAME-RATE': number;
  AUTHORIZATION_REASONS: string[];
  'IVS-VARIANT-SOURCE': string;
}

function parseIvsNames(masterM3u8: string): string[] {
  return [...masterM3u8.matchAll(/STABLE-VARIANT-ID="([^"]+)"/g)].map((m) => m[1]);
}

function extractHashAndDomain(variants: M3u8Variant[]): { hash: string | null; domain: string | null } {
  const firstUri = variants[0]?.uri;
  if (!firstUri) return { hash: null, domain: null };
  const match = firstUri.match(/(?:https?:\/\/[^/]+)\/([^/]+)\/[^/]+\/index-/);
  return {
    hash: match?.[1] ?? null,
    domain: (() => {
      try {
        return new URL(firstUri).origin;
      } catch {
        return null;
      }
    })(),
  };
}

function parseResolution(name: string): { width: number; height: number } | null {
  const match = name.match(/(\d+)x(\d+)/);
  if (match) return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
  const numMatch = name.match(/(\d+)p/);
  if (numMatch) {
    const h = parseInt(numMatch[1], 10);
    return { width: h * (h >= 1080 ? 16 / 9 : 16 / 9), height: h };
  }
  return null;
}

function recoverUnavailableVariants(rawMasterM3u8: string, existingVariants: M3u8Variant[]): M3u8Variant[] {
  const sessionMatch = rawMasterM3u8.match(/DATA-ID="com\.amazon\.ivs\.unavailable-media",VALUE="([^"]+)"/);
  if (!sessionMatch) return [];

  let decoded: UnavailableIvsVariant[];
  try {
    decoded = JSON.parse(atob(sessionMatch[1])) as UnavailableIvsVariant[];
  } catch {
    return [];
  }

  const { hash, domain } = extractHashAndDomain(existingVariants);
  if (!hash || !domain) return [];

  const existingNames = new Set(existingVariants.map((v) => v.name));

  return decoded
    .filter(
      (v) =>
        v.AUTHORIZATION_REASONS.includes('AUTHZ_NOT_LOGGED_IN') &&
        v.RESOLUTION &&
        !existingNames.has(v['STABLE-VARIANT-ID']),
    )
    .map((v) => {
      return {
        uri: `${domain}/${hash}/${v.IVS_NAME}/index-dvr.m3u8`,
        name: v['STABLE-VARIANT-ID'],
        codec: v.CODECS,
      };
    });
}

function sortVariantsByResolution(variants: M3u8Variant[]): M3u8Variant[] {
  return [...variants].sort((a, b) => {
    const resA = parseResolution(a.name);
    const resB = parseResolution(b.name);
    if (!resA && !resB) return 0;
    if (!resA) return 1;
    if (!resB) return -1;
    const pixelsA = resA.width * resA.height;
    const pixelsB = resB.width * resB.height;
    return pixelsB - pixelsA;
  });
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
      const stableNames = parseIvsNames(masterM3u8);
      const variants = parsed.variants.map((v, i) => {
        const stableName = stableNames[i];
        if (stableName === 'audio_only') return { uri: v.uri, name: 'Audio Only' };
        if (stableName) return { uri: v.uri, name: stableName };
        if (v.video?.[0]?.name) return { uri: v.uri, name: v.video[0].name };
        if (v.resolution) return { uri: v.uri, name: `${v.resolution.width}x${v.resolution.height}` };
        return { uri: v.uri, name: 'Unknown' };
      });
      const recovered = recoverUnavailableVariants(masterM3u8, variants);
      const allVariants = sortVariantsByResolution([...variants, ...recovered]);
      return { m3u8Url: allVariants[0]?.uri ?? '', variants: allVariants };
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
        if (exists) {
          controller.abort();
          return domain;
        }
        throw new Error('not found');
      }),
    ),
  ).catch(() => null);

  if (!foundDomain) {
    return { domains: [], variants: [] };
  }

  const knownVariants = ['chunked', '1080p60', '720p60', '720p30', '480p30', '360p30', '160p30', 'audio_only'];

  const variants = await Promise.all(
    knownVariants.map(async (variant) => {
      const exists = await checkM3u8(`${foundDomain}/${hash}/${variant}/index-dvr.m3u8`);
      if (!exists) return null;
      return {
        uri: `${foundDomain}/${hash}/${variant}/index-dvr.m3u8`,
        name: variant === 'chunked' ? 'Source' : variant,
      };
    }),
  );

  const foundVariants = variants.filter((v): v is M3u8Variant => v != null);
  const domains = foundVariants.map(() => foundDomain);

  return { domains, variants: foundVariants };
}
