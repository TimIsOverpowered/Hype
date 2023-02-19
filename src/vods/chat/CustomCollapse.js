import { Collapse, styled } from "@mui/material";
import { collapseClasses } from "@mui/material/Collapse";

const CustomCollapse = styled(({ _, ...props }) => <Collapse {...props} />)({
  [`& .${collapseClasses.wrapper}`]: {
    height: "100%",
  },
});

export default CustomCollapse;
