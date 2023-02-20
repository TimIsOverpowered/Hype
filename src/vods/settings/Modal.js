import { useState, useMemo } from "react";
import debounce from "lodash.debounce";
import { Box, Modal, Typography } from "@mui/material";

export default function Settings(props) {
  const { setUserChatDelay, showModal, setShowModal } = props;

  const debouncedDelay = useMemo(() => {
    const delayChange = (evt) => {
      if (evt.target.value.length === 0) return;
      const value = Number(evt.target.value);
      if (isNaN(value)) return;
      setUserChatDelay(value);
    };
    return debounce(delayChange, 300);
  }, [setUserChatDelay]);

  return (
    <Modal open={showModal} onClose={() => setShowModal(false)}>
      <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 400, bgcolor: "background.paper", border: "2px solid #000", boxShadow: 24, p: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          <Typography variant="h6">Settings</Typography>
        </Box>
      </Box>
    </Modal>
  );
}
