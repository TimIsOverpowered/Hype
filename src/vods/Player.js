import { useEffect, useState, useCallback, forwardRef } from "react";
import canAutoPlay from "can-autoplay";
import { Box, CircularProgress, IconButton, styled } from "@mui/material";
import Twitch from "../twitch/gql";
import hlsParser from "hls-parser";
import debounce from "lodash.debounce";
import { Buffer } from "buffer";
import { LogoLoading } from "../utils/Loading";
import Hls from "hls.js";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Controls from "./player/Controls";
//fix for Hls-parser not having Buffer.
window.Buffer = window.Buffer || Buffer;

const hlsjsOptions = {
  debug: false,
  enableWorker: true,
};
let hls;

export default function Player(props) {
  const { player, setPlayer, vod, playerApi, setPlayerApi } = props;
  const [source, setSource] = useState(undefined);
  const [videoContainer, setVideoContainer] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);
  const [buffering, setBuffering] = useState(true);

  const videoRef = useCallback((node) => setPlayer(node), [setPlayer]);

  const videoContainerRef = useCallback((node) => {
    if (node) node.focus();
    setVideoContainer(node);
  }, []);

  useEffect(() => {
    if (!vod) return;
    const getM3u8 = async () => {
      let m3u8, m3u8Variants;
      const vodTokenSig = await Twitch.gqlGetVodTokenSig(vod.id);
      const masterM3u8 = await Twitch.getM3u8(vod.id, vodTokenSig.value, vodTokenSig.signature);
      if (masterM3u8) {
        m3u8Variants = hlsParser.parse(masterM3u8).variants;
        m3u8 = m3u8Variants[0].uri;
      } else {
        const regex = /(?:https:\/\/)?static-cdn\.jtvnw\.net\/cf_vods\/(?:[a-z0-9]+)\/([a-z0-9_]+)\//;
        const matches = vod.previewThumbnailURL.match(regex);
        if (!matches) return console.error("No Hash Matches");
        const hash = matches[1];
        if (!hash) return console.error("Did not find hash for m3u8");

        m3u8 = await Twitch.findM3u8(hash);
      }

      setSource(m3u8);
      setPlayerApi((playerApi) => ({ ...playerApi, source: m3u8, variants: m3u8Variants }));
    };
    getM3u8();
  }, [vod, setPlayerApi]);

  useEffect(() => {
    if (!player || !source) return;

    canAutoPlay.video({ inline: true }).then(async (obj) => {
      if (obj.result) return;

      let mutedAutoplay = await canAutoPlay.video({ muted: true, inline: true });
      if (mutedAutoplay.result) return (player.muted = true);

      //If muted autoplay doesn't work, display play overlay.
      setShowPlayOverlay(true);
    });

    player.onvolumechange = () => {
      setPlayerApi((playerApi) => ({ ...playerApi, muted: player.muted, volume: player.volume }));
    };

    player.onplay = () => {
      setShowPlayOverlay(false);
      setPlayerApi((playerApi) => ({ ...playerApi, paused: false }));
    };

    player.onplaying = () => {
      setBuffering(false);
    };

    player.onwaiting = () => {
      setBuffering(true);
    };

    player.onpause = () => {
      setPlayerApi((playerApi) => ({ ...playerApi, paused: true }));
      setBuffering(false);
      setShowPlayOverlay(true);
    };

    player.onseeked = () => {
      setPlayerApi((playerApi) => ({ ...playerApi }));
    };

    document.addEventListener("fullscreenchange", (e) => {
      const isInFullScreen =
        (document.fullscreenElement && document.fullscreenElement !== null) ||
        (document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
        (document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
        (document.msFullscreenElement && document.msFullscreenElement !== null);
      setPlayerApi((playerApi) => ({ ...playerApi, fullscreen: isInFullScreen }));
    });

    setPlayerApi((playerApi) => ({ ...playerApi, source: source, volume: 1, muted: player.muted }));

    const loadHLS = () => {
      hls = new Hls(hlsjsOptions);
      hls.attachMedia(player);
      hls.on(Hls.Events.MEDIA_ATTACHED, async () => {
        hls.loadSource(source);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error(data);
              if (data.details !== "manifestLoadError") hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error(data);
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        } else {
          console.error(data);
        }
      });
    };

    loadHLS();

    return () => {
      if (hls) hls.destroy();
    };
  }, [player, source, setPlayerApi]);

  const disableOverlay = () => {
    if (!overlayVisible) return;
    setOverlayVisible(false);
  };

  const debouncedOverlayHandler = useCallback(debounce(disableOverlay, 6000), []); // eslint-disable-line react-hooks/exhaustive-deps

  const mouseMove = () => {
    debouncedOverlayHandler();
    if (overlayVisible) return;
    setOverlayVisible(true);
  };

  const handleFullscreen = async (e) => {
    if (!player && !videoContainer) return;

    const isInFullScreen =
      (document.fullscreenElement && document.fullscreenElement !== null) ||
      (document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
      (document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
      (document.msFullscreenElement && document.msFullscreenElement !== null);

    if (!isInFullScreen) {
      if (videoContainer.requestFullscreen) videoContainer.requestFullscreen({ navigationUI: "hide" });
      else if (videoContainer.mozRequestFullScreen) videoContainer.mozRequestFullScreen({ navigationUI: "hide" });
      else if (videoContainer.webkitRequestFullscreen) videoContainer.webkitRequestFullscreen({ navigationUI: "hide" });
      else if (player.webkitEnterFullScreen) player.webkitEnterFullScreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  };

  const onKey = (e) => {
    switch (e.keyCode) {
      case 32: {
        e.preventDefault();
        playerApi.paused ? player.play() : player.pause();
        break;
      }
      case 77: {
        e.preventDefault();
        player.muted = !playerApi.muted;
        break;
      }
      case 70: {
        e.preventDefault();
        handleFullscreen();
        break;
      }
      case 37: {
        e.preventDefault();
        const currentTime = player.currentTime;
        if (currentTime - 10 < 0) return (player.currentTime = 0);
        player.currentTime = currentTime - 10;
        break;
      }
      case 39: {
        e.preventDefault();
        const currentTime = player.currentTime;
        if (currentTime + 10 > player.duration) return (player.currentTime = player.duration);
        player.currentTime = currentTime + 10;
        break;
      }
      default: {
        break;
      }
    }
  };

  return (
    <VideoContainer>
      {!source && <LogoLoading />}
      <Box tabIndex="-1" onKeyDown={onKey} ref={videoContainerRef} onMouseMove={mouseMove} onMouseLeave={() => setOverlayVisible(false)}>
        <Video onContextMenu={(e) => e.preventDefault()} autoPlay playsInline ref={videoRef} poster={vod.previewThumbnailURL} />
        <Box onDoubleClick={handleFullscreen} sx={{ position: "absolute", inset: "0px" }}>
          {buffering && (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <CircularProgress />
            </Box>
          )}
          {showPlayOverlay && (
            <PlayOverlay onClick={() => player.play()}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%" }}>
                <Box sx={{ position: "absolute" }}>
                  <IconButton onClick={() => player.play()}>
                    <PlayArrowIcon sx={{ fontSize: 80 }} />
                  </IconButton>
                </Box>
              </Box>
            </PlayOverlay>
          )}
          <Controls player={player} playerApi={playerApi} hls={hls} overlayVisible={overlayVisible} handleFullscreen={handleFullscreen} source={source} setSource={setSource} />
        </Box>
      </Box>
    </VideoContainer>
  );
}

const Video = styled(forwardRef(({ ...props }, ref) => <video {...props} ref={ref} />))`
  height: 100%;
  position: absolute;
  width: 100%;
  background: #000;
`;

const VideoContainer = styled(forwardRef(({ ...props }, ref) => <div {...props} ref={ref} />))`
  background: #000;
  overflow: hidden !important;
  position: absolute !important;
  inset: 0px !important;
`;

const PlayOverlay = styled((props) => <div {...props} />)`
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  flex-direction: column;
  inset: 0px;
  position: absolute;
  cursor: pointer;
`;
