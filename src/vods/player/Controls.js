import { styled, Box, Tooltip, IconButton, Fade, Slider, Typography, MenuList, MenuItem, ListItemIcon, ListItemText, ClickAwayListener, Paper, Divider } from "@mui/material";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { forwardRef, useEffect, useState } from "react";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { toHHMMSS } from "../../utils/helpers.js";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import SettingsIcon from "@mui/icons-material/Settings";

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export default function Controls(props) {
  const { player, playerApi, hls, overlayVisible, handleFullscreen, source, setSource } = props;
  const [position, setPosition] = useState(undefined);
  const [duration, setDuration] = useState(undefined);
  const [seeking, setSeeking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [menu, setMenu] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);

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

  const handleQualityChange = (variant) => {
    if (!hls) return;
    setSource(variant.uri);
  };

  const handlePlaybackRate = (rate) => {
    player.playbackRate = rate;
    setPlaybackRate(rate);
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
            <ClickAwayListener onClickAway={() => setShowSettings(false)}>
              <Box>
                {showSettings && (
                  <Box sx={{ position: "absolute", inset: "auto 0px 50px auto" }}>
                    <Paper sx={{ minWidth: 125, display: "inline-block", background: "#050404" }}>
                      {menu === "quality" ? (
                        <MenuList dense>
                          <MenuItem onClick={() => setMenu("")}>
                            <ListItemText>{`< Back`}</ListItemText>
                          </MenuItem>
                          <Divider />
                          {playerApi.variants &&
                            playerApi.variants.map((variant, i) => (
                              <MenuItem
                                key={`variant ${i}`}
                                onClick={(e) => {
                                  handleQualityChange(variant);
                                }}
                              >
                                <ListItemIcon>{source === variant.uri ? <RadioButtonCheckedIcon color="primary" /> : <RadioButtonUncheckedIcon color="primary" />}</ListItemIcon>
                                <ListItemText>{`${variant.video[0].name}`}</ListItemText>
                              </MenuItem>
                            ))}
                        </MenuList>
                      ) : menu === "playback-rate" ? (
                        <MenuList dense>
                          <MenuItem onClick={() => setMenu("")}>
                            <ListItemText>{`< Back`}</ListItemText>
                          </MenuItem>
                          <Divider />

                          {PLAYBACK_RATES.map((rate, i) => (
                            <MenuItem
                              key={`playback rate ${i}`}
                              onClick={(e) => {
                                handlePlaybackRate(rate);
                              }}
                            >
                              <ListItemIcon>{playbackRate === rate ? <RadioButtonCheckedIcon color="primary" /> : <RadioButtonUncheckedIcon color="primary" />}</ListItemIcon>
                              <ListItemText>{`${rate}x`}</ListItemText>
                            </MenuItem>
                          ))}
                        </MenuList>
                      ) : (
                        <MenuList dense>
                          <MenuItem onClick={() => setMenu("quality")}>
                            <ListItemText>Quality</ListItemText>
                            <Box sx={{ mr: 1 }}>
                              <Typography variant="caption">{`>`}</Typography>
                            </Box>
                          </MenuItem>
                          <Divider />
                          <MenuItem onClick={() => setMenu("playback-rate")}>
                            <ListItemText>Speed</ListItemText>
                            <Box sx={{ mr: 1 }}>
                              <Typography variant="caption">{`>`}</Typography>
                            </Box>
                          </MenuItem>
                        </MenuList>
                      )}
                    </Paper>
                  </Box>
                )}
                <Tooltip enterTouchDelay={0} title="Settings" disableInteractive>
                  <IconButton onClick={() => setShowSettings(!showSettings)}>
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </ClickAwayListener>
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
