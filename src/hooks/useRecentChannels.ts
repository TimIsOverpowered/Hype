import { useCallback, useEffect, useState } from 'react';
import { safeLocalStorage } from '../utils/safeLocalStorage';

export interface RecentChannel {
  channel: string;
  displayName: string;
  profileImageURL: string | null;
  timestamp: number;
}

const RECENT_CHANNELS_KEY = 'hype-recent-channels';
const MAX_RECENT = 12;

export function useRecentChannels() {
  const [recent, setRecent] = useState<RecentChannel[]>([]);

  const loadRecent = useCallback(() => {
    const saved = safeLocalStorage.getItem(RECENT_CHANNELS_KEY);
    if (saved) {
      try {
        setRecent(JSON.parse(saved));
      } catch {
        // ignore parsing errors
      }
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const addRecentChannel = useCallback((channel: Omit<RecentChannel, 'timestamp'>) => {
    setRecent((prev) => {
      const filtered = prev.filter((c) => c.channel.toLowerCase() !== channel.channel.toLowerCase());
      const updated = [{ ...channel, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT);
      safeLocalStorage.setItem(RECENT_CHANNELS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeRecentChannel = useCallback((channelLogin: string) => {
    setRecent((prev) => {
      const updated = prev.filter((c) => c.channel.toLowerCase() !== channelLogin.toLowerCase());
      safeLocalStorage.setItem(RECENT_CHANNELS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearRecent = useCallback(() => {
    safeLocalStorage.removeItem(RECENT_CHANNELS_KEY);
    setRecent([]);
  }, []);

  return { recent, addRecentChannel, removeRecentChannel, clearRecent };
}
