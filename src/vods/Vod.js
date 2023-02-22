import { useEffect, useState, useRef } from "react";
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
  const [hypeVod, setHypeVod] = useState(undefined);
  const [graph, setGraph] = useState("messages");
  const [clips, setClips] = useState(undefined);
  const [userChatDelay, setUserChatDelay] = useState(0);
  const [player, setPlayer] = useState(undefined);
  const [playerApi, setPlayerApi] = useState({
    fullscreen: false,
    paused: true,
  });
  const [clipStart, setClipStart] = useState("00:00:00");
  const [clipEnd, setClipEnd] = useState("00:00:00");
  const [interval, setInterval] = useState(30);
  const [messageThreshold, setMessageThreshold] = useState(undefined);
  const [searchThreshold, setSearchThreshold] = useState(1);
  const [volumeThreshold, setVolumeThreshold] = useState(0);
  const [searchTerm, setSearchTerm] = useState(undefined);
  const emotes = useRef({
    BTTV: [],
    FFZ: [],
    "7TV": [],
  });

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
    <Box sx={{ height: "100%", width: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", height: "50%", width: "100%" }}>
        <Box sx={{ display: "flex", height: "100%", width: "100%", flexDirection: "column", alignItems: "flex-start", minWidth: 0, overflow: "hidden", position: "relative" }}>
          <Player vod={vod} player={player} setPlayer={setPlayer} playerApi={playerApi} setPlayerApi={setPlayerApi} />
        </Box>
        <Chat emotes={emotes} vodId={vodId} player={player} userChatDelay={userChatDelay} twitchId={vod.creator.id} playerApi={playerApi} />
      </Box>
      <Box sx={{ minHeight: 0 }}>
        <Settings
          userChatDelay={userChatDelay}
          setUserChatDelay={setUserChatDelay}
          player={player}
          vodId={vodId}
          interval={interval}
          setInterval={setInterval}
          messageThreshold={messageThreshold}
          setMessageThreshold={setMessageThreshold}
          searchThreshold={searchThreshold}
          setSearchThreshold={setSearchThreshold}
          volumeThreshold={volumeThreshold}
          setVolumeThreshold={setVolumeThreshold}
          hypeVod={hypeVod}
          graph={graph}
          setGraph={setGraph}
          clips={clips}
          clipStart={clipStart}
          setClipStart={setClipStart}
          clipEnd={clipEnd}
          setClipEnd={setClipEnd}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          playerApi={playerApi}
        />
        <Graph
          emotes={emotes}
          vodId={vodId}
          hypeVod={hypeVod}
          setHypeVod={setHypeVod}
          graph={graph}
          player={player}
          interval={interval}
          messageThreshold={messageThreshold}
          setMessageThreshold={setMessageThreshold}
          searchThreshold={searchThreshold}
          volumeThreshold={volumeThreshold}
          clips={clips}
          setClips={setClips}
          setClipStart={setClipStart}
          setClipEnd={setClipEnd}
          searchTerm={searchTerm}
        />
      </Box>
    </Box>
  );
}
