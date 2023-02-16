import { styled, Link } from "@mui/material";

const CustomLink = styled((props) => <Link {...props} />)`
  &:hover {
    opacity: 50%;
  }
`;

export default CustomLink;
