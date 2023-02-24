import { Alert, AlertTitle, Box } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import client from "../client";
import { BasicLoading } from "../utils/Loading";
import { ZSTDDecoder } from "zstddec";
import Twitch from "../twitch/gql";
import { sleep, toHHMMSS, toSeconds } from "../utils/helpers";
import { LineChart, XAxis, YAxis, CartesianGrid, Line, Tooltip, ResponsiveContainer, Brush } from "recharts";
import CustomTooltip from "./graph/Tooltip";
import simplify from "simplify-js";

export default function Graph(props) {
  const {
    vodId,
    hypeVod,
    setHypeVod,
    graph,
    player,
    interval,
    messageThreshold,
    searchThreshold,
    volumeThreshold,
    setMessageThreshold,
    clips,
    setClips,
    emotes,
    searchTerm,
    isWhitelisted,
    logs,
    setLogs,
  } = props;
  const [chapters, setChapters] = useState(undefined);
  const [messageGraphData, setMessageGraphData] = useState(undefined);
  const [searchGraphData, setSearchGraphData] = useState(undefined);
  const [volumeGraphData, setVolumeGraphData] = useState(undefined);
  const [clipsGraphData, setClipsGraphData] = useState(undefined);

  useEffect(() => {
    if (!vodId || !isWhitelisted) return;

    const fetchVod = async () => {
      const { accessToken } = await client.get("authentication");
      const data = await fetch(`https://api.hype.lol/vods/${vodId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((response) => response.json())
        .then((response) => {
          if (response.code >= 400) return null;
          return response;
        })
        .catch((e) => {
          console.error(e);
          return null;
        });
      setHypeVod(data);
    };
    fetchVod();

    const fetchLogs = async () => {
      const { accessToken } = await client.get("authentication");
      const data = await fetch(`https://api.hype.lol/v1/vods/${vodId}/logs`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then(async (response) => {
          return {
            code: response.status,
            arrayBuffer: await response.arrayBuffer(),
          };
        })
        .then(async (response) => {
          if (response.code >= 400) return null;
          const UInt8ArrayBuffer = new Uint8Array(response.arrayBuffer);
          const decoder = new ZSTDDecoder();
          await decoder.init();
          const decompressedData = await decoder.decode(UInt8ArrayBuffer);
          const decompressedString = new TextDecoder("utf-8").decode(decompressedData);
          return decompressedString.split("\n");
        })
        .catch((e) => {
          console.error(e);
          return null;
        });
      setLogs(data);
    };
    fetchLogs();

    const fetchChapters = async () => {
      setChapters(await Twitch.getChapters(vodId));
    };
    fetchChapters();

    const fetchClips = async () => {
      const { accessToken } = await client.get("authentication");
      const data = await fetch(`https://api.hype.lol/v1/vods/${vodId}/clips`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((response) => response.json())
        .then((response) => {
          if (response.error) return null;
          return response;
        })
        .catch((e) => {
          console.error(e);
          return null;
        });
      setClips(data);
    };
    fetchClips();
  }, [vodId, setHypeVod, setClips, setLogs, isWhitelisted]);

  useEffect(() => {
    if (!logs || !player) return;
    const getThreshold = async () => {
      while (isNaN(player.duration)) {
        await sleep(50);
      }
      const duration = player.duration;
      setMessageThreshold(Math.round(logs.length / duration) * 25);
    };
    getThreshold();
  }, [logs, player, setMessageThreshold]);

  useMemo(() => {
    if (isNaN(messageThreshold) || !logs || !chapters || !emotes.current || !player) return;
    setMessageGraphData(null);

    const getMessageGraphData = async () => {
      const data = [];
      while (isNaN(player.duration)) {
        await sleep(50);
      }
      const duration = player.duration;
      const logsCopy = logs.slice(0);
      for (let seconds = interval.valueOf(); seconds < duration; seconds += interval) {
        let json = { emotes: {} };
        let messages = 0,
          subs = 0;
        const game = chapters.find((chapter) => chapter.node.positionMilliseconds <= seconds);
        if (game) json.game = game.node.details.game.displayName;

        for (let log of logsCopy) {
          const timestampAsSeconds = toSeconds(log.substring(1, 9));
          if (timestampAsSeconds > seconds) break;
          messages++;

          const username = log.substring(log.indexOf("] ") + 2, log.indexOf(": "));
          if (username === "twitchnotify") {
            subs++;
          }

          const messageArray = log
            .substring(log.indexOf(": ") + 2, log.length)
            .trim()
            .split(" ");

          for (let message of messageArray) {
            if (emotes.current) {
              const SEVENTV_EMOTES = emotes.current["7TV"];
              const BTTV_EMOTES = emotes.current["BTTV"];
              const FFZ_EMOTES = emotes.current["FFZ"];

              if (SEVENTV_EMOTES) {
                const emote = SEVENTV_EMOTES.find((SEVENTV_EMOTE) => SEVENTV_EMOTE.name === message);
                if (emote) {
                  json.emotes[message] = json.emotes[message] + 1 || 1;
                  continue;
                }
              }

              if (FFZ_EMOTES) {
                const emote = FFZ_EMOTES.find((FFZ_EMOTE) => FFZ_EMOTE.name === message);
                if (emote) {
                  json.emotes[message] = json.emotes[message] + 1 || 1;
                  continue;
                }
              }

              if (BTTV_EMOTES) {
                const emote = BTTV_EMOTES.find((BTTV_EMOTE) => BTTV_EMOTE.code === message);
                if (emote) {
                  json.emotes[message] = json.emotes[message] + 1 || 1;
                  continue;
                }
              }
            }
          }
        }
        logsCopy.splice(0, messages);

        if (messages >= messageThreshold) {
          json.x = seconds;
          json.y = messages;
          if (subs > 0) {
            json.subs = subs;
          }

          let sortable = [];

          for (let emoteKey of Object.keys(json.emotes)) {
            sortable.push([emoteKey, json.emotes[emoteKey]]);
          }

          delete json["emotes"];

          sortable.sort(function (a, b) {
            return b[1] - a[1];
          });

          if (sortable.length > 5) {
            sortable = sortable.slice(0, 5);
          }

          sortable.forEach((emote) => {
            json[emote[0]] = emote[1];
          });

          data.push(json);
        }
        await sleep(1);
      }
      const simplifiedData = simplify(data, 5).map((item) => {
        item.duration = toHHMMSS(item.x);
        item.messages = item.y;
        delete item.x;
        delete item.y;
        return item;
      });
      setMessageGraphData(simplifiedData);
    };
    getMessageGraphData();
  }, [messageThreshold, emotes, chapters, interval, logs, player]);

  useMemo(() => {
    if (isNaN(volumeThreshold) || !hypeVod || !hypeVod?.volume_data) return;

    const getVolumeData = () => {
      let data = [];
      for (let volume_data of hypeVod.volume_data) {
        let volume = Math.abs(volume_data.volume);
        if (volume > volumeThreshold) {
          data.push({
            x: volume_data.duration,
            y: volume,
          });
        }
      }
      const simplifiedData = simplify(data, 10).map((item) => {
        return {
          duration: toHHMMSS(item.x),
          volume: item.y,
        };
      });
      setVolumeGraphData(simplifiedData);
    };
    getVolumeData();
  }, [volumeThreshold, hypeVod]);

  useMemo(() => {
    if (!chapters || !clips) return;

    const getClipsData = () => {
      let data = [];

      for (let clip of clips) {
        let json = {
          x: clip.vod_offset,
          y: clip.views,
          title: clip.title,
          slug: clip.slug,
          clipDuration: clip.duration,
        };
        const game = chapters.find((chapter) => chapter.node.positionMilliseconds <= clip.vod_offset);
        if (game) json.game = game.node.details.game.displayName;
        data.push(json);
      }
      const simplifiedData = simplify(data, 10).map((item) => {
        item.duration = toHHMMSS(item.x);
        item.views = item.y;
        delete item.x;
        delete item.y;
        return item;
      });
      setClipsGraphData(simplifiedData);
    };
    getClipsData();
  }, [chapters, clips]);

  useMemo(() => {
    if (isNaN(searchThreshold) || searchThreshold <= 0 || !searchTerm || searchTerm.length === 0 || !logs || !chapters || !emotes.current || !player) return;
    setSearchGraphData(null);

    const getSearchGraphData = async () => {
      const data = [];
      while (!player.duration) {
        await sleep(50);
      }
      const duration = player.duration;
      const logsCopy = logs.slice(0);
      for (let seconds = interval.valueOf(); seconds < duration; seconds += interval) {
        let json = { emotes: {} };
        let searchMessages = 0,
          messages = 0,
          subs = 0;
        const game = chapters.find((chapter) => chapter.node.positionMilliseconds <= seconds);
        if (game) json.game = game.node.details.game.displayName;

        for (let log of logsCopy) {
          const timestampAsSeconds = toSeconds(log.substring(1, 9));
          if (timestampAsSeconds > seconds) break;
          messages++;

          const username = log.substring(log.indexOf("] ") + 2, log.indexOf(": "));
          if (username === "twitchnotify") {
            subs++;
          }

          const messageArray = log
            .substring(log.indexOf(": ") + 2, log.length)
            .trim()
            .split(" ");

          for (let message of messageArray) {
            if (message.toLowerCase() === searchTerm.toLowerCase()) {
              searchMessages++;
            }

            if (emotes.current) {
              const SEVENTV_EMOTES = emotes.current["7TV"];
              const BTTV_EMOTES = emotes.current["BTTV"];
              const FFZ_EMOTES = emotes.current["FFZ"];

              if (SEVENTV_EMOTES) {
                const emote = SEVENTV_EMOTES.find((SEVENTV_EMOTE) => SEVENTV_EMOTE.name === message);
                if (emote) {
                  json.emotes[message] = json.emotes[message] + 1 || 1;
                  continue;
                }
              }

              if (FFZ_EMOTES) {
                const emote = FFZ_EMOTES.find((FFZ_EMOTE) => FFZ_EMOTE.name === message);
                if (emote) {
                  json.emotes[message] = json.emotes[message] + 1 || 1;
                  continue;
                }
              }

              if (BTTV_EMOTES) {
                const emote = BTTV_EMOTES.find((BTTV_EMOTE) => BTTV_EMOTE.code === message);
                if (emote) {
                  json.emotes[message] = json.emotes[message] + 1 || 1;
                  continue;
                }
              }
            }
          }
        }
        logsCopy.splice(0, messages);

        if (searchMessages >= searchThreshold) {
          json.x = seconds;
          json.y = searchMessages;
          json.messages = messages;
          if (subs > 0) {
            json.subs = subs;
          }

          let sortable = [];

          for (let emoteKey of Object.keys(json.emotes)) {
            sortable.push([emoteKey, json.emotes[emoteKey]]);
          }

          delete json["emotes"];

          sortable.sort(function (a, b) {
            return b[1] - a[1];
          });

          if (sortable.length > 5) {
            sortable = sortable.slice(0, 5);
          }

          sortable.forEach((emote) => {
            json[emote[0]] = emote[1];
          });

          data.push(json);
        }
        await sleep(1);
      }
      const simplifiedData = simplify(data, 1).map((item) => {
        item.duration = toHHMMSS(item.x);
        item[searchTerm] = item.y;
        delete item.x;
        delete item.y;
        return item;
      });
      setSearchGraphData(simplifiedData);
    };
    getSearchGraphData();
  }, [searchTerm, searchThreshold, emotes, chapters, logs, player, interval]);

  const handleChartClick = (e) => {
    if (!e) return;
    const labelAsSeconds = toSeconds(e.activeLabel);
    const activePayload = e.activePayload[0].payload;
    const duration = graph === "clips" ? labelAsSeconds - 5 : labelAsSeconds - interval;
    props.setClipStart(toHHMMSS(duration));
    props.setClipEnd(graph === "clips" ? toHHMMSS(labelAsSeconds + Math.round(activePayload.clipDuration)) : e.activeLabel);
    player.currentTime = duration;
  };

  if (logs === undefined || chapters === undefined || clips === undefined) return <BasicLoading />;

  const graphData = graph === "messages" ? messageGraphData : graph === "search" ? searchGraphData : graph === "clips" ? clipsGraphData : graph === "volume" ? volumeGraphData : null;
  const graphKey = graph === "messages" ? "messages" : graph === "search" ? searchTerm : graph === "clips" ? "views" : graph === "volume" ? "volume" : null;

  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
      {!isWhitelisted && (
        <Alert severity="warning">
          <AlertTitle>User is not whitelisted</AlertTitle>
          Graphs are unavailable..
        </Alert>
      )}

      {isWhitelisted && (
        <Box sx={{ ml: -6, mt: -1, height: "100%", width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
          {!graphData && <BasicLoading />}

          {graphData && (
            <ResponsiveContainer width="100%" height="89%">
              <LineChart data={graphData} onClick={handleChartClick}>
                <XAxis dataKey="duration" />
                <YAxis />
                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                <Brush dataKey="duration" stroke="#8884d8" />
                <Line type="monotone" dataKey={graphKey} stroke="#8884d8" />
                <Tooltip content={<CustomTooltip />} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
      )}
    </Box>
  );
}
