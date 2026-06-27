export const Twitch = {
  GQL_URL: 'https://gql.twitch.tv/gql',
  USHER_BASE_URL: 'https://usher.ttvnw.net/vod',
  GQL_CLIENT_ID: 'kimne78kx3ncx6brgo4mv6wki5h1ko',
  BACKUP_GQL_CLIENT_ID: 'kd1unb4b3q4t58fwlpcbzcbnm76a8fp',
  VIDEO_PREVIEW_CARD_HASH: 'be06407e8d7cda72f2ee086ebb11abb6b062a7deb8985738e648090904d2f0eb',
  VIDEO_COMMENTS_BY_OFFSET_HASH: 'b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a',
  VIDEO_PLAYBACK_TOKEN_HASH: 'ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9',
  VIDEO_PREVIEWS_CARD_MOMENTS_HASH: '7399051b2d46f528d5f0eedf8b0db8d485bb1bb4c0a2c6707be6f1290cdcb31a',
  GQL_PERSISTED_QUERY_VERSION: 1,
} as const;

export const KnownM3u8Variants = ['chunked', '1080p60', '720p60', '720p30', '480p30', '360p30', '160p30', 'audio_only'] as const;

export const M3U8_DOMAINS = [
  'https://vod-secure.twitch.tv',
  'https://vod-metro.twitch.tv',
  'https://vod-pop-secure.twitch.tv',
  'https://ds0h3roq6wcgc.cloudfront.net',
  'https://d2nvs31859zcd8.cloudfront.net',
  'https://d2aba1wr3818hz.cloudfront.net',
  'https://d3c27h4odz752x.cloudfront.net',
  'https://dgeft87wbj63p.cloudfront.net',
  'https://d1m7jfoe9zdc1j.cloudfront.net',
  'https://d3vd9lfkzbru3h.cloudfront.net',
  'https://ddacn6pr5v0tl.cloudfront.net',
  'https://d3aqoihi2n8ty8.cloudfront.net',
  'https://d6tizftlrpuof.cloudfront.net',
  'https://d36nr0u3xmc4mm.cloudfront.net',
  'https://d1oca24q5dwo6d.cloudfront.net',
  'https://d2um2qdswy1tb0.cloudfront.net',
  'https://d1w2poirtb3as9.cloudfront.net',
  'https://d6d4ismr40iw.cloudfront.net',
  'https://d1g1f25tn8m2e6.cloudfront.net',
  'https://dykkng5hnh52u.cloudfront.net',
  'https://d2dylwb3shzel1.cloudfront.net',
  'https://d2xmjdvx03ij56.cloudfront.net',
] as const;
