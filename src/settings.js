import React from "react";
import { useParams, useNavigate, redirect } from "react-router-dom";
import { Box, Tabs, Tab, Button, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import Profile from "./settings/profile.js";
import Connections from "./settings/connections.js";
import Patreon from "./settings/patreon.js";
import SimpleBar from "simplebar-react";
import { getToken } from "./auth.js";

function useUser() {
  return useQuery({ queryKey: ["user"], queryFn: async () => {
    const token = getToken();
    if (!token) return null;
    const res = await fetch("https://api.hype.lol/v1/user/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  }});
}

export default function Settings() {
  const navigate = useNavigate();
  const { subPath } = useParams();
  const { data: user, isLoading } = useUser();

  if (isLoading) return <></>;
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
        {subPath === "profile" && <Profile />}
        {subPath === "connections" && <Connections />}
        {subPath === "patreon" && user.patreon && <Patreon />}
      </Box>
    </SimpleBar>
  );
}
