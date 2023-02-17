import React, { useEffect, useState } from "react";
import { Box, Typography, Grid } from "@mui/material";
import SimpleBar from "simplebar-react";
import { LogoLoading } from "./utils/Loading";
import Twitch from "./twitch/gql";
import CustomLink from "./utils/CustomLink";

export default function Whitelist() {
  const [whitelist, setWhitelist] = useState(null);
  const [twitchWhitelist, setTwitchWhitelist] = useState(null);

  useEffect(() => {
    const fetchWhitelist = async () => {
      await fetch("https://api.hype.lol/v1/whitelist", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((response) => response.json())
        .then((data) => {
          const sortedArray = data.sort((a, b) => {
            return a.channel.toLowerCase().localeCompare(b.channel.toLowerCase());
          });
          setWhitelist(sortedArray);
        })
        .catch((e) => {
          console.error(e);
        });
    };
    fetchWhitelist();
    return;
  }, []);

  useEffect(() => {
    if (!whitelist) return;
    const getTwitchInfo = async () => {
      const logins = JSON.stringify(Array.from(whitelist, (user) => user.channel));
      const twitchUsers = await Twitch.getUsers(logins);
      setTwitchWhitelist(twitchUsers);
    };
    getTwitchInfo();
    return;
  }, [whitelist]);

  if (!twitchWhitelist) return <LogoLoading />;

  return (
    <SimpleBar style={{ minHeight: 0, height: "100%" }}>
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          <Typography variant="h4">There are currently {twitchWhitelist.length} whitelisted channels!</Typography>
          <Grid container spacing={3} sx={{ mt: 5, justifyContent: "center" }}>
            {twitchWhitelist.map((user, i) => (
              <StyledProfile key={i} user={user} />
            ))}
          </Grid>
        </Box>
      </Box>
    </SimpleBar>
  );
}

const StyledProfile = (props) => {
  const { user } = props;
  if (!user) return null;

  return (
    <Grid item xs={2} sx={{ maxWidth: "18rem", flexBasis: "18rem", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Box sx={{ maxWidth: "12rem", textAlign: "center" }}>
        <CustomLink href={`/${user.login}`}>
          <img alt="" src={user.profileImageURL} />
          <Typography mt={1} variant="h6">
            {user.displayName}
          </Typography>
        </CustomLink>
      </Box>
    </Grid>
  );
};
