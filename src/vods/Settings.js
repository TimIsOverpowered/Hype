import { useEffect, useState, useMemo } from "react";
import debounce from "lodash.debounce";

const debouncedDelay = useMemo(() => {
  const delayChange = (evt) => {
    if (evt.target.value.length === 0) return;
    const value = Number(evt.target.value);
    if (isNaN(value)) return;
    setUserChatDelay(value);
  };
  return debounce(delayChange, 300);
}, []);
