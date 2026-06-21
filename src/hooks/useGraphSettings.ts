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
}

function loadStoredInterval(): number {
  const saved = safeLocalStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_SETTINGS.interval;
  try {
    const settings: StoredSettings = JSON.parse(saved);
    if (settings.interval != null && typeof settings.interval === 'number') return settings.interval;
  } catch {
    console.error('Failed to parse graph settings from localStorage');
  }
  return DEFAULT_SETTINGS.interval;
}

export function useGraphSettings() {
  const [interval, setIntervalState] = useState(loadStoredInterval);
  const [messageThreshold, setMessageThresholdState] = useState<number | null>(null);
  const [searchThreshold, setSearchThresholdState] = useState<number | null>(null);

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
    window.dispatchEvent(new Event('graph-settings-changed'));
  }, []);

  useEffect(() => {
    const handleSync = () => {
      const val = loadStoredInterval();
      setIntervalState(val);
    };
    window.addEventListener('graph-settings-changed', handleSync);
    return () => window.removeEventListener('graph-settings-changed', handleSync);
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

  const handleSetMessageThreshold = useCallback((v: number | null) => {
    setMessageThresholdState(v);
  }, []);

  const handleResetMessageThreshold = useCallback(() => {
    setMessageThresholdState(null);
  }, []);

  const handleSetSearchThreshold = useCallback((v: number | null) => {
    setSearchThresholdState(v);
  }, []);

  const handleResetSearchThreshold = useCallback(() => {
    setSearchThresholdState(null);
  }, []);

  const handleResetAll = useCallback(() => {
    setIntervalState(DEFAULT_SETTINGS.interval);
    setMessageThresholdState(null);
    setSearchThresholdState(null);
    persistSettings({ interval: DEFAULT_SETTINGS.interval });
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
