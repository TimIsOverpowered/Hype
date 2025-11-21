import React, { useEffect, useState } from "react";
import { Box, Typography, Grid, Button } from "@mui/material";
import SimpleBar from "simplebar-react";
import { LogoLoading } from "./utils/Loading.js";
import Twitch from "./twitch/gql.js";
import CustomLink from "./utils/CustomLink.js";
import { useParams } from "react-router-dom";
import NotAuth from "./utils/NotAuth.js";
import { toHHMMSS } from "./utils/helpers.mjs";
import CustomWidthTooltip from "./utils/CustomWidthToolTip.js";

export default function Channel(props) {
  const { user } = props;
  const { channel } = useParams();
  const [twitchUser, setTwitchUser] = useState(null);
  const [vodsRes, setVodsRes] = useState(null);
  const [vods, setVods] = useState(null);

  useEffect(() => {
    if (!channel || !user) return;
    const getTwitchInfo = async () => {
      const twitchInfo = await Twitch.getVods(channel);
      if (!twitchInfo) return;
      setTwitchUser(twitchInfo.user);
      setVodsRes(twitchInfo.videos);
      setVods(twitchInfo.videos.edges);
    };
    getTwitchInfo();
    return;
  }, [channel, user]);

  if (!user) return <NotAuth />;
  if (!vods) return <LogoLoading />;

  const fetchNextVods = async () => {
    if (!vodsRes.pageInfo.hasNextPage) return;
    const nextVods = await Twitch.getNextVods(channel, vods[vods.length - 1].cursor);
    if (!nextVods) return;
    setVodsRes(nextVods);
    setVods(vods.concat(nextVods.edges));
  };

  return (
    <SimpleBar style={{ minHeight: 0, height: "100%" }}>
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <img height="100" width="100" alt="" src={twitchUser.profileImageURL} />
          <Typography variant="h6">{twitchUser.displayName}'s vods</Typography>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            {vods.map((vod, i) => (
              <StyledVods key={i} vod={vod} />
            ))}
          </Grid>
          <Button sx={{ mt: 2 }} disabled={!vodsRes.pageInfo.hasNextPage} variant="contained" onClick={fetchNextVods}>
            Load More
          </Button>
        </Box>
      </Box>
    </SimpleBar>
  );
}

const StyledVods = (props) => {
  const { vod } = props;
  if (!vod) return null;
  if (vod.node.broadcastType !== "ARCHIVE") return null;

  const VOD_LINK = `/vods/${vod.node.id}`;

  return (
    <Grid item xs={2.4} sx={{ maxWidth: "18rem", flexBasis: "18rem" }}>
      <Box
        sx={{
          overflow: "hidden",
          height: 0,
          paddingTop: "56.25%",
          position: "relative",
        }}
      >
        <CustomLink href={VOD_LINK}>
          <img className="thumbnail" alt="" src={vod.node.previewThumbnailURL} />
        </CustomLink>
        <Box sx={{ pointerEvents: "none", position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
          <Box sx={{ position: "absolute", bottom: 0, left: 0 }}>
            <Typography variant="caption" sx={{ p: 0.3, backgroundColor: "rgba(0,0,0,.6)" }}>
              {`${new Date(vod.node.createdAt).toLocaleDateString()}`}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ pointerEvents: "none", position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
          <Box sx={{ position: "absolute", bottom: 0, right: 0 }}>
            <Typography variant="caption" sx={{ p: 0.3, backgroundColor: "rgba(0,0,0,.6)" }}>
              {`${toHHMMSS(vod.node.lengthSeconds)}`}
            </Typography>
          </Box>
        </Box>
      </Box>
      <Box sx={{ mt: 1, mb: 1, display: "flex" }}>
        <Box sx={{ minWidth: 0, width: "100%" }}>
          <CustomWidthTooltip title={vod.node.title} placement="top">
            <span>
              <CustomLink href={VOD_LINK} sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                <Typography variant="caption" color="primary" sx={{ fontWeight: "550" }}>
                  {vod.node.title}
                </Typography>
              </CustomLink>
            </span>
          </CustomWidthTooltip>
        </Box>
      </Box>
    </Grid>
  );
};
