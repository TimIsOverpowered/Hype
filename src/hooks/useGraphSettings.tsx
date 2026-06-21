import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

interface GraphSettingsValue {
  interval: number;
  setInterval: (v: number) => void;
  resetInterval: () => void;
  minInterval: number;
  maxInterval: number;
  step: number;
  messageThreshold: number | null;
  setMessageThreshold: (v: number | null) => void;
  resetMessageThreshold: () => void;
  searchThreshold: number | null;
  setSearchThreshold: (v: number | null) => void;
  resetSearchThreshold: () => void;
  resetAll: () => void;
  effectiveMessageThreshold: number | null;
  setEffectiveMessageThreshold: (v: number | null) => void;
  effectiveSearchThreshold: number | null;
  setEffectiveSearchThreshold: (v: number | null) => void;
}

const GraphSettingsContext = createContext<GraphSettingsValue | null>(null);

export function GraphSettingsProvider({ children }: { children: React.ReactNode }) {
  const [interval, setIntervalState] = useState(loadStoredInterval);
  const [messageThreshold, setMessageThresholdState] = useState<number | null>(null);
  const [searchThreshold, setSearchThresholdState] = useState<number | null>(null);
  const [effectiveMessageThreshold, setEffectiveMessageThresholdState] = useState<number | null>(null);
  const [effectiveSearchThreshold, setEffectiveSearchThresholdState] = useState<number | null>(1);

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

  const handleSetEffectiveMessageThreshold = useCallback((v: number | null) => {
    setEffectiveMessageThresholdState(v);
  }, []);

  const handleSetEffectiveSearchThreshold = useCallback((v: number | null) => {
    setEffectiveSearchThresholdState(v);
  }, []);

  return (
    <GraphSettingsContext.Provider
      value={{
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
        effectiveMessageThreshold,
        setEffectiveMessageThreshold: handleSetEffectiveMessageThreshold,
        effectiveSearchThreshold,
        setEffectiveSearchThreshold: handleSetEffectiveSearchThreshold,
      }}
    >
      {children}
    </GraphSettingsContext.Provider>
  );
}

export function useGraphSettings() {
  const ctx = useContext(GraphSettingsContext);
  if (!ctx) throw new Error('useGraphSettings must be used within GraphSettingsProvider');
  return ctx;
}
