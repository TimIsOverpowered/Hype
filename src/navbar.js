import React, { useState } from "react";
import { IconButton, makeStyles, TextField } from "@material-ui/core";
import { ArrowBackIos } from "@material-ui/icons";

//ADD DISCORD NAVBAR and VIGOR HOMEPAGE ICON? REPLACE INPUT WITH BETTER ONE
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
      <IconButton
        className={classes.button}
        style={{ color: "#efeff1" }}
        onClick={goBack}
      >
        <ArrowBackIos />
      </IconButton>
      <div className={classes.input}>
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
          type="text"
          variant="filled"
          margin="none"
          label="Enter a Twitch Channel"
          fullWidth
          onChange={handleChannelInput}
          onKeyPress={handleChannelSubmit}
        />
      </div>
      <div></div>
    </div>
  );
}

const useStyles = makeStyles({
  navDisplayFlex: {
    display: `flex`,
    width: "100%",
    justifyContent: "space-between",
  },
  button: {
    color: `#fff`,
    "&:hover": {
      opacity: "0.7",
    },
  },
  input: {
    width: "15rem",
  },
});
