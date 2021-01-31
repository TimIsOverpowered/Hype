import React, { useState } from "react";
import {
  makeStyles,
  Typography,
  IconButton,
  CircularProgress,
  Box,
  Modal,
  Button,
  TextField,
} from "@material-ui/core";
import moment from "moment";
import { Movie, Search, Equalizer, Theaters, GetApp } from "@material-ui/icons";
import SettingsIcon from "@material-ui/icons/Settings";

export default function Settings(props) {
  const classes = useStyles();
  const [start, setStart] = useState("00:00:00");
  const [showStartInput, setShowStartInput] = useState(false);
  const [end, setEnd] = useState("00:00:00");
  const [showEndInput, setShowEndInput] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [searchThreshold, setSearchThreshold] = useState(1);
  const [messageThreshold, setMessageThreshold] = useState(5);
  const [volumeThreshold, setVolumeThreshold] = useState(-40);

  const player = props.player;

  const handleStartInput = (evt) => {
    setStart(evt.target.value);
  };

  const handleStartInputClick = () => {
    setShowStartInput(true);
  };

  const handleLostFocusStartInput = () => {
    if (!showStartInput) return;
    setShowStartInput(false);
  };

  const getTimeStampForStart = () => {
    if (!player) return;
    setStart(moment.utc(player.getCurrentTime() * 1000).format("HH:mm:ss"));
  };

  const handleEndInput = (evt) => {
    setEnd(evt.target.value);
  };

  const handleEndInputClick = () => {
    setShowEndInput(true);
  };

  const handleLostFocusEndInput = () => {
    if (!showStartInput) return;
    setShowEndInput(false);
  };

  const getTimeStampForEnd = () => {
    if (!player) return;
    setEnd(moment.utc(player.getCurrentTime() * 1000).format("HH:mm:ss"));
  };

  const handleClip = () => {};

  const handleShowSettingsModal = () => {
    setShowSettingsModal(true);
  };

  const handleCloseSettingsModal = () => {
    setShowSettingsModal(false);
  };

  const handleSearchThreshold = (evt) => {
    setSearchThreshold(evt.target.value);
    /*
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(this.makeSearchGraph, 500);*/
  };

  const handleVolumeThreshold = (evt) => {
    setVolumeThreshold(evt.target.value);
    /*
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(this.makeSearchGraph, 500);*/
  };

  const handleMessageThreshold = (evt) => {
    setMessageThreshold(evt.target.value);
    /*
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(this.makeSearchGraph, 500);*/
  };

  return (
    <div className={classes.root}>
      <div className={classes.border}>
        <Box display="flex" flexDirection="row" justifyContent="space-between">
          <Box display="inline-flex" position="relative">
            <div
              className={classes.timeButton}
              onClick={handleStartInputClick}
              onBlur={handleLostFocusStartInput}
            >
              <div className={classes.timeLabel}>
                <Typography variant="caption" className={classes.timeLabelText}>
                  Start
                </Typography>
              </div>
              <div className={classes.timeInputDiv}>
                <Box paddingLeft="1rem" paddingRight="1rem">
                  {showStartInput ? (
                    <input
                      autoFocus={true}
                      type="text"
                      className={`${classes.timeInput} ${classes.input}`}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      required={true}
                      defaultValue={start}
                      onChange={handleStartInput}
                    />
                  ) : (
                    <Typography variant="caption" className={classes.boldLabel}>
                      {start}
                    </Typography>
                  )}
                </Box>
              </div>
            </div>

            <Box display="inline-flex" position="relative">
              <div className={classes.buttonDiv}>
                <button
                  className={classes.button}
                  onClick={getTimeStampForStart}
                >
                  <div className={classes.icon}>
                    <figure className={classes.svg}>
                      <svg
                        className={classes.svgAsset}
                        width="20px"
                        height="20px"
                        version="1.1"
                        viewBox="0 0 20 20"
                        x="0px"
                        y="0px"
                      >
                        <g>
                          <path d="M18 17h-2v-2h2v2zM2 17h2V3H2v14zM10.5 12.5L9 11h6V9H9l1.5-1.5L9 6l-4 4 4 4 1.5-1.5zM16 13h2v-2h-2v2zM18 9h-2V7h2v2zM16 5h2V3h-2v2z"></path>
                        </g>
                      </svg>
                    </figure>
                  </div>
                </button>
              </div>
            </Box>

            <div
              className={classes.timeButton}
              onClick={handleEndInputClick}
              onBlur={handleLostFocusEndInput}
            >
              <div className={classes.timeLabel}>
                <Typography variant="caption" className={classes.timeLabelText}>
                  End
                </Typography>
              </div>
              <div className={classes.timeInputDiv}>
                <Box paddingLeft="1rem" paddingRight="1rem">
                  {showEndInput ? (
                    <input
                      autoFocus={true}
                      type="text"
                      className={`${classes.timeInput} ${classes.input}`}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      required={true}
                      defaultValue={end}
                      onChange={handleEndInput}
                    />
                  ) : (
                    <Typography variant="caption" className={classes.boldLabel}>
                      {end}
                    </Typography>
                  )}
                </Box>
              </div>
            </div>

            <Box display="inline-flex" position="relative">
              <div className={classes.buttonDiv}>
                <button className={classes.button} onClick={getTimeStampForEnd}>
                  <div className={classes.icon}>
                    <figure className={classes.svg}>
                      <svg
                        className={classes.svgAsset}
                        width="20px"
                        height="20px"
                        version="1.1"
                        viewBox="0 0 20 20"
                        x="0px"
                        y="0px"
                      >
                        <g>
                          <path d="M2 3h2v2H2V3zM18 3h-2v14h2V3zM9.5 7.5L11 9H5v2h6l-1.5 1.5L11 14l4-4-4-4-1.5 1.5zM4 7H2v2h2V7zM2 11h2v2H2v-2zM4 15H2v2h2v-2z"></path>
                        </g>
                      </svg>
                    </figure>
                  </div>
                </button>
              </div>
            </Box>

            <Box display="inline-flex" position="relative">
              <div className={classes.buttonDiv}>
                <IconButton className={classes.button} onClick={handleClip}>
                  <Movie className={classes.svgAsset} />
                </IconButton>
              </div>
            </Box>
          </Box>
        </Box>
        <Box className={classes.divider} />
        <Box display="flex" flexDirection="row" justifyContent="space-between">
          <Box display="inline-flex" position="relative">
            <div className={classes.buttonDiv}>
              <IconButton
                disabled={props.clipsData ? false : true}
                className={classes.button}
                onClick={null}
              >
                <Theaters className={classes.svgAsset} />
              </IconButton>
            </div>
          </Box>
          <Box display="inline-flex" position="relative">
            <div className={classes.buttonDiv}>
              <IconButton
                disabled={props.volumeData ? false : true}
                className={classes.button}
                onClick={null}
              >
                <Equalizer className={classes.svgAsset} />
              </IconButton>
            </div>
          </Box>
          <Box display="inline-flex" position="relative">
            <div className={classes.buttonDiv}>
              <IconButton className={classes.button} onClick={null}>
                <Search className={classes.svgAsset} />
              </IconButton>
            </div>
          </Box>
        </Box>
        <Box className={classes.divider} />
        <Box display="flex" flexDirection="row" justifyContent="space-between">
          <Box display="inline-flex" position="relative">
            <div className={classes.buttonDiv}>
              <IconButton
                className={classes.button}
                onClick={handleShowSettingsModal}
              >
                <SettingsIcon className={classes.svgAsset} />
              </IconButton>
            </div>
          </Box>
        </Box>
        <Modal open={showSettingsModal} onClose={handleCloseSettingsModal}>
          <div className={`${classes.modalContent} ${classes.modal}`}>
            <div style={{ width: "40rem", height: "30rem" }}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                p={1}
              >
                <Typography className={classes.modalHeader} variant="h3">
                  Settings
                </Typography>
              </Box>
              <Box display="flex" marginTop="2rem">
                <div style={{ marginLeft: "2rem" }}>
                  <Button
                    className={classes.settingsButton}
                    variant="contained"
                    color="primary"
                    onClick={null}
                  >
                    Download Whole Vod
                  </Button>
                </div>
                <div style={{ marginLeft: "2rem" }}>
                  <Box width="5rem">
                    <TextField
                      inputProps={{
                        style: {
                          backgroundColor: "hsla(0,0%,100%,.15)",
                          color: "#efeff1",
                          paddingLeft: "0.1rem",
                          paddingRight: "0.1rem",
                          textAlign: "center",
                        },
                      }}
                      InputLabelProps={{
                        style: { color: "#fff", textAlign: "center" },
                      }}
                      type="number"
                      min={1}
                      variant="standard"
                      margin="none"
                      label="Search Threshold"
                      fullWidth
                      defaultValue={searchThreshold}
                      onChange={handleSearchThreshold}
                    />
                  </Box>
                </div>
                <div style={{ marginLeft: "2rem" }}>
                  <Box width="5rem">
                    <TextField
                      inputProps={{
                        style: {
                          backgroundColor: "hsla(0,0%,100%,.15)",
                          color: "#efeff1",
                          paddingLeft: "0.1rem",
                          paddingRight: "0.1rem",
                          textAlign: "center",
                        },
                      }}
                      InputLabelProps={{
                        style: { color: "#fff", textAlign: "center" },
                      }}
                      type="number"
                      min={-200}
                      max={200}
                      disabled={props.volumeData ? false : true}
                      variant="standard"
                      margin="none"
                      label="Volume Threshold"
                      fullWidth
                      defaultValue={volumeThreshold}
                      onChange={handleVolumeThreshold}
                    />
                  </Box>
                </div>
                <div style={{ marginLeft: "2rem" }}>
                  <Box width="5rem">
                    <TextField
                      inputProps={{
                        style: {
                          backgroundColor: "hsla(0,0%,100%,.15)",
                          color: "#efeff1",
                          paddingLeft: "0.1rem",
                          paddingRight: "0.1rem",
                          textAlign: "center",
                          "&:disabled": {
                            cursor: "not-allowed",
                            pointerEvents: "all",
                          },
                        },
                      }}
                      InputLabelProps={{
                        style: { color: "#fff", textAlign: "center" },
                      }}
                      type="number"
                      min={1}
                      variant="standard"
                      margin="none"
                      label="Message Threshold"
                      fullWidth
                      defaultValue={messageThreshold}
                      onChange={handleMessageThreshold}
                    />
                  </Box>
                </div>
              </Box>
              <Box display="flex" marginTop="2rem">
                <div style={{ marginLeft: "2rem", display: "flex" }}>
                  <div className={classes.labelDiv}>
                    <Typography
                      className={classes.settingsLabel}
                      variant="body2"
                    >
                      Test
                    </Typography>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <IconButton className={classes.button} onClick={null}>
                      <GetApp className={classes.svgAsset} />
                    </IconButton>
                  </div>
                </div>
              </Box>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

const useStyles = makeStyles(() => ({
  root: {
    boxShadow:
      "0 2px 4px -1px rgba(0,0,0,.3411764705882353), 0 2px 2px -2px rgba(0,0,0,.26), 0 1px 4px 0 rgba(0,0,0,.28)",
    marginTop: "0.5rem",
  },
  border: {
    justifyContent: "space-between",
    flexDirection: "row",
    borderLeft: "1px solid hsla(0,0%,100%,.1)",
    borderTop: "1px solid hsla(0,0%,100%,.1)",
    borderRight: "1px solid hsla(0,0%,100%,.1)",
    borderBottom: "1px solid hsla(0,0%,100%,.1)",
    display: "flex",
    width: "100%",
  },
  timeButton: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingLeft: "0.5rem",
    display: "flex",
    height: "100%",
  },
  timeLabel: {
    marginRight: "0.5rem",
  },
  timeInputDiv: {
    width: "5.6rem",
    display: "inline-flex",
  },
  timeLabelText: {
    lineHeight: "1.3",
    color: "#868686",
    marginTop: "12px",
    marginBottom: "12px",
  },
  boldLabel: {
    fontWeight: "600",
    marginTop: "12px",
    marginBottom: "12px",
  },
  timeInput: {
    borderBottomLeftRadius: "4px",
    borderTopRightRadius: "4px",
    borderBottomRightRadius: "4px",
    borderTopLeftRadius: "4px",
    textAlign: "center",
    width: "100%",
    display: "block",
    fontFamily: "inherit",
  },
  input: {
    appearance: "none",
    backgroundClip: "padding-box",
    backgroundColor: "inherit",
    border: "2px solid rgba(0,0,0,.05)",
    color: "#efeff1",
    height: "1.6rem",
    lineHeight: "1.3",
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
  },
  buttonDiv: {
    borderRight: "1px solid hsla(0,0%,100%,.1)",
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
  },
  button: {
    width: "100%",
    display: "block",
    color: "inherit",
    background: "0 0",
    borderRadius: "0",
    font: "inherit",
    textAlign: "inherit",
    border: "none",
    "&:hover": {
      backgroundColor: "hsl(0 0% 100%/.2)",
    },
    "&:focus": {
      outline: "none",
    },
    "&:disabled": {
      cursor: "not-allowed",
      pointerEvents: "all",
    },
    cursor: "pointer",
  },
  icon: {
    height: "2rem",
    width: "2rem",
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
  },
  svg: {
    display: "inline-flex",
    alignItems: "center",
  },
  svgAsset: {
    fill: "#2079ff",
  },
  divider: {
    flexGrow: "4",
    borderRight: "1px solid hsla(0,0%,100%,.1)",
  },
  modalContent: {
    position: "absolute",
    backgroundColor: "rgb(14 14 14 / 1)",
    outline: "none",
  },
  modal: {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  },
  modalHeader: {
    marginTop: "0.5rem",
    color: "#fff",
    fontWeight: "600",
  },
  settingsLabel: {
    color: "#fff",
    fontWeight: "600",
  },
  labelDiv: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  settingsButton: {
    height: "100%",
  },
}));
