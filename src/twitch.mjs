import axios from "axios";
import HLS from "hls-parser";

const Twitch = {
  gqlGetVodTokenSig: async function (vodID) {
    let data;
    await axios({
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
          vodID: vodID,
          platform: "web",
          playerBackend: "mediaplayer",
          playerType: "site",
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash:
              "0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712",
          },
        },
      },
    })
      .then((response) => {
        data = response.data.data.videoPlaybackAccessToken;
      })
      .catch(async (e) => {
        if (!e.response) {
          return console.error(e);
        }
        console.error(e.response.data);
      });
    return data;
  },

  getM3u8: async (vodId, token, sig) => {
    let data;
    await axios
      .get(
        `https://usher.ttvnw.net/vod/${vodId}.m3u8?allow_source=true&allow_audio_only=true&player=twitchweb&playlist_include_framerate=true&allow_spectre=true&nauthsig=${sig}&nauth=${token}`
      )
      .then((response) => {
        data = response.data;
      })
      .catch(async (e) => {
        if (!e.response) {
          return console.error(e);
        }
        console.error(e.response.data);
      });
    return data;
  },

  getParsedM3u8: (m3u8, variant = 0) => {
    return HLS.parse(m3u8).variants[variant].uri;
  }
};

export default Twitch;