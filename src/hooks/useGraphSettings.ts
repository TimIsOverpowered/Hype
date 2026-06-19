import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_MESSAGE_THRESHOLD, DEFAULT_SEARCH_THRESHOLD } from '../constants/ui';
import { safeLocalStorage } from '../utils/safeLocalStorage';

const STORAGE_KEY = 'graph-settings';

const DEFAULT_SETTINGS = {
  interval: 30,
  MIN_INTERVAL: 5,
  MAX_INTERVAL: 60,
  STEP: 5,
};

interface StoredSettings {
  interval?: number;
  messageThreshold?: number | null;
  searchThreshold?: number | null;
}

export function useGraphSettings() {
  const [interval, setIntervalState] = useState(DEFAULT_SETTINGS.interval);
  const [messageThreshold, setMessageThresholdState] = useState<number | null>(null);
  const [searchThreshold, setSearchThresholdState] = useState<number | null>(null);

  const loadSettings = useCallback(() => {
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const settings: StoredSettings = JSON.parse(saved);
      if (settings.interval != null && typeof settings.interval === 'number') {
        setIntervalState(settings.interval);
      }
      if (settings.messageThreshold != null) {
        setMessageThresholdState(settings.messageThreshold);
      }
      if (settings.searchThreshold != null) {
        setSearchThresholdState(settings.searchThreshold);
      }
    } catch {
      console.error('Failed to parse graph settings from localStorage');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const persistSettings = useCallback((updates: Partial<StoredSettings>) => {
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    let settings: StoredSettings = {};
    if (saved) {
      try {
        settings = JSON.parse(saved) || {};
      } catch {
        // ignore
      }
    }
    settings = { ...settings, ...updates };
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, []);

  const handleSetInterval = useCallback(
    (v: number) => {
      setIntervalState(v);
      persistSettings({ interval: v });
    },
    [persistSettings],
  );

  const handleResetInterval = useCallback(() => {
    setIntervalState(DEFAULT_SETTINGS.interval);
    persistSettings({ interval: DEFAULT_SETTINGS.interval });
  }, [persistSettings]);

  const handleSetMessageThreshold = useCallback(
    (v: number | null) => {
      setMessageThresholdState(v);
      persistSettings({ messageThreshold: v });
    },
    [persistSettings],
  );

  const handleResetMessageThreshold = useCallback(() => {
    setMessageThresholdState(null);
    persistSettings({ messageThreshold: null });
  }, [persistSettings]);

  const handleSetSearchThreshold = useCallback(
    (v: number | null) => {
      setSearchThresholdState(v);
      persistSettings({ searchThreshold: v });
    },
    [persistSettings],
  );

  const handleResetSearchThreshold = useCallback(() => {
    setSearchThresholdState(null);
    persistSettings({ searchThreshold: null });
  }, [persistSettings]);

  const handleResetAll = useCallback(() => {
    setIntervalState(DEFAULT_SETTINGS.interval);
    setMessageThresholdState(null);
    setSearchThresholdState(null);
    persistSettings({ interval: DEFAULT_SETTINGS.interval, messageThreshold: null, searchThreshold: null });
  }, [persistSettings]);

  return {
    interval,
    setInterval: handleSetInterval,
    resetInterval: handleResetInterval,
    minInterval: DEFAULT_SETTINGS.MIN_INTERVAL,
    maxInterval: DEFAULT_SETTINGS.MAX_INTERVAL,
    step: DEFAULT_SETTINGS.STEP,
    messageThreshold,
    setMessageThreshold: handleSetMessageThreshold,
    resetMessageThreshold: handleResetMessageThreshold,
    searchThreshold,
    setSearchThreshold: handleSetSearchThreshold,
    resetSearchThreshold: handleResetSearchThreshold,
    resetAll: handleResetAll,
    defaultMessageThreshold: DEFAULT_MESSAGE_THRESHOLD,
    defaultSearchThreshold: DEFAULT_SEARCH_THRESHOLD,
  };
}
