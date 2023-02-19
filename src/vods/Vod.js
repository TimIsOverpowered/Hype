import { useEffect, useState, useRef } from "react";
import { Box, Typography } from "@mui/material";
import { LogoLoading } from "../utils/Loading";
import { useParams } from "react-router-dom";
import Player from "./Player";
import Chat from "./Chat";
import CustomWidthTooltip from "../utils/CustomWidthToolTip";
import NotAuth from "../utils/NotAuth";
import Twitch from "../twitch/gql";
import NotFound from "../utils/NotFound";

export default function Vod(props) {
  const { user } = props;
  const { vodId } = useParams();
  const [vod, setVod] = useState(undefined);
  const [currentTime, setCurrentTime] = useState(undefined);
  const [playing, setPlaying] = useState({ playing: false });
  const [userChatDelay, setUserChatDelay] = useState(0);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!user || !vodId) return;

    const fetchVod = async () => {
      setVod(await Twitch.getVod(vodId));
    };
    fetchVod();
    return;
  }, [vodId, user]);

  useEffect(() => {
    console.info(`Chat Delay: ${userChatDelay} seconds`);
  }, [userChatDelay]);

  if (!user) return <NotAuth />;
  if (vod === undefined) return <LogoLoading />;
  if (vod === null) return <NotFound />;

  return (
    <Box sx={{ height: "100%", width: "100%" }}>
      <Box sx={{ display: "flex", flexDirection: "row", height: "100%", width: "100%" }}>
        <Box sx={{ display: "flex", height: "100%", width: "100%", flexDirection: "column", alignItems: "flex-start", minWidth: 0, overflow: "hidden", position: "relative" }}>
          <Player playerRef={playerRef} setCurrentTime={setCurrentTime} setPlaying={setPlaying} vod={vod} />
          <Box sx={{ minHeight: "auto !important", width: "100%" }}>
            <Box sx={{ display: "flex", p: 1, alignItems: "center" }}>
              <img style={{ borderRadius: "50%" }} alt="" src={vod.creator.profileImageURL} />
              <Box sx={{ pl: 1 }}>
                <Typography variant="h6">{`${vod.creator.displayName}`}</Typography>
                <CustomWidthTooltip title={vod.title}>
                  <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Typography variant="body1">{`${vod.title}`}</Typography>
                  </Box>
                </CustomWidthTooltip>
              </Box>
            </Box>
          </Box>
        </Box>
        <Chat vodId={vodId} playerRef={playerRef} playing={playing} currentTime={currentTime} userChatDelay={userChatDelay} />
      </Box>
    </Box>
  );
}
