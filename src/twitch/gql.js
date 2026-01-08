import axios from "axios";
import { types } from "hls-parser";

const DOMAINS = [
  "https://vod-secure.twitch.tv",
  "https://vod-metro.twitch.tv",
  "https://vod-pop-secure.twitch.tv",
  "https://ds0h3roq6wcgc.cloudfront.net",
  "https://d2nvs31859zcd8.cloudfront.net",
  "https://d2aba1wr3818hz.cloudfront.net",
  "https://d3c27h4odz752x.cloudfront.net",
  "https://dgeft87wbj63p.cloudfront.net",
  "https://d1m7jfoe9zdc1j.cloudfront.net",
  "https://d3vd9lfkzbru3h.cloudfront.net",
  "https://ddacn6pr5v0tl.cloudfront.net",
  "https://d3aqoihi2n8ty8.cloudfront.net",
  "https://d6tizftlrpuof.cloudfront.net",
  "https://d36nr0u3xmc4mm.cloudfront.net",
  "https://d1oca24q5dwo6d.cloudfront.net",
  "https://d2um2qdswy1tb0.cloudfront.net",
  "https://d1w2poirtb3as9.cloudfront.net",
  "https://d6d4ismr40iw.cloudfront.net",
  "https://d1g1f25tn8m2e6.cloudfront.net",
  "https://dykkng5hnh52u.cloudfront.net",
  "https://d2dylwb3shzel1.cloudfront.net",
  "https://d2xmjdvx03ij56.cloudfront.net",
];

