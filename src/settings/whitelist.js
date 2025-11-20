import { useEffect, useState } from "react";
import { Box, Divider, Paper, Typography, IconButton, TextField, Alert } from "@mui/material";
import client from "../client.js";
import ClearIcon from "@mui/icons-material/Clear";
import SendIcon from "@mui/icons-material/Send";

export default function Whitelist(props) {
  const { user, status } = props;
  const [whitelistInput, setWhitelistInput] = useState("");
  const [clicked, setClicked] = useState(false);
  const [success, setSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [whitelists, setWhitelists] = useState([]);

  useEffect(() => {
    if (!user) return;
    setWhitelists(user.whitelists);
  }, [user]);

  const whitelist = async (evt) => {
    if (evt) evt.preventDefault();
    setClicked(true);
    const { accessToken } = await client.get("authentication");
    await fetch(`https://api.hype.lol/v1/whitelist/channel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        username: whitelistInput,
      }),
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        if (data.error) console.error(data.errorMSG);
        setSuccess(!data.error);
        setErrorMsg(data.errorMSG);
        if (data.whitelist) {
          user.whitelists.push(data.whitelist);
        }
      })
      .catch((e) => {
        console.error(e);
        setSuccess(false);
        setErrorMsg("Server encountered an error..");
      });
    setTimeout(() => {
      setClicked(false);
    }, 3000);
  };

  return (
    <div>
      <Typography variant="h5" fontWeight={500}>
        Whitelist
      </Typography>
      <Paper elevation={1} sx={{ mt: 2, mb: 4, border: "1px solid hsla(0,0%,100%,.1)" }}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: "flex", flexWrap: "nowrap", mb: 1, alignItems: "center" }}>
            <Info>Whitelists</Info>
            <Data>{`${user.whitelists.length}/${user.max_whitelist_channels}`}</Data>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", flexWrap: "nowrap", mb: 1, alignItems: "center" }}>
            <Info>Whitelist a Channel</Info>
            <Box sx={{ display: "flex", alignItems: "center", flexDirection: "column" }}>
              {success === false && (
                <Alert sx={{ mb: 2, width: "100%" }} severity="error">
                  {errorMsg}
                </Alert>
              )}
              <Box sx={{ display: "flex" }}>
                <TextField
                  disabled={!status}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  label="Whitelist a Channel"
                  variant="outlined"
                  onChange={(evt) => setWhitelistInput(evt.target.value)}
                />
                <IconButton color={success === true ? "success" : success === false ? "error" : "primary"} disabled={!status || clicked} onClick={whitelist} variant="contained">
                  <SendIcon color="inherit" size="small" />
                </IconButton>
              </Box>
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", flexWrap: "nowrap", alignItems: "center" }}>
            <Info>Whitelisted</Info>
            <Box>
              <List whitelists={whitelists} setWhitelists={setWhitelists} />
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
        </Box>
      </Paper>
    </div>
  );
}

const Info = (props) => (
  <Box sx={{ width: "15rem", flexShrink: 0, pr: 1.5 }}>
    <Box sx={{ mb: 0.2 }}>
      <Typography variant="h6" fontWeight={600} {...props}></Typography>
    </Box>
  </Box>
);

const Data = (props) => (
  <Box sx={{ display: "flex", alignItems: "center" }}>
    <Typography variant="body2" {...props}></Typography>
  </Box>
);

const List = (props) => {
  const { whitelists, setWhitelists } = props;

  const deleteWhitelist = async (whitelist) => {
    const confirmation = window.confirm(`Are you sure you want to delete ${whitelist.channel} from your whitelist?`);
    if (!confirmation) return;
    const { accessToken } = await client.get("authentication");
    await fetch(`https://api.hype.lol/v1/whitelist/channel`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        channel: whitelist.channel,
      }),
    })
      .then((data) => {
        if (data.error || data.code > 400 || data.status > 400) {
          console.error(data);
          return;
        }
        const index = whitelists.findIndex((_) => _.id === whitelist.id);
        const newWhitelist = [...whitelists];
        newWhitelist.splice(index, 1);
        setWhitelists(newWhitelist);
      })
      .catch((e) => {
        console.error(e);
      });
  };

  return whitelists.map((whitelist) => (
    <Box key={whitelist.id} sx={{ display: "flex", alignItems: "center" }}>
      <Typography variant="body2">{whitelist.channel}</Typography>
      <IconButton onClick={() => deleteWhitelist(whitelist)} variant="contained">
        <ClearIcon color="primary" size="small" />
      </IconButton>
    </Box>
  ));
};
