import React from "react";

import { IconButton, makeStyles } from "@material-ui/core";
import { ArrowBackIos } from "@material-ui/icons";

const useStyles = makeStyles({
  navDisplayFlex: {
    display: `flex`,
  },
  button: {
    color: `#fff`,
    "&:hover": {
      opacity: "0.7",
    },
  },
});

export default function NavBar(props) {
  const classes = useStyles();

  const goBack = () => {
    props.history.goBack();
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
    </div>
  );
}
