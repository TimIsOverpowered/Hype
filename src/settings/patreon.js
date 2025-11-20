import { useEffect, useState } from "react";
import { Box, Button, Divider, Paper, Typography, Alert } from "@mui/material";
import client from "../client.js";

export default function Patreon(props) {
  const { user } = props;
  const [clicked, setClicked] = useState(false);
  const [success, setSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (user === undefined) return;
    document.title = `Patreon - ${user.display_name}`;
  }, [user]);

  if (user === undefined) return <></>;

  const { patreon } = user;

  const verifyPatron = async (evt) => {
    if (evt) evt.preventDefault();
    setClicked(true);
    const { accessToken } = await client.get("authentication");
    await fetch("https://api.hype.lol/v1/user/verify/patreon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        if (data.error) console.error(data);
        setSuccess(!data.error);
        setErrorMsg(data.message);
      })
      .catch((e) => {
        setSuccess(false);
        setErrorMsg("Server encountered an Error!");
        return console.error(e);
      });
    setTimeout(() => {
      setClicked(false);
    }, 3000);
  };

  return (
    <Box sx={{ mt: 2, maxWidth: "48rem", pb: 1.5 }}>
      <div>
        <Typography variant="h5" fontWeight={500}>
          Patreon
        </Typography>
        <Paper elevation={1} sx={{ mt: 2, mb: 4, border: "1px solid hsla(0,0%,100%,.1)" }}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "nowrap" }}>
              <Info>Patreon Status</Info>
              <Data>{patreon.isPatron ? "You are a patron!" : "You are not a patron!"}</Data>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", flexWrap: "nowrap", mb: 1 }}>
              <Info>Patreon Tier</Info>
              <Data>{patreon.tierName}</Data>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", flexWrap: "nowrap", mb: 1, justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
              {success === false && (
                <Alert sx={{ mb: 2 }} severity="error">
                  {errorMsg}
                </Alert>
              )}
              <Button onClick={verifyPatron} disabled={clicked} variant="contained">
                Update
              </Button>
            </Box>
          </Box>
        </Paper>
      </div>
    </Box>
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
