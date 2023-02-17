import { styled, Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const CustomLink = styled((props) => <Link {...props} component={RouterLink} to={props.href} underline="none" />)`
  &:hover {
    opacity: 50%;
  }
`;

export default CustomLink;
