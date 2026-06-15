import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Box, Button, Paper, Typography } from "@mui/material";
import PatreonLogo from "../assets/patreon_square.png";
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

export default function Connections() {
  const queryClient = useQueryClient();
  const { data: user } = useUser();

  const patreonConnect = () => {
    const token = getToken();
    window.open(`https://api.hype.lol/oauth/patreon?token=${token}&client=desktop`, "_blank");
  };

  const disconnectMutation = useMutation({
    mutationFn: () => {
      const accessToken = getToken();
      return fetch("https://api.hype.lol/v1/user/patreon", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (err) => {
      console.error(err);
    },
  });

  if (!user) return <></>;

  const { patreon } = user;

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
                    <Button onClick={() => disconnectMutation.mutate()} variant="contained" size="small" disabled={disconnectMutation.isPending}>
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
