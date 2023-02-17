import { styled, Typography } from "@mui/material";
import Logo from "../assets/logo.svg";

const NotAuth = styled((props) => {
  return (
    <div {...props}>
      <img src={Logo} alt="" style={{ height: "auto", maxWidth: "200px" }} />
      <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
        <Typography variant="body2" color="textSecondary">
          Please login before accessing these features.
        </Typography>
      </div>
    </div>
  );
})`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 0;
  height: 100%;
  width: 100%;
`;

export default NotAuth;
