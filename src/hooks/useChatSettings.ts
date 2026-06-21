import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_CHAT_FONT_FAMILY, DEFAULT_CHAT_FONT_SIZE, DEFAULT_CHAT_WIDTH } from '../constants/ui';
import type { ChatSettings } from '../types/settings';
import { safeLocalStorage } from '../utils/safeLocalStorage';

const STORAGE_KEY = 'chat-settings';

const DEFAULT_SETTINGS: ChatSettings = {
  chatWidth: DEFAULT_CHAT_WIDTH,
  showTimestamp: false,
  chatOnLeft: false,
  fontFamily: DEFAULT_CHAT_FONT_FAMILY,
  messageFontSize: DEFAULT_CHAT_FONT_SIZE,
};

export interface UseChatSettingsReturn {
  chatWidth: number;
  setChatWidth: (v: number) => void;
  showTimestamp: boolean;
  setShowTimestamp: (v: boolean) => void;
  chatOnLeft: boolean;
  setChatOnLeft: (v: boolean) => void;
  fontFamily: string;
  setFontFamily: (v: string) => void;
  messageFontSize: number;
  setMessageFontSize: (v: number) => void;
  resetChatWidth: () => void;
  resetShowTimestamp: () => void;
  resetChatOnLeft: () => void;
  resetFontFamily: () => void;
  resetMessageFontSize: () => void;
  resetAll: () => void;
}

export function useChatSettings(): UseChatSettingsReturn {
  const [chatWidth, setChatWidthState] = useState(DEFAULT_SETTINGS.chatWidth);
  const [showTimestamp, setShowTimestamp] = useState(DEFAULT_SETTINGS.showTimestamp);
  const [chatOnLeft, setChatOnLeft] = useState(DEFAULT_SETTINGS.chatOnLeft);
  const [fontFamily, setFontFamilyState] = useState(DEFAULT_SETTINGS.fontFamily);
  const [messageFontSize, setMessageFontSizeState] = useState(DEFAULT_SETTINGS.messageFontSize);

  const loadSettings = useCallback(() => {
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const settings: Partial<ChatSettings> = JSON.parse(saved);

      if (settings.chatWidth != null) {
        setChatWidthState(settings.chatWidth);
      }
      if (settings.showTimestamp != null) {
        setShowTimestamp(settings.showTimestamp);
      }
      if (settings.chatOnLeft != null) {
        setChatOnLeft(settings.chatOnLeft);
      }
      if (settings.fontFamily && typeof settings.fontFamily === 'string') {
        setFontFamilyState(settings.fontFamily);
      }
      if (settings.messageFontSize && typeof settings.messageFontSize === 'number') {
        setMessageFontSizeState(settings.messageFontSize);
      }
    } catch {
      console.error('Failed to parse chat settings from localStorage');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    document.documentElement.style.setProperty('--chat-font-family', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    document.documentElement.style.setProperty('--chat-font-size-message', `${messageFontSize}px`);
    document.documentElement.style.setProperty(
      '--chat-font-size-timestamp',
      `${Math.round(messageFontSize * 0.857)}px`,
    );
  }, [messageFontSize]);

  const persistSettings = useCallback((updates: Partial<ChatSettings>) => {
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    let settings: Partial<ChatSettings> = {};
    if (saved) {
      try {
        settings = JSON.parse(saved) || {};
      } catch {
        // ignore
      }
    }
    settings = { ...settings, ...updates };
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('chat-settings-changed'));
  }, []);

  useEffect(() => {
    const handleSync = () => loadSettings();
    window.addEventListener('chat-settings-changed', handleSync);
    return () => window.removeEventListener('chat-settings-changed', handleSync);
  }, [loadSettings]);

  const handleSetChatWidth = useCallback(
    (v: number) => {
      setChatWidthState(v);
      persistSettings({ chatWidth: v });
    },
    [persistSettings],
  );

  const handleSetShowTimestamp = useCallback(
    (v: boolean) => {
      setShowTimestamp(v);
      persistSettings({ showTimestamp: v });
    },
    [persistSettings],
  );

  const handleSetChatOnLeft = useCallback(
    (v: boolean) => {
      setChatOnLeft(v);
      persistSettings({ chatOnLeft: v });
    },
    [persistSettings],
  );

  const handleSetFontFamily = useCallback(
    (v: string) => {
      setFontFamilyState(v);
      persistSettings({ fontFamily: v });
    },
    [persistSettings],
  );

  const handleSetMessageFontSize = useCallback(
    (v: number) => {
      setMessageFontSizeState(v);
      persistSettings({ messageFontSize: v });
    },
    [persistSettings],
  );

  const handleResetChatWidth = useCallback(() => {
    setChatWidthState(DEFAULT_SETTINGS.chatWidth);
    persistSettings({ chatWidth: DEFAULT_SETTINGS.chatWidth });
  }, [persistSettings]);

  const handleResetShowTimestamp = useCallback(() => {
    setShowTimestamp(DEFAULT_SETTINGS.showTimestamp);
    persistSettings({ showTimestamp: DEFAULT_SETTINGS.showTimestamp });
  }, [persistSettings]);

  const handleResetChatOnLeft = useCallback(() => {
    setChatOnLeft(DEFAULT_SETTINGS.chatOnLeft);
    persistSettings({ chatOnLeft: DEFAULT_SETTINGS.chatOnLeft });
  }, [persistSettings]);

  const handleResetFontFamily = useCallback(() => {
    setFontFamilyState(DEFAULT_SETTINGS.fontFamily);
    persistSettings({ fontFamily: DEFAULT_SETTINGS.fontFamily });
  }, [persistSettings]);

  const handleResetMessageFontSize = useCallback(() => {
    setMessageFontSizeState(DEFAULT_SETTINGS.messageFontSize);
    persistSettings({ messageFontSize: DEFAULT_SETTINGS.messageFontSize });
  }, [persistSettings]);

  const resetAll = useCallback(() => {
    safeLocalStorage.removeItem(STORAGE_KEY);
    setChatWidthState(DEFAULT_SETTINGS.chatWidth);
    setShowTimestamp(DEFAULT_SETTINGS.showTimestamp);
    setChatOnLeft(DEFAULT_SETTINGS.chatOnLeft);
    setFontFamilyState(DEFAULT_SETTINGS.fontFamily);
    setMessageFontSizeState(DEFAULT_SETTINGS.messageFontSize);
    document.documentElement.style.removeProperty('--chat-font-family');
    document.documentElement.style.removeProperty('--chat-font-size-message');
    document.documentElement.style.removeProperty('--chat-font-size-timestamp');
  }, []);

  return {
    chatWidth,
    setChatWidth: handleSetChatWidth,
    showTimestamp,
    setShowTimestamp: handleSetShowTimestamp,
    chatOnLeft,
    setChatOnLeft: handleSetChatOnLeft,
    fontFamily,
    setFontFamily: handleSetFontFamily,
    messageFontSize,
    setMessageFontSize: handleSetMessageFontSize,
    resetChatWidth: handleResetChatWidth,
    resetShowTimestamp: handleResetShowTimestamp,
    resetChatOnLeft: handleResetChatOnLeft,
    resetFontFamily: handleResetFontFamily,
    resetMessageFontSize: handleResetMessageFontSize,
    resetAll,
  };
}
