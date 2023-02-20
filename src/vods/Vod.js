import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { LogoLoading } from "../utils/Loading";
import { useParams } from "react-router-dom";
import Player from "./Player";
import Chat from "./Chat";
import NotAuth from "../utils/NotAuth";
import Twitch from "../twitch/gql";
import NotFound from "../utils/NotFound";
import Settings from "./Settings";
import Graph from "./Graph";

export default function Vod(props) {
  const { user } = props;
  const { vodId } = useParams();
  const [vod, setVod] = useState(undefined);
  const [userChatDelay, setUserChatDelay] = useState(0);
  const [player, setPlayer] = useState(null);
  const [playing, setPlaying] = useState(false);

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
    <Box sx={{ height: "100%", width: "100%", minHeight: 0 }}>
      <Box sx={{ display: "flex", height: "60%", width: "100%" }}>
        <Box sx={{ display: "flex", height: "100%", width: "100%", flexDirection: "column", alignItems: "flex-start", minWidth: 0, overflow: "hidden", position: "relative" }}>
          <Player player={player} vod={vod} setPlayer={setPlayer} setPlaying={setPlaying} />
        </Box>
        <Chat vodId={vodId} player={player} userChatDelay={userChatDelay} twitchId={vod.creator.id} playing={playing} />
      </Box>
      <Box sx={{ height: "100%", minHeight: 0 }}>
        <Settings userChatDelay={userChatDelay} setUserChatDelay={setUserChatDelay} player={player} vodId={vodId} />
        <Graph />
      </Box>
    </Box>
  );
}
