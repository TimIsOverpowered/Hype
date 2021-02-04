import React from "react";
import {
  makeStyles,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Box,
} from "@material-ui/core";
import Logo from "./assets/logo.svg";

export default function Frontpage(props) {
  const classes = useStyles();
  const [channel, setChannel] = React.useState("");
  const [loadingLogin, setLoadingLogin] = React.useState(false);

  const login = () => {
    setLoadingLogin(true);
    window.api.send("login", null);
  };

  const handleChannelChange = (evt) => {
    setChannel(evt.target.value);
  };

  const handleChannelSubmit = (e) => {
    if (e.which === 13 && channel.length > 0) {
      props.history.push(`/${channel}`);
    }
  };

  if (props.user === undefined)
    return (
      <div className={classes.parent}>
        <div style={{ textAlign: "center" }}>
          <div>
            <img alt="" src={Logo} height="auto" width="15%" />
          </div>
          <CircularProgress style={{ marginTop: "2rem" }} size="1rem" />
        </div>
      </div>
    );

  if (!props.user)
    return (
      <div className={classes.parent}>
        <div style={{ textAlign: "center" }}>
          <div>
            <img alt="" src={Logo} height="auto" width="30%" />
          </div>
          {loadingLogin ? (
            <CircularProgress className={classes.loadingLogin} />
          ) : (
            <Button
              variant="contained"
              onClick={login}
              className={classes.connect}
            >
              <div
                style={{ display: "flex", flexGrow: "0", alignItems: "center" }}
              >
                <svg
                  className={classes.twitchIcon}
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="40"
                  viewBox="0 0 17 20"
                  fill="none"
                >
                  <path
                    d="M3.54167 0L0 3.57143V16.4286H4.25V20L7.79167 16.4286H10.625L17 10V0H3.54167ZM15.5833 9.28571L12.75 12.1429H9.91667L7.4375 14.6429V12.1429H4.25V1.42857H15.5833V9.28571Z"
                    fill="white"
                  />
                  <path
                    d="M13.4584 3.92847H12.0417V8.21418H13.4584V3.92847Z"
                    fill="white"
                  />
                  <path
                    d="M9.56242 3.92847H8.14575V8.21418H9.56242V3.92847Z"
                    fill="white"
                  />
                </svg>
                <div style={{ flexGrow: "0" }}>Connect</div>
              </div>
            </Button>
          )}
        </div>
      </div>
    );

  const status = (props.user.patreon
    ? props.user.patreon.tier >= 1 && props.user.patreon.isPatron
    : false) || props.user.whitelist;

  //add patreon logo if not active and link to settings connections.
  return (
    <div className={classes.parent}>
      <div style={{ textAlign: "center" }}>
        <div>
          <img alt="" src={Logo} height="auto" width="360px" />
        </div>
        <Typography variant="h4" className={classes.marginTop2}>
          {`Welcome back ${props.user.display_name}!`}
        </Typography>
        <Box className={classes.marginTop2}>
          <Typography
            variant="h5"
            className={`${classes.bold} ${classes.status}`}
          >
            {`Status: ${status ? "Active" : "Not Active"}`}
          </Typography>
          {status ? (
            <></>
          ) : (
            <Button
              style={{ marginTop: "1rem" }}
              href="https://patreon.com/join/overpoweredgg"
              target="_blank"
              rel="noopenere noreferrer"
              color="primary"
            >
              Join Patreon Today
            </Button>
          )}
        </Box>
        {status ? (
          <TextField
            autoFocus
            inputProps={{
              style: {
                backgroundColor: "hsla(0,0%,100%,.15)",
                color: "#fff",
                textAlign: "center",
              },
            }}
            InputLabelProps={{
              style: { color: "#fff" },
            }}
            disabled={!status}
            variant="outlined"
            margin="normal"
            fullWidth
            label="Enter a Twitch Channel"
            name="channel"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            onChange={handleChannelChange}
            onKeyPress={handleChannelSubmit}
          />
        ) : (
          <Box marginTop="1rem">
            <Typography variant="h6" className={`${classes.bold}`}>
              {`If you are a patron, please verify your patreon in settings.`}
            </Typography>
            <Button
              style={{ marginTop: "1rem" }}
              href="https://hype.lol/settings/connections"
              target="_blank"
              rel="noopenere noreferrer"
              color="primary"
            >
              Settings (Opens Browser)
            </Button>
          </Box>
        )}
      </div>
    </div>
  );
}

const useStyles = makeStyles(() => ({
  loadingLogin: {
    marginTop: "2rem",
  },
  connect: {
    backgroundColor: "rgb(145, 70, 255)",
    color: `#fff`,
    "&:hover": {
      backgroundColor: "rgb(145, 70, 255)",
      opacity: "0.7",
    },
    whiteSpace: "nowrap",
    textTransform: "none",
    borderRadius: "1rem",
    marginTop: "2rem",
  },
  parent: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  twitchIcon: {
    marginRight: "0.5rem",
  },
  marginTop2: {
    marginTop: "2rem",
  },
  bold: {
    fontWeight: "700",
  },
  status: {
    color: "#fc1212",
  },
}));
