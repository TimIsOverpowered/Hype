import React from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import PatreonLogo from "../assets/patreon_square.png";
import client from "../client";

export default function Connections(props) {
  const { user } = props;
  const { patreon } = user;

  const patreonConnect = async () => {
    const { accessToken } = await client.get("authentication");
    window.open(`https://api.hype.lol/oauth/patreon?feathers_token=${accessToken}`, "_blank");
  };

  const patreonDisconnect = async () => {
    const { accessToken } = await client.get("authentication");
    await fetch("https://api.hype.lol/v1/user/patreon", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((data) => {
        if (data.error || data.code > 400 || data.status > 400) {
          console.error(data);
        }
      })
      .catch((e) => {
        console.error(e);
      });
  };

  return (
    <Box sx={{ mt: 2, maxWidth: "48rem", pb: 1.5 }}>
      <div>
        <Typography variant="h5" fontWeight={500}>
          Connections
        </Typography>
        <Typography variant="caption" color="#868686">
          Manage your connected accounts and services
        </Typography>
        <Paper elevation={1} sx={{ mt: 2, mb: 4, border: "1px solid hsla(0,0%,100%,.1)" }}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "row" }}>
              <ConnectionImg src={PatreonLogo} />
              <Box sx={{ display: "flex", width: "100%", flexGrow: 1, pl: 2, pr: 2, flexDirection: "column" }}>
                <Box sx={{ display: "flex", alignItems: "center", flexDirection: "row" }}>
                  <ConnectionTitle>Patreon</ConnectionTitle>
                  {patreon ? (
                    <Button onClick={patreonDisconnect} variant="contained" size="small">
                      Disconnect
                    </Button>
                  ) : (
                    <Button onClick={patreonConnect} variant="contained" size="small">
                      Connect
                    </Button>
                  )}
                </Box>
                <ConnectionData>
                  When you choose to connect your Patreon account, the profile information connected to your Patreon account, including your name, may be used by Hype. You will be able to use patreon
                  specific perks depeding on which tier you pledged. Hype will not publicly display your Patreon account information.
                </ConnectionData>
              </Box>
            </Box>
          </Box>
        </Paper>
      </div>
    </Box>
  );
}

const ConnectionImg = (props) => (
  <Box sx={{ flexShrink: 0, pt: 0.5, pr: 1 }}>
    <Box sx={{ overflow: "hidden", borderRadius: "4px" }}>
      <img alt="" width="80px" height="80px" {...props}></img>
    </Box>
  </Box>
);

const ConnectionTitle = (props) => (
  <Box sx={{ display: "flex", flexGrow: 1, flexDirection: "column" }}>
    <Typography variant="h6" fontWeight={500} {...props} />
  </Box>
);

const ConnectionData = (props) => (
  <Box sx={{ color: "#868686", mt: 1, lineHeight: 1 }}>
    <Typography variant="caption" {...props} />
  </Box>
);
