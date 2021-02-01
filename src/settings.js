import React, { useState } from "react";
import {
  makeStyles,
  Typography,
  IconButton,
  Box,
  Modal,
  Button,
  TextField,
  NativeSelect,
  FormControl,
  InputLabel,
} from "@material-ui/core";
import { Movie, Search, Equalizer, Theaters, Close } from "@material-ui/icons";
import SettingsIcon from "@material-ui/icons/Settings";

export default function Settings(props) {
  const classes = useStyles();
  const [showStartInput, setShowStartInput] = useState(false);
  const [showEndInput, setShowEndInput] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const {
    handleIntervalChange,
    interval,
    handleSearchThreshold,
    handleVolumeThreshold,
    handleMessageThreshold,
    handleStartInput,
    handleEndInput,
    handleStartButton,
    handleEndButton,
    handleClip,
    searchThreshold,
    volumeThreshold,
    messageThreshold,
    searchToggle,
    volumeToggle,
    clipsToggle,
    handleSearchToggle,
    handleVolumeToggle,
    handleClipsToggle,
    handleSearchInput,
    searchTerm,
    start,
    end,
    handleVariantInput,
    handleDownloadVod,
    variant,
  } = props;

  const handleStartInputClick = () => {
    setShowStartInput(true);
  };

  const handleLostFocusStartInput = () => {
    if (!showStartInput) return;
    setShowStartInput(false);
  };

  const handleEndInputClick = () => {
    setShowEndInput(true);
  };

  const handleLostFocusEndInput = () => {
    if (!showStartInput) return;
    setShowEndInput(false);
  };

  const handleShowSettingsModal = () => {
    setShowSettingsModal(true);
  };

  const handleCloseSettingsModal = () => {
    setShowSettingsModal(false);
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
                  title="Get Video Timestamp"
                  className={classes.button}
                  onClick={handleStartButton}
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
                <button
                  title="Get Video Timestamp"
                  className={classes.button}
                  onClick={handleEndButton}
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
                <IconButton
                  title="Clip"
                  className={classes.button}
                  onClick={handleClip}
                >
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
              {clipsToggle ? (
                <IconButton
                  title="Close"
                  className={classes.button}
                  onClick={handleClipsToggle}
                >
                  <Close className={classes.svgAsset} />
                </IconButton>
              ) : (
                <IconButton
                  title="Clips Graph"
                  disabled={props.clipsData ? false : true}
                  className={classes.button}
                  onClick={handleClipsToggle}
                >
                  <Theaters className={classes.svgAsset} />
                </IconButton>
              )}
            </div>
          </Box>
          <Box display="inline-flex" position="relative">
            <div className={classes.buttonDiv}>
              {volumeToggle ? (
                <IconButton
                  title="Close"
                  className={classes.button}
                  onClick={handleVolumeToggle}
                >
                  <Close className={classes.svgAsset} />
                </IconButton>
              ) : (
                <IconButton
                  title="Volume Graph"
                  disabled={props.volumeData ? false : true}
                  className={classes.button}
                  onClick={handleVolumeToggle}
                >
                  <Equalizer className={classes.svgAsset} />
                </IconButton>
              )}
            </div>
          </Box>
          <Box display="inline-flex" position="relative">
            <div className={classes.buttonDiv}>
              {searchToggle ? (
                <>
                  <div>
                    <IconButton
                      title="Close"
                      className={classes.button}
                      onClick={handleSearchToggle}
                    >
                      <Close className={classes.svgAsset} />
                    </IconButton>
                  </div>
                  <div className={classes.timeInputDiv}>
                    <input
                      autoFocus
                      type="text"
                      className={`${classes.thresholdInput} ${classes.timeInput} ${classes.input}`}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      placeholder="Search"
                      required={true}
                      defaultValue={searchTerm}
                      onChange={handleSearchInput}
                    />
                  </div>
                </>
              ) : (
                <IconButton
                  title="Search Graph"
                  className={classes.button}
                  onClick={handleSearchToggle}
                >
                  <Search className={classes.svgAsset} />
                </IconButton>
              )}
            </div>
          </Box>
        </Box>
        <Box className={classes.divider} />

        <Box display="flex" flexDirection="row" justifyContent="space-between">
          <Box display="inline-flex" position="relative">
            {searchToggle ? (
              <div className={`${classes.timeButton} ${classes.thresholdDiv}`}>
                <div className={classes.timeLabel}>
                  <Typography
                    variant="caption"
                    className={classes.timeLabelText}
                  >
                    Search Threshold
                  </Typography>
                </div>
                <div className={classes.timeInputDiv}>
                  <Box paddingLeft="1rem" paddingRight="1rem">
                    <input
                      key="searchInput"
                      type="number"
                      className={`${classes.thresholdInput} ${classes.timeInput} ${classes.input}`}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      min={1}
                      required={true}
                      defaultValue={searchThreshold}
                      onChange={handleSearchThreshold}
                    />
                  </Box>
                </div>
              </div>
            ) : clipsToggle ? (
              <></>
            ) : volumeToggle ? (
              <div className={`${classes.timeButton} ${classes.thresholdDiv}`}>
                <div className={classes.timeLabel}>
                  <Typography
                    variant="caption"
                    className={classes.timeLabelText}
                  >
                    Volume Threshold
                  </Typography>
                </div>
                <div className={classes.timeInputDiv}>
                  <Box paddingLeft="1rem" paddingRight="1rem">
                    <input
                      key="volumeInput"
                      type="number"
                      className={`${classes.thresholdInput} ${classes.timeInput} ${classes.input}`}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      min={-200}
                      max={100}
                      required={true}
                      defaultValue={volumeThreshold}
                      onChange={handleVolumeThreshold}
                    />
                  </Box>
                </div>
              </div>
            ) : (
              <div className={`${classes.timeButton} ${classes.thresholdDiv}`}>
                <div className={classes.timeLabel}>
                  <Typography
                    variant="caption"
                    className={classes.timeLabelText}
                  >
                    Message Threshold
                  </Typography>
                </div>
                <div className={classes.timeInputDiv}>
                  <Box paddingLeft="1rem" paddingRight="1rem">
                    <input
                      key="messageInput"
                      type="number"
                      className={`${classes.thresholdInput} ${classes.timeInput} ${classes.input}`}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      min={1}
                      required={true}
                      defaultValue={messageThreshold}
                      onChange={handleMessageThreshold}
                    />
                  </Box>
                </div>
              </div>
            )}
            <div className={classes.buttonDiv}>
              <IconButton
                title="Settings"
                className={classes.button}
                onClick={handleShowSettingsModal}
              >
                <SettingsIcon className={classes.svgAsset} />
              </IconButton>
            </div>
          </Box>
        </Box>
      </div>
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
                    label="Interval"
                    fullWidth
                    defaultValue={interval}
                    onChange={handleIntervalChange}
                  />
                </Box>
              </div>
            </Box>
            <Box display="flex" marginTop="2rem">
              <div style={{ marginLeft: "2rem", display: "flex" }}>
                <div className={classes.labelDiv}>
                  <FormControl className={classes.formControl}>
                    <InputLabel style={{ color: "#fff" }} shrink>
                      Quality
                    </InputLabel>
                    <NativeSelect
                      value={variant}
                      onChange={handleVariantInput}
                      className={classes.select}
                    >
                      <option value={0}>Source</option>
                      <option value={1}>720p60</option>
                      <option value={2}>720p30</option>
                      <option value={5}>Audio</option>
                    </NativeSelect>
                  </FormControl>
                </div>

                <div style={{ textAlign: "center" }}>
                  <Button
                    className={classes.settingsButton}
                    style={{ marginTop: "0.5rem" }}
                    variant="contained"
                    color="primary"
                    onClick={handleDownloadVod}
                  >
                    Download Whole Vod
                  </Button>
                </div>
              </div>
            </Box>
          </div>
        </div>
      </Modal>
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
  thresholdInput: {
    backgroundColor: "hsl(0 0% 100%/.15)",
  },
  thresholdDiv: {
    borderRight: "1px solid hsla(0,0%,100%,.1)",
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
  formControl: {
    minWidth: 120,
    marginRight: "1rem",
  },
  select: {
    backgroundColor: "hsl(0 0% 100%/.15)",
    color: "#fff",
    "& option": {
      backgroundColor: "rgb(14 14 14 / 1)!important",
      color: "#fff",
    },
  },
  menuItemText: {
    color: "#fff",
  },
}));