const Twitch = {
  getUsers: async function (channels) {
    const gqlQuery = `{ users(logins: ${channels}) { id login displayName profileImageURL(width: 300) }}`;
    const data = await axios({
      url: "https://gql.twitch.tv/gql",
      method: "POST",
      headers: {
        Accept: "*/*",
        "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: {
        query: gqlQuery,
      },
    })
      .then((response) => response.data.data)
      .then((data) => data.users)
      .catch((e) => {
        console.error(e);
        return null;
      });
    return data;
  },

  getVods: async function (channel) {
    const gqlQuery = `query { user(login: "${channel}") { id login displayName profileImageURL(width: 300) videos(first: 100) { edges { cursor node { id creator { login } title viewCount createdAt lengthSeconds broadcastType previewThumbnailURL(width: 320, height: 180) } } pageInfo { hasNextPage } } }}`;

    const data = await axios({
      url: "https://gql.twitch.tv/gql",
      method: "POST",
      headers: {
        Accept: "*/*",
        "Client-Id": "kd1unb4b3q4t58fwlpcbzcbnm76a8fp",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: {
        query: gqlQuery,
      },
    })
      .then((response) => response.data.data)
      .then((data) => data.user)
      .catch((e) => {
        console.error(e);
        return null;
      });
    return {
      user: {
        id: data.id,
        login: data.login,
        displayName: data.displayName,
        profileImageURL: data.profileImageURL,
      },
      videos: data.videos,
    };
  },

  getNextVods: async function (channel, cursor) {
    const gqlQuery = `query { user(login: "${channel}") { videos(first: 25, after: "${cursor}") { edges { cursor node { id creator { login } title viewCount createdAt lengthSeconds broadcastType previewThumbnailURL(width: 320, height: 180) } } pageInfo { hasNextPage } } }}`;

    const data = await axios({
      url: "https://gql.twitch.tv/gql",
      method: "POST",
      headers: {
        Accept: "*/*",
        "Client-Id": "kd1unb4b3q4t58fwlpcbzcbnm76a8fp",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: {
        query: gqlQuery,
      },
    })
      .then((response) => response.data.data)
      .then((data) => data.user.videos)
      .catch((e) => {
        console.error(e);
        return null;
      });
    return data;
  },

  getVod: async function (vodId) {
    const gqlQuery = `query { video(id: "${vodId}") { id title lengthSeconds broadcastType previewThumbnailURL(width: 1920, height: 1080) creator { id login displayName createdAt profileImageURL(width: 50) } }}`;

    const data = await axios({
      url: "https://gql.twitch.tv/gql",
      method: "POST",
      headers: {
        Accept: "*/*",
        "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: {
        query: gqlQuery,
      },
    })
      .then((response) => response.data.data)
      .then((data) => data.video)
      .catch((e) => {
        console.error(e);
        return null;
      });
    return data;
  },

  gqlGetVodTokenSig: async function (vodId) {
    const data = await axios({
      url: "https://gql.twitch.tv/gql",
      method: "POST",
      headers: {
        Accept: "*/*",
        "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: {
        operationName: "PlaybackAccessToken",
        variables: {
          isLive: false,
          login: "",
          isVod: true,
          vodID: vodId,
          platform: "web",
          playerBackend: "mediaplayer",
          playerType: "site",
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: "0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712",
          },
        },
      },
    })
      .then((response) => response.data.data)
      .then((data) => data.videoPlaybackAccessToken)
      .catch((e) => {
        console.error(e);
        return null;
      });
    return data;
  },

  getM3u8: async (vodId, token, sig) => {
    const data = await axios
      .get(`https://usher.ttvnw.net/vod/${vodId}.m3u8?allow_source=true&allow_audio_only=true&player=twitchweb&playlist_include_framerate=true&allow_spectre=true&nauthsig=${sig}&nauth=${token}`)
      .then((response) => response.data)
      .catch(async (e) => {
        console.error(e);
        return null;
      });
    return data;
  },

  checkM3u8: async (url) => {
    const data = await axios
      .head(url)
      .then(() => true)
      .catch(() => false);
    return data;
  },

  findM3u8: async (hash) => {
    let foundDomain;
    for (let domain of DOMAINS) {
      const exists = await Twitch.checkM3u8(`${domain}/${hash}/chunked/index-dvr.m3u8`);
      if (exists) {
        foundDomain = domain;
        break;
      }
    }
    const foundVariants = [],
      knownVariants = ["chunked", "720p60", "480p30", "audio_only", "360p30", "160p30"];

    for (let knownVariant of knownVariants) {
      const exists = await Twitch.checkM3u8(`${foundDomain}/${hash}/${knownVariant}/index-dvr.m3u8`);
      if (exists) foundVariants.push(knownVariant);
    }

    const { Variant, MasterPlaylist } = types;
    const variants = [];
    for (let foundVariant of foundVariants) {
      variants.push(new Variant({ uri: `${foundDomain}/${hash}/${foundVariant}/index-dvr.m3u8`, video: [{ name: foundVariant === "chunked" ? "Source" : foundVariant, groupId: foundVariant }] }));
    }
    const masterPlaylist = new MasterPlaylist({ variants: variants });

    return masterPlaylist;
  },

  getBadges: async (vodId) => {
    const data = await axios({
      url: "https://gql.twitch.tv/gql",
      method: "POST",
      headers: {
        Accept: "*/*",
        "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: {
        operationName: "VideoComments",
        variables: {
          videoID: vodId,
          hasVideoID: true,
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: "be06407e8d7cda72f2ee086ebb11abb6b062a7deb8985738e648090904d2f0eb",
          },
        },
      },
    })
      .then((response) => response.data?.data)
      .catch((e) => {
        console.error(e);
        return null;
      });
    return {
      globalBadges: data?.badges,
      channelBadges: data?.video.owner.broadcastBadges,
      channelCheerBadges: data?.video.owner.cheer,
    };
  },

  getComments: async (vodId, offset = 0) => {
    const data = await axios({
      url: "https://gql.twitch.tv/gql",
      method: "POST",
      headers: {
        Accept: "*/*",
        "Client-Id": "kd1unb4b3q4t58fwlpcbzcbnm76a8fp",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: {
        operationName: "VideoCommentsByOffsetOrCursor",
        variables: {
          videoID: vodId,
          contentOffsetSeconds: offset,
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a",
          },
        },
      },
    })
      .then((response) => response.data.data.video)
      .then((video) => {
        if (!video) return null;
        return video.comments.edges;
      })
      .catch((e) => {
        console.error(e);
        return null;
      });
    return data;
  },

  getNextComments: async (vodId, cursor) => {
    const data = await axios({
      url: "https://gql.twitch.tv/gql",
      method: "POST",
      headers: {
        Accept: "*/*",
        "Client-Id": "kd1unb4b3q4t58fwlpcbzcbnm76a8fp",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: {
        operationName: "VideoCommentsByOffsetOrCursor",
        variables: {
          videoID: vodId,
          cursor: cursor,
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: "b70a3591ff0f4e0313d126c6a1502d79a1c02baebb288227c582044aa76adf6a",
          },
        },
      },
    })
      .then((response) => response.data.data.video)
      .then((video) => {
        if (!video) return null;
        return video.comments.edges;
      })
      .catch((e) => {
        console.error(e);
        return null;
      });
    return data;
  },

  getChapters: async (vodID) => {
    const data = await axios({
      url: "https://gql.twitch.tv/gql",
      method: "POST",
      headers: {
        Accept: "*/*",
        "Client-Id": "kd1unb4b3q4t58fwlpcbzcbnm76a8fp",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: {
        operationName: "VideoPreviewCard__VideoMoments",
        variables: {
          videoId: vodID,
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: "7399051b2d46f528d5f0eedf8b0db8d485bb1bb4c0a2c6707be6f1290cdcb31a",
          },
        },
      },
    })
      .then((response) => response.data?.data)
      .then((data) => data?.video)
      .then((video) => video?.moments?.edges)
      .catch((e) => {
        console.error(e.response ? e.response.data : e);
        return null;
      });
    return data;
  },
};

export default Twitch;
