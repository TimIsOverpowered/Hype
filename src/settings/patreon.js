import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Button, Divider, Paper, Typography, Alert } from "@mui/material";
import { getToken } from "../auth.js";

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

export default function Patreon() {
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const [clicked, setClicked] = React.useState(false);
  const [success, setSuccess] = React.useState(null);
  const [errorMsg, setErrorMsg] = React.useState("");

  const verifyMutation = useMutation({
    mutationFn: () => {
      const accessToken = getToken();
      return fetch("https://api.hype.lol/v1/user/verify/patreon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      if (data.error) {
        console.error(data.message);
        setSuccess(false);
        setErrorMsg(data.message);
      } else {
        setSuccess(true);
        setErrorMsg("");
        queryClient.invalidateQueries({ queryKey: ["user"] });
      }
    },
    onError: (e) => {
      console.error(e.message || e);
      setSuccess(false);
      setErrorMsg(e.message || "Server encountered an Error!");
    },
  });

  if (!user) return <></>;

  const { patreon } = user;

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
              <Button onClick={() => { setClicked(true); verifyMutation.mutate(); }} disabled={clicked || verifyMutation.isPending} variant="contained">
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
