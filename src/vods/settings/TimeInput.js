import { Input } from "@mui/material";
import { forwardRef } from "react";

const TimeInput = forwardRef((props, ref) => {
  return (
    <Input
      inputRef={ref}
      {...props}
      inputProps={{
        style: {
          padding: 0,
          fontSize: "0.75rem",
          lineHeight: 1.66,
          letterSpacing: "0.03333em",
          fontWeight: "500",
        },
      }}
      type="text"
      sx={{
        width: "55px",
      }}
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      disableUnderline
      required={true}
    />
  );
});

export default TimeInput;
