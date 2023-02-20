import { useRef, useState } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import EqualizerIcon from "@mui/icons-material/Equalizer";
import TheatersIcon from "@mui/icons-material/Theaters";
import SearchIcon from "@mui/icons-material/Search";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import TimeInput from "./settings/TimeInput";
import { hmsValid, toSeconds, toHHMMSS } from "../utils/helpers";
import SettingsModal from "./settings/Modal";

export default function Settings(props) {
  const { userChatDelay, setUserChatDelay, player, vodId } = props;
  const [showModal, setShowModal] = useState(false);
  const [clipStart, setClipStart] = useState("00:00:00");
  const [clipEnd, setClipEnd] = useState("00:00:00");
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
      m3u8: player.currentSrc(),
      startSeconds: startSeconds,
      endSeconds: endSeconds - startSeconds,
      startHMS: clipStart,
      endHMS: clipEnd,
    });
  };

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
              <IconButton title="Get Current Timestamp" onClick={() => setClipStart(toHHMMSS(Math.floor(player.currentTime())))} color="primary">
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
              <IconButton title="Get Current Timestamp" onClick={() => setClipEnd(toHHMMSS(Math.floor(player.currentTime())))} color="primary">
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
              <IconButton title="Clip Views" onClick={() => setShowModal(true)} color="primary">
                <TheatersIcon />
              </IconButton>
            </Box>
            <Box sx={{ borderLeft: "1px solid hsla(0,0%,100%,.1)", display: "flex", alignItems: "center" }}>
              <IconButton title="Volume" onClick={() => setShowModal(true)} color="primary">
                <EqualizerIcon />
              </IconButton>
            </Box>
            <Box sx={{ borderLeft: "1px solid hsla(0,0%,100%,.1)", display: "flex", alignItems: "center" }}>
              <IconButton title="Search" onClick={() => setShowModal(true)} color="primary">
                <SearchIcon />
              </IconButton>
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
      <SettingsModal userChatDelay={userChatDelay} setUserChatDelay={setUserChatDelay} showModal={showModal} setShowModal={setShowModal} player={player} vodId={vodId} />
    </>
  );
}
