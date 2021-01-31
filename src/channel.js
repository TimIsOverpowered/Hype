import React, { useEffect } from "react";
import {
  makeStyles,
  Typography,
  Link,
  CircularProgress,
  Container,
} from "@material-ui/core";
import moment from "moment";
import Logo from "./assets/logo.svg";
import SimpleBar from "simplebar-react";
import client from "./client";

export default function Channel(props) {
  const classes = useStyles();
  const [loading, setLoading] = React.useState(true);
  const [channelWhitelist, setChannelWhitelist] = React.useState(true);
  const [vods, setVods] = React.useState(undefined);
  const channel = props.match.params.channel;

  useEffect(() => {
    if(!props.user) return;
    document.title = `${channel}'s Vods - Hype`;
    const checkWhitelist = async () => {
      const { accessToken } = await client.get("authentication");
      await fetch(`https://api.hype.lol/v1/${channel}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.error || data.code > 400 || data.status > 400) {
            return console.error(data.errorMsg);
          }
          setChannelWhitelist(data.whitelist);
          setLoading(false);
        })
        .catch((e) => {
          console.error(e);
        });
    };
    checkWhitelist();

    const fetchVods = async () => {
      const { accessToken } = await client.get("authentication");
      let vods;
      await fetch(`https://api.hype.lol/v1/${channel}/vods`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.error || data.code > 400 || data.status > 400) {
            return console.error(data.errorMsg);
          }
          vods = data;
        })
        .catch((e) => {
          console.error(e);
        });

      if (vods) {
        if (vods.length === 0) {
          setVods(null);
          setLoading(false);
        }
        for (let vod of vods) {
          if (vod.thumbnail_url) {
            const extension = vod.thumbnail_url.substring(
              vod.thumbnail_url.lastIndexOf("."),
              vod.thumbnail_url.length
            );

            vod.thumbnail_url =
              vod.thumbnail_url.substring(
                0,
                vod.thumbnail_url.indexOf("%{width}")
              ) +
              "640x360" +
              extension;
          } else {
            vod.thumbnail_url = `https://vod-secure.twitch.tv/_404/404_processing_640x360.png`;
          }
        }
        setVods(
          vods.map((vod, i) => {
            return (
              <div key={i} className={classes.paper}>
                <div className={classes.lower}>
                  <div style={{ display: "flex", flexWrap: "nowrap" }}>
                    <div
                      style={{
                        flexGrow: 1,
                        flexShrink: 1,
                        width: "100%",
                        order: 2,
                        minWidth: 0,
                      }}
                    >
                      <div style={{ marginBottom: "0.1rem" }}>
                        <Link
                          className={classes.title}
                          href={`#/${channel}/${vod.id}`}
                          variant="caption"
                        >
                          {vod.title}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={classes.imageBox}>
                  <Link href={`#/${channel}/${vod.id}`}>
                    <img
                      alt={vod.title}
                      title={new Date().toDateString().slice(4)}
                      src={vod.thumbnail_url}
                      className={classes.image}
                    />
                  </Link>
                  <div className={classes.corners}>
                    <div className={classes.topLeft}>
                      <Typography
                        variant="caption"
                        className={classes.cornerText}
                      >
                        {vod.duration}
                      </Typography>
                    </div>
                    <div className={classes.bottomLeft}>
                      <Typography
                        variant="caption"
                        className={classes.cornerText}
                      >
                        {`${vod.view_count} views`}
                      </Typography>
                    </div>
                    <div className={classes.bottomRight}>
                      <Typography
                        variant="caption"
                        className={classes.cornerText}
                      >
                        {moment.utc(vod.created_at).fromNow()}
                      </Typography>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        );
        setLoading(false);
      }
    };

    if (channelWhitelist) {
      setLoading(true);
      fetchVods();
    }

    return;
  }, [channel, channelWhitelist, classes, props.user]);

  if (props.user === undefined)
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

  if (loading)
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

  if (!channelWhitelist)
    return (
      <div className={classes.parent}>
        <div style={{ textAlign: "center" }}>
          <div>
            <img alt="" src={Logo} height="auto" width="15%" />
          </div>
          <Typography variant="h6" style={{ marginTop: "2rem" }}>
            {channel} is not whitelisted for this service
          </Typography>
        </div>
      </div>
    );

  if (vods === null)
    return (
      <div className={classes.parent}>
        <div style={{ textAlign: "center" }}>
          <div>
            <img alt="" src={Logo} height="auto" width="15%" />
          </div>
          <Typography variant="h4" style={{ marginTop: "2rem" }}>
            {channel} has no vods..
          </Typography>
        </div>
      </div>
    );

  return (
    <Container maxWidth={false} disableGutters style={{ height: "100%" }}>
      <SimpleBar className={classes.scroll}>
        <Typography className={classes.header} variant="h4">
          {`${channel}'s vods`}
        </Typography>
        <div className={classes.root}>{vods}</div>
      </SimpleBar>
    </Container>
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
    marginLeft: "2rem",
    marginTop: "2rem",
    display: "flex",
    flexWrap: "wrap",
    height: "100%",
  },
  header: {
    textAlign: "center",
    marginTop: "2rem",
    color: "#fff",
  },
  paper: {
    maxWidth: "30%",
    width: "18rem",
    flex: "0 0 auto",
    padding: "0 .5rem",
    display: "flex",
    flexDirection: "column",
  },
  lower: {
    order: 2,
    marginTop: "1rem",
    marginBottom: "2rem",
  },
  title: {
    color: "#a6a6a6",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
  },
  imageBox: {
    overflow: "hidden",
    height: 0,
    paddingTop: "56.25%",
    position: "relative",
    order: 1,
  },
  image: {
    verticalAlign: "top",
    maxWidth: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  scroll: {
    height: "calc(100% - 4rem)",
    position: "relative",
  },
  corners: {
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  bottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  topLeft: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  cornerText: {
    color: "#fff",
    backgroundColor: "rgba(0,0,0,.6)",
    padding: "0 .2rem",
  },
}));
