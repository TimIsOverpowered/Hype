import React, { useState } from "react";
import { IconButton, makeStyles, Box } from "@material-ui/core";
import { ArrowBackIos } from "@material-ui/icons";
import discord from "./assets/discord.png";
import patreon from "./assets/patreon.png";
import vigor from "./assets/vigor.png";

export default function NavBar(props) {
  const classes = useStyles();
  const [channel, setChannel] = useState("");

  const goBack = () => {
    props.history.goBack();
  };

  const handleChannelInput = (evt) => {
    setChannel(evt.target.value);
  };

  const handleChannelSubmit = (e) => {
    if (e.which === 13 && channel.length > 0) {
      props.history.push(`/${channel}`);
    }
  };

  return (
    <div className={classes.navDisplayFlex}>
      <Box alignItems="stretch" display="flex" flexWrap="nowrap" height="100%">
        <Box
          alignItems="stretch"
          justifyContent="flex-start"
          width="100%"
          display="flex"
          flexShrink={1}
          flexGrow={1}
          flexWrap="nowrap"
        >
          <Box
            display="flex"
            justifyContent="space-between"
            flexDirection="row"
            height="100%"
          >
            <div className={classes.linkButton}>
              <IconButton
                className={classes.button}
                style={{ color: "#2079ff" }}
                onClick={goBack}
              >
                <ArrowBackIos />
              </IconButton>
            </div>
          </Box>
        </Box>
        <Box
          alignItems="center"
          flexGrow={1}
          flexShrink={1}
          width="100%"
          justifyContent="center"
          display="flex"
        >
          <div className={classes.search}>
            <Box position="relative" zIndex={1}>
              <div style={{ padding: "0.5rem" }}>
                <Box display="flex" width="100%">
                  <div className={classes.input}>
                    <input
                      type="text"
                      className={`${classes.searchInput}`}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      placeholder="Enter a twitch channel"
                      onChange={handleChannelInput}
                      onKeyPress={handleChannelSubmit}
                    />
                  </div>
                </Box>
              </div>
            </Box>
          </div>
          <div style={{ height: "100%" }}>
            <img alt="" height="100%" src={vigor}></img>
          </div>
        </Box>
        <Box
          alignItems="center"
          display="flex"
          flexGrow={1}
          flexShrink={1}
          width="100%"
          justifyContent="flex-end"
        >
          <div className={classes.linkButton}>
            <Box alignSelf="center" display="flex" height="100%">
              <a
                href="https://patreon.com/join/overpoweredgg"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img alt="" width="45px" height="auto" href={patreon} />
              </a>
            </Box>
          </div>
          <div className={classes.linkButton}>
            <Box alignSelf="center" display="flex" height="100%">
              <a
                href="https://discord.gg/chUMEPR"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img alt="" width="45px" height="auto" href={discord} />
              </a>
            </Box>
          </div>
        </Box>
      </Box>
    </div>
  );
}

const useStyles = makeStyles({
  navDisplayFlex: {
    display: `flex`,
    width: "100%",
    height: "3rem",
    flexShrink: 0,
    zIndex: 1000,
    backgroundColor: "#1d1d1d",
  },
  button: {
    color: `#fff`,
    "&:hover": {
      opacity: "0.7",
    },
  },
  linkButton: {
    marginRight: "1rem",
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  input: {
    marginRight: "1px",
    flexGrow: 1,
  },
  search: {
    position: "relative",
    maxWidth: "40rem",
    height: "100%",
  },
  searchInput: {
    appearance: "none",
    backgroundClip: "padding-box",
    backgroundColor: "hsl(0 0% 100%/.15)",
    border: "2px solid rgba(0,0,0,.05)",
    color: "#efeff1",
    height: "1.6rem",
    lineHeight: "1.5",
    paddingRight: "2rem",
    paddingLeft: "2rem",
    paddingBottom: ".2rem",
    paddingTop: ".2rem",
    transition:
      "box-shadow .1s ease-in,border .1s ease-in,background-color .1s ease-in",
    transitionProperty: "box-shadow,border,background-color",
    transitionDuration: ".1s,.1s,.1s",
    transitionTimingFunction: "ease-in,ease-in,ease-in",
    transitionDelay: "0s,0s,0s",
    "&:focus": {
      backgroundColor: "rgb(14 14 14/1)",
      borderColor: "#2079ff",
      outline: "none",
    },
    borderBottomLeftRadius: ".6rem",
    borderBottomRightRadius: ".6rem",
    borderTopLeftRadius: ".6rem",
    borderTopRightRadius: ".6rem",
    textAlign: "center",
    width: "10rem",
    display: "block",
    fontFamily: "inherit",
  },
});
