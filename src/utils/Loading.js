import LoadingLogo from "../assets/logo.svg";
import { Box, CircularProgress } from "@mui/material";

export function LogoLoading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", width: "100%", flexDirection: "column" }}>
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <img alt="" src={LoadingLogo} style={{ height: "auto", maxWidth: "20%" }} />
        <CircularProgress sx={{ mt: 4 }} size="3rem" />
      </Box>
    </Box>
  );
}

export function BasicLoading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", width: "100%", flexDirection: "column" }}>
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <CircularProgress sx={{ mt: 4 }} size="3rem" />
      </Box>
    </Box>
  );
}
