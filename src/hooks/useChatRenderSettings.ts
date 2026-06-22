import { useCallback, useEffect, useState } from 'react';
import type { ChatRenderSettings } from '../types/settings';
import { safeLocalStorage } from '../utils/safeLocalStorage';

const STORAGE_KEY = 'chat-render-settings';

export const DEFAULT_RENDER_SETTINGS: ChatRenderSettings = {
  width: 400,
  height: 1080,
  fps: 60,
  generateMask: false,
  backgroundColor: '#000000',
  fontFamily: 'Inter',
  fontColor: '#ffffff',
  fontSize: 24,
  showBadges: true,
  enableBttv: true,
  enableFfz: true,
  enable7tv: true,
  ignoredUsers: 'nightbot,streamelements,streamlabs',
  bannedWords: '',
};

export function useChatRenderSettings() {
  const [settings, setSettingsState] = useState<ChatRenderSettings>(DEFAULT_RENDER_SETTINGS);

  const loadSettings = useCallback(() => {
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed: Partial<ChatRenderSettings> = JSON.parse(saved);
      setSettingsState((prev) => ({ ...prev, ...parsed }));
    } catch {
      console.error('Failed to parse chat render settings');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const persistSettings = useCallback((updates: Partial<ChatRenderSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates };
      safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    window.dispatchEvent(new Event('chat-render-settings-changed'));
  }, []);

  const updateSetting = useCallback(
    <K extends keyof ChatRenderSettings>(key: K, value: ChatRenderSettings[K]) => {
      persistSettings({ [key]: value });
    },
    [persistSettings],
  );

  const resetAll = useCallback(() => {
    safeLocalStorage.removeItem(STORAGE_KEY);
    setSettingsState(DEFAULT_RENDER_SETTINGS);
    window.dispatchEvent(new Event('chat-render-settings-changed'));
  }, []);

  useEffect(() => {
    const handleSync = () => loadSettings();
    window.addEventListener('chat-render-settings-changed', handleSync);
    return () => window.removeEventListener('chat-render-settings-changed', handleSync);
  }, [loadSettings]);

  return {
    settings,
    updateSetting,
    persistSettings,
    resetAll,
  };
}
