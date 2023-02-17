import { styled, Typography, Box } from "@mui/material";
import CustomLink from "./CustomLink";
import Vigor from "../assets/vigor.png";

const Footer = styled((props) => (
  <Box {...props}>
    <Box sx={{ mt: 0.5, display: "flex", alignItems: "center" }}>
      <img alt="" style={{ maxWidth: "45px", height: "auto", marginRight: "0.3rem" }} src={Vigor} />
      <Typography variant="caption" color="textSecondary">
        {`Overpowered © ${new Date().getFullYear()}`}
      </Typography>
    </Box>
    <Box sx={{ display: "flex", mt: 1 }}>
      <CustomLink href="/p/tos" rel="noopener noreferrer" target="_blank" underline="none" sx={{ mr: 1 }}>
        Terms of Service
      </CustomLink>
      <Typography sx={{ mr: 1 }}>|</Typography>
      <CustomLink href="/p/privacy" rel="noopener noreferrer" target="_blank" underline="none">
        Privacy Policy
      </CustomLink>
    </Box>
    <CustomLink href="https://twitter.com/overpowered" rel="noopener noreferrer" target="_blank" underline="none" sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="caption" color="textSecondary">
          made by OP with 💜
        </Typography>
      </Box>
    </CustomLink>
  </Box>
))`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-bottom: 1rem;
`;

export default Footer;
