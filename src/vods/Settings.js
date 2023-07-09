import { useRef, useState, useMemo } from "react";
import { Box, Typography, IconButton, TextField } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import EqualizerIcon from "@mui/icons-material/Equalizer";
import TheatersIcon from "@mui/icons-material/Theaters";
import SearchIcon from "@mui/icons-material/Search";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import TimeInput from "./settings/TimeInput";
import { hmsValid, toSeconds, toHHMMSS } from "../utils/helpers";
import SettingsModal from "./settings/Modal";
import CloseIcon from "@mui/icons-material/Close";
import debounce from "lodash.debounce";

export default function Settings(props) {
  const { userChatDelay, setUserChatDelay, player, vodId, hypeVod, setGraph, clips, clipStart, setClipStart, clipEnd, setClipEnd, graph, searchTerm, setSearchTerm, playerApi, logs } = props;
  const [showModal, setShowModal] = useState(false);
  const startRef = useRef();
  const endRef = useRef();

  const handleClip = () => {
    if (!player) return;

    if (!hmsValid(clipStart)) return alert("Invalid Start Timestamp! Must be in 00:00:00 format", "Hype");
    if (!hmsValid(clipEnd)) return alert("Invalid End Timestamp! Must be in 00:00:00 format", "Hype");

    const startSeconds = toSeconds(clipStart);
    const endSeconds = toSeconds(clipEnd);

    if (startSeconds >= endSeconds) return alert("Invalid input. Start Timestamp is the SAME or AFTER End Timestamp", "Hype");

    window.api.send("clip", {
      vodId: vodId,
      m3u8: playerApi.variants[0].uri,
      startSeconds: startSeconds,
      endSeconds: endSeconds - startSeconds,
      startHMS: clipStart,
      endHMS: clipEnd,
    });
  };

  const searchChange = useMemo(
    () =>
      debounce((evt) => {
        if (evt.target.value.length === 0) return;
        setSearchTerm(evt.target.value);
      }, 300),
    [setSearchTerm]
  );

  return (
    <>
      <Box
        sx={{
          border: "1px solid hsla(0,0%,100%,.1)",
          display: "flex",
          width: "100%",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", flex: 1, borderLeft: "1px solid hsla(0,0%,100%,.1)" }}>
          <Box sx={{ display: "flex", alignItems: "center", borderRight: "1px solid hsla(0,0%,100%,.1)" }} onClick={() => startRef.current.focus()}>
            <Box sx={{ pl: 1 }}>
              <Typography variant="caption" color="textSecondary">
                Start
              </Typography>
            </Box>
            <Box sx={{ pl: 1 }}>
              <TimeInput ref={startRef} onFocus={(e) => e.target.select()} value={clipStart} onChange={(e) => setClipStart(e.target.value)} />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <IconButton title="Get Current Timestamp" onClick={() => setClipStart(toHHMMSS(Math.floor(player.currentTime)))} color="primary">
                <ContentPasteIcon />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", borderRight: "1px solid hsla(0,0%,100%,.1)" }} onClick={() => endRef.current.focus()}>
            <Box sx={{ pl: 1 }}>
              <Typography variant="caption" color="textSecondary">
                End
              </Typography>
            </Box>
            <Box sx={{ pl: 1 }}>
              <TimeInput ref={endRef} onFocus={(e) => e.target.select()} value={clipEnd} onChange={(e) => setClipEnd(e.target.value)} />
            </Box>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <IconButton title="Get Current Timestamp" onClick={() => setClipEnd(toHHMMSS(Math.floor(player.currentTime)))} color="primary">
                <ContentPasteIcon />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", borderRight: "1px solid hsla(0,0%,100%,.1)" }}>
            <IconButton title="Clip" onClick={handleClip} color="primary">
              <ContentCutIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <Box sx={{ display: "flex", borderRight: "1px solid hsla(0,0%,100%,.1)" }}>
            <Box sx={{ borderLeft: "1px solid hsla(0,0%,100%,.1)", display: "flex", alignItems: "center" }}>
              {graph !== "clips" ? (
                <IconButton disabled={!clips} title="Clip Views" onClick={() => setGraph("clips")} color="primary">
                  <TheatersIcon />
                </IconButton>
              ) : (
                <IconButton title="Close" onClick={() => setGraph("messages")} color="primary">
                  <CloseIcon />
                </IconButton>
              )}
            </Box>
            <Box sx={{ borderLeft: "1px solid hsla(0,0%,100%,.1)", display: "flex", alignItems: "center" }}>
              {graph !== "volume" ? (
                <IconButton disabled={!hypeVod || !hypeVod?.volume_data} title="Volume" onClick={() => setGraph("volume")} color="primary">
                  <EqualizerIcon />
                </IconButton>
              ) : (
                <IconButton title="Close" onClick={() => setGraph("messages")} color="primary">
                  <CloseIcon />
                </IconButton>
              )}
            </Box>
            <Box sx={{ borderLeft: "1px solid hsla(0,0%,100%,.1)", display: "flex", alignItems: "center" }}>
              {graph !== "search" ? (
                <IconButton disabled={!logs} title="Search" onClick={() => setGraph("search")} color="primary">
                  <SearchIcon />
                </IconButton>
              ) : (
                <>
                  <IconButton title="Close" onClick={() => setGraph("messages")} color="primary">
                    <CloseIcon />
                  </IconButton>
                  <TextField sx={{ width: "125px" }} placeholder="Search" size="small" type="text" onChange={searchChange} defaultValue={searchTerm} />
                </>
              )}
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "end", alignItems: "center", flex: 1 }}>
          <Box sx={{ borderRight: "1px solid hsla(0,0%,100%,.1)", display: "flex", alignItems: "center" }}>
            <Box sx={{ borderLeft: "1px solid hsla(0,0%,100%,.1)", display: "flex", alignItems: "center" }}>
              <IconButton title="Settings" onClick={() => setShowModal(true)} color="primary">
                <SettingsIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>
      <SettingsModal
        userChatDelay={userChatDelay}
        setUserChatDelay={setUserChatDelay}
        showModal={showModal}
        setShowModal={setShowModal}
        player={player}
        vodId={vodId}
        interval={props.interval}
        setInterval={props.setInterval}
        messageThreshold={props.messageThreshold}
        setMessageThreshold={props.setMessageThreshold}
        searchThreshold={props.searchThreshold}
        setSearchThreshold={props.setSearchThreshold}
        volumeThreshold={props.volumeThreshold}
        setVolumeThreshold={props.setVolumeThreshold}
        playerApi={playerApi}
      />
    </>
  );
}
