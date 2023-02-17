import React from "react";
import { useParams, useNavigate, redirect } from "react-router-dom";
import { Box, Tabs, Tab, Button, Typography } from "@mui/material";
import Profile from "./settings/profile";
import Connections from "./settings/connections";
import Patreon from "./settings/patreon";
import SimpleBar from "simplebar-react";

export default function Settings(props) {
  const navigate = useNavigate();
  const { user } = props;
  const { subPath } = useParams();

  if (user === null) return redirect("/");

  return (
    <SimpleBar style={{ minHeight: 0, height: "100%" }}>
      <Box sx={{ m: 5 }}>
        <Typography variant="h4" fontWeight={600}>
          Settings
        </Typography>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={subPath}>
            <Tab label="Profile" value="profile" component={Button} onClick={() => navigate("/settings/profile", { replace: true })} />
            <Tab label="Connections" value="connections" component={Button} onClick={() => navigate("/settings/connections", { replace: true })} />
            {user.patreon && <Tab label="Patreon" value="patreon" component={Button} onClick={() => navigate("/settings/patreon", { replace: true })} />}
          </Tabs>
        </Box>
        {subPath === "profile" && <Profile user={user} />}
        {subPath === "connections" && <Connections user={user} />}
        {subPath === "patreon" && user.patreon && <Patreon user={user} />}
      </Box>
    </SimpleBar>
  );
}
