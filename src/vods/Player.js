import React, { useEffect, useState } from "react";
import canAutoPlay from "can-autoplay";
import { Box } from "@mui/material";
import VideoJS from "./player/VideoJS";
import Twitch from "../twitch/gql";
import "videojs-hotkeys";
import Hls from "hls-parser";
import { Buffer } from "buffer";
import { LogoLoading } from "../utils/Loading";
//fix for Hls-parser not having Buffer.
window.Buffer = window.Buffer || Buffer;

export default function Player(props) {
  const { vod, player, setPlayer, setPlaying } = props;
  const [source, setSource] = useState(undefined);
  const videoJsOptions = {
    autoplay: true,
    controls: true,
    responsive: false,
    fluid: false,
    poster: vod.previewThumbnailURL,
    controlBar: {
      pictureInPictureToggle: false,
    },
  };

  const onReady = (player) => {
    setPlayer(player);

    player.hotkeys({
      alwaysCaptureHotkeys: true,
      volumeStep: 0.1,
      seekStep: 10,
      enableModifiersForNumbers: false,
      enableMute: true,
      enableFullscreen: true,
    });

    canAutoPlay.video().then(({ result }) => {
      if (!result) player.muted(true);
    });

    player.on("play", () => {
      setPlaying(true);
    });

    player.on("pause", () => {
      setPlaying(false);
    });

    player.on("end", () => {
      setPlaying(false);
    });

    getM3u8();
  };

  const getM3u8 = async () => {
    let m3u8;
    const vodTokenSig = await Twitch.gqlGetVodTokenSig(vod.id);
    const masterM3u8 = await Twitch.getM3u8(vod.id, vodTokenSig.value, vodTokenSig.signature);
    if (masterM3u8) {
      m3u8 = Hls.parse(masterM3u8).variants[0].uri;
    } else {
      const regex = /(?:https:\/\/)?static-cdn\.jtvnw\.net\/cf_vods\/(?:[a-z0-9]+)\/([a-z0-9_]+)\//;
      const matches = vod.previewThumbnailURL.match(regex);
      if (!matches) return console.error("No Hash Matches");
      const hash = matches[1];
      if (!hash) return console.error("Did not find hash for m3u8");

      m3u8 = await Twitch.findM3u8(hash);
    }

    setSource(m3u8);
  };

  useEffect(() => {
    if (!source || !player) return;
    player.src(source);
  }, [source, player]);

  return (
    <Box sx={{ height: "100%", width: "100%" }}>
      {!source && <LogoLoading />}
      <Box sx={{ height: "100%", width: "100%", visibility: !source ? "hidden" : "visible" }}>
        <VideoJS options={videoJsOptions} onReady={onReady} />
      </Box>
    </Box>
  );
}
