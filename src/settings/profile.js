import { Box, Divider, Paper, Typography } from "@mui/material";
import Whitelist from "./whitelist.js";

export default function Profile(props) {
  const { user } = props;

  const status = (user.patreon && user.patreon.tier >= 1 && user.patreon.isPatron) || user.whitelist || user.admin;

  return (
    <Box sx={{ mt: 2, maxWidth: "48rem", pb: 1.5 }}>
      <div>
        <Typography variant="h5" fontWeight={500}>
          Profile Info
        </Typography>
        <Paper elevation={1} sx={{ mt: 2, mb: 4, border: "1px solid hsla(0,0%,100%,.1)" }}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "nowrap", alignItems: "center" }}>
              <Info>Username</Info>
              <Data>{user.display_name}</Data>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", flexWrap: "nowrap", mb: 1, alignItems: "center" }}>
              <Info>Status</Info>
              <Data>{status ? "VIP" : "Free"}</Data>
            </Box>
            <Divider sx={{ mb: 2 }} />
          </Box>
        </Paper>
      </div>

      <Whitelist user={user} status={status} />
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
