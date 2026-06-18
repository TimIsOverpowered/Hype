import { useCallback, useEffect, useState } from 'react';
import type { PlayerSettings } from '../types/settings';
import { safeLocalStorage } from '../utils/safeLocalStorage';

const STORAGE_KEY = 'player-settings';

const DEFAULT_SETTINGS: PlayerSettings = {
  volume: 80,
  muted: false,
};

export function usePlayerSettings(): PlayerSettings & {
  setVolume: (v: number) => void;
  setMuted: (v: boolean) => void;
} {
  const [volume, setVolumeState] = useState(DEFAULT_SETTINGS.volume);
  const [muted, setMutedState] = useState(DEFAULT_SETTINGS.muted);

  const loadSettings = useCallback(() => {
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const settings: Partial<PlayerSettings> = JSON.parse(saved);
      if (settings.volume != null) {
        setVolumeState(settings.volume);
      }
      if (settings.muted != null) {
        setMutedState(settings.muted);
      }
    } catch {
      console.error('Failed to parse player settings from localStorage');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const persistSettings = useCallback((updates: Partial<PlayerSettings>) => {
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    let settings: Partial<PlayerSettings> = {};
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

  const handleSetVolume = useCallback(
    (v: number) => {
      setVolumeState(v);
      persistSettings({ volume: v });
    },
    [persistSettings],
  );

  const handleSetMuted = useCallback(
    (v: boolean) => {
      setMutedState(v);
      persistSettings({ muted: v });
    },
    [persistSettings],
  );

  return {
    volume,
    muted,
    setVolume: handleSetVolume,
    setMuted: handleSetMuted,
  };
}
