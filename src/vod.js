import React, { useEffect } from "react";
import { makeStyles, CircularProgress, Typography } from "@material-ui/core";
import Logo from "./assets/logo.svg";
import Player from "./player";
import client from "./client";
import { ZSTDDecoder } from "zstddec";

export default function Vod(props) {
  const classes = useStyles();
  const [logs, setLogs] = React.useState(undefined);
  const channel = props.match.params.channel;
  const vodId = props.match.params.vodId;

  useEffect(() => {
    document.title = `${channel} - ${vodId}`;
    if(!props.user) return;
    const fetchLogs = async () => {
      const { accessToken } = await client.get("authentication");
      await fetch(`https://api.hype.lol/v1/vods/${vodId}/logs`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then(async (response) => {
          return {
            status: response.status,
            arrayBuffer: await response.arrayBuffer(),
          };
        })
        .then(async (data) => {
          if (data.status >= 400) return setLogs(null);
          const UInt8ArrayBuffer = new Uint8Array(data.arrayBuffer);
          const decoder = new ZSTDDecoder();
          await decoder.init();
          const decompressedData = await decoder.decode(UInt8ArrayBuffer);
          const decompressedString = new TextDecoder("utf-8").decode(
            decompressedData
          );
          setLogs(decompressedString.split("\n"));
        })
        .catch((e) => {
          console.error(e);
        });
    };
    fetchLogs();
    return;
  }, [vodId, channel, props.user]);

  if (props.user === undefined || logs === undefined)
    return (
      <div className={classes.parent}>
        <div style={{ textAlign: "center" }}>
          <div>
            <img alt="" src={Logo} height="auto" width="15%" />
          </div>
          <CircularProgress style={{ marginTop: "2rem" }} size="3%" />
        </div>
      </div>
    );

  if (logs === null)
    return (
      <div className={classes.parent}>
        <div style={{ textAlign: "center" }}>
          <div>
            <img alt="" src={Logo} height="auto" width="15%" />
          </div>
          <Typography variant="h6" style={{ marginTop: "2rem" }}>
            This Vod has no Logs.
          </Typography>
        </div>
      </div>
    );

  return (
    <div className={classes.root}>
      <Player vodId={vodId} />
    </div>
  );
}

const useStyles = makeStyles(() => ({
  parent: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  root: {
    display: "flex",
    height: "100%",
    width: "100%",
    overflow: "hidden",
  },
}));
