import { styled, Box, Tooltip, IconButton, Fade, Slider, Typography } from "@mui/material";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { forwardRef, useEffect, useState } from "react";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { toHHMMSS } from "../../utils/helpers";

export default function Controls(props) {
  const { player, playerApi, hls, overlayVisible, handleFullscreen } = props;
  const [position, setPosition] = useState(undefined);
  const [duration, setDuration] = useState(undefined);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    if (!player) return;
    const getTime = () => {
      if (seeking) return;
      setPosition(Math.round(player.currentTime));
      setDuration(Math.round(player.duration));
    };
    getTime();
    const interval = setInterval(getTime, 1000);
    return () => clearInterval(interval);
  }, [player, hls, seeking]);

  const playHandler = () => {
    playerApi.paused ? player.play() : player.pause();
  };

  const muteHandler = () => {
    player.muted = !playerApi.muted;
  };

  const handleVolumeChange = (e, newValue) => {
    player.muted = false;
    player.volume = newValue / 100;
  };

  const commitTimeChange = (e, value) => {
    player.currentTime = value;
    setPosition(value);
    setSeeking(false);
  };

  const handleTimeChange = (e, value) => {
    setSeeking(true);
    setPosition(value);
  };

  return (
    <Fade in={overlayVisible} onDoubleClick={(e) => e.stopPropagation()}>
      <Parent>
        <Box sx={{ pl: 1, pr: 1 }}>
          {!isNaN(duration) && !isNaN(position) && (
            <Slider
              sx={{ p: 0 }}
              size="normal"
              valueLabelDisplay="auto"
              valueLabelFormat={toHHMMSS}
              value={position}
              min={0}
              step={1}
              max={duration}
              onChange={handleTimeChange}
              onChangeCommitted={commitTimeChange}
            />
          )}
        </Box>

        <Box sx={{ display: "flex" }}>
          <ControlGroup style={{ justifyContent: "flex-start" }}>
            {playerApi.paused ? (
              <Tooltip enterTouchDelay={0} title="Play (space)" disableInteractive>
                <IconButton onClick={playHandler}>
                  <PlayArrowIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip enterTouchDelay={0} title="Pause (space)" disableInteractive>
                <IconButton onClick={playHandler}>
                  <PauseIcon />
                </IconButton>
              </Tooltip>
            )}
            {playerApi.muted ? (
              <Tooltip enterTouchDelay={0} title="Unmute (m)" disableInteractive>
                <IconButton onClick={muteHandler}>
                  <VolumeOffIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip enterTouchDelay={0} title="Mute (m)" disableInteractive>
                <IconButton onClick={muteHandler}>
                  <VolumeUpIcon />
                </IconButton>
              </Tooltip>
            )}
            <Box sx={{ height: "100%", width: "7rem", display: "flex", alignItems: "center", ml: 1 }}>
              {playerApi.muted !== undefined && <Slider size="small" value={playerApi.muted ? 0 : Math.round(playerApi.volume * 100)} valueLabelDisplay="auto" onChange={handleVolumeChange} />}
            </Box>
            <Box
              sx={{
                ml: 1.5,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Typography variant="caption">{`${toHHMMSS(position)}`}</Typography>
              <Box sx={{ ml: 0.5, mr: 0.5, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <Typography variant="caption">{`/`}</Typography>
              </Box>
              <Typography variant="caption">{`${toHHMMSS(duration)}`}</Typography>
            </Box>
          </ControlGroup>
          <ControlGroup style={{ justifyContent: "flex-end" }}>
            {playerApi.fullscreen ? (
              <Tooltip enterTouchDelay={0} title="Exit Fullscreen (f)" disableInteractive>
                <IconButton onClick={handleFullscreen}>
                  <FullscreenExitIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip enterTouchDelay={0} title="Fullscreen (f)" disableInteractive>
                <IconButton onClick={handleFullscreen}>
                  <FullscreenIcon />
                </IconButton>
              </Tooltip>
            )}
          </ControlGroup>
        </Box>
      </Parent>
    </Fade>
  );
}

const Parent = styled(forwardRef(({ ...props }, ref) => <div {...props} ref={ref} />))`
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.8) 0, rgba(0, 0, 0, 0.35) 60%, transparent);
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  overflow: visible;
  bottom: 0px;
  width: 100%;
  padding-bottom: 0.3rem;
`;

const ControlGroup = styled((props) => <div {...props} />)`
  flex-basis: 0;
  flex-grow: 1;
  display: flex;
  align-items: center;
`;
