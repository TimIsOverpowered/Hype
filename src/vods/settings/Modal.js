import { useMemo, useState } from "react";
import debounce from "lodash.debounce";
import { Box, Modal, Typography, TextField, InputAdornment, Select, InputLabel, MenuItem, FormControl, IconButton } from "@mui/material";
import Logo from "../../assets/logo.svg";
import DownloadIcon from "@mui/icons-material/Download";

export default function Settings(props) {
  const { userChatDelay, setUserChatDelay, showModal, setShowModal, player, vodId, searchThreshold, messageThreshold, volumeThreshold, setSearchThreshold, setMessageThreshold, setVolumeThreshold } =
    props;
  const [quality, setQuality] = useState("chunked");

  const delayChange = useMemo(
    () =>
      debounce((evt) => {
        if (evt.target.value.length === 0) return;
        const value = Number(evt.target.value);
        if (isNaN(value)) return;
        setUserChatDelay(value);
      }),
    [setUserChatDelay]
  );

  const messageChange = useMemo(
    () =>
      debounce((evt) => {
        if (evt.target.value.length === 0) return;
        const value = Number(evt.target.value);
        if (isNaN(value)) return;
        setMessageThreshold(value);
      }),
    [setMessageThreshold]
  );

  const searchChange = useMemo(
    () =>
      debounce((evt) => {
        if (evt.target.value.length === 0) return;
        const value = Number(evt.target.value);
        if (isNaN(value)) return;
        setSearchThreshold(value);
      }),
    [setSearchThreshold]
  );

  const volumeChange = useMemo(
    () =>
      debounce((evt) => {
        if (evt.target.value.length === 0) return;
        const value = Number(evt.target.value);
        if (isNaN(value)) return;
        setVolumeThreshold(value);
      }),
    [setVolumeThreshold]
  );

  const handleDownload = () => {
    const m3u8 = player.currentSrc().replace("chunked", quality);

    window.api.send("vod", {
      vodId: vodId,
      m3u8: m3u8,
      duration: player.duration(),
    });
  };

  return (
    <Modal open={showModal} onClose={() => setShowModal(false)}>
      <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 350, bgcolor: "background.paper", border: "2px solid #000", boxShadow: 24, p: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <img alt="" src={Logo} width={200} />
        </Box>

        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", width: "100%" }}>
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Typography variant="h6">Playback Settings</Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            <TextField
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", style: { textAlign: "center" } }}
              InputProps={{
                endAdornment: <InputAdornment position="start">secs</InputAdornment>,
              }}
              fullWidth
              label="Chat Delay"
              size="small"
              type="text"
              onChange={delayChange}
              defaultValue={userChatDelay}
            />
          </Box>
        </Box>

        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", width: "100%" }}>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h6">Download Vod</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", mt: 2 }}>
            <FormControl variant="outlined" fullWidth size="small">
              <InputLabel id="select-label">Quality</InputLabel>
              <Select label="Quality" labelId="select-label" value={quality} onChange={(e) => setQuality(e.target.value)}>
                <MenuItem value={"chunked"}>Source</MenuItem>
                <MenuItem value={"720p60"}>720p60</MenuItem>
                <MenuItem value={"480p30"}>480p30</MenuItem>
                <MenuItem value={"360p30"}>360p30</MenuItem>
                <MenuItem value={"160p30"}>160p30</MenuItem>
                <MenuItem value={"audio_only"}>Audio Only</MenuItem>
              </Select>
            </FormControl>
            <IconButton size="large" title="Download" onClick={handleDownload} color="primary">
              <DownloadIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", width: "100%" }}>
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Typography variant="h6">Graph Settings</Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            <TextField
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", style: { textAlign: "center" } }}
              InputProps={{
                endAdornment: <InputAdornment position="start">messages</InputAdornment>,
              }}
              fullWidth
              label="Message Threshold"
              size="small"
              type="text"
              onChange={messageChange}
              defaultValue={messageThreshold}
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <TextField
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", style: { textAlign: "center" } }}
              InputProps={{
                endAdornment: <InputAdornment position="start">messages</InputAdornment>,
              }}
              fullWidth
              label="Search Threshold"
              size="small"
              type="text"
              onChange={searchChange}
              defaultValue={searchThreshold}
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <TextField
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", style: { textAlign: "center" } }}
              InputProps={{
                endAdornment: <InputAdornment position="start">dB</InputAdornment>,
              }}
              fullWidth
              label="Volume Threshold"
              size="small"
              type="text"
              onChange={volumeChange}
              defaultValue={volumeThreshold}
            />
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
