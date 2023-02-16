import React from "react";
import { createRoot } from "react-dom/client";
import "./css/index.css";
import App from "./App";
import "simplebar-react/dist/simplebar.min.css";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { createTheme, ThemeProvider, responsiveFontSizes } from "@mui/material/styles";
import { CssBaseline, styled } from "@mui/material";
import { red } from "@mui/material/colors";

let darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0e0e10",
    },
    primary: {
      main: red[200],
    },
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          color: "white",
          backgroundImage: "none",
        },
      },
    },
  },
});

darkTheme = responsiveFontSizes(darkTheme);

const Parent = styled((props) => <div {...props} />)`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <Parent>
      <App />
    </Parent>
  </ThemeProvider>
);
