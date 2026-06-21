import { useQuery } from '@tanstack/react-query';
import { getUsers } from './api/twitch';
import { API_BASE } from './constants/api';
import { AUTH_KEY, DEFAULT_RETRY_COUNT, SEARCH_MAX_RESULTS, STALE_TIME_5MIN } from './constants/auth';
import type { PaginatedWhitelistResponse, SearchResult, TwitchUser } from './types/twitch';
import type { User } from './types/user';

export { API_BASE };

export function getToken(): string {
  return localStorage.getItem(AUTH_KEY) || '';
}

export async function login(token: string): Promise<void> {
  localStorage.setItem(AUTH_KEY, token);
}

export async function logout(): Promise<void> {
  localStorage.removeItem(AUTH_KEY);
}

export async function fetchUser(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/v1/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: fetchUser,
    staleTime: STALE_TIME_5MIN,
    retry: DEFAULT_RETRY_COUNT,
  });
}

export async function searchWhitelistedChannels(query: string): Promise<SearchResult[]> {
  const token = getToken();
  if (!token) return [];
  try {
    const res = await fetch(`${API_BASE}/v1/whitelist?search=${encodeURIComponent(query)}&sort=channel`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const entries = (data.data ?? []).map((entry: { channel: string }) => entry.channel);
    const channels = entries.slice(0, SEARCH_MAX_RESULTS);
    if (channels.length === 0) return [];

    try {
      const twitchUsers = await getUsers(channels);
      const map = new Map(twitchUsers.map((u) => [u.login.toLowerCase(), u]));
      return channels.map((channel: string) => {
        const twitch = map.get(channel.toLowerCase());
        return {
          channel,
          profileImageURL: twitch?.profileImageURL ?? null,
          displayName: twitch?.displayName ?? channel,
        };
      });
    } catch {
      return channels.map((channel: string) => ({
        channel,
        profileImageURL: null,
        displayName: channel,
      }));
    }
  } catch {
    return [];
  }
}

export async function fetchWhitelistedChannels(page: number, limit: number): Promise<PaginatedWhitelistResponse> {
  const token = getToken();
  if (!token) throw new Error('Not logged in');

  const res = await fetch(`${API_BASE}/v1/whitelist?page=${page}&limit=${limit}&sort=channel`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch whitelisted channels');

  const data = await res.json();
  const entries = data.data ?? [];
  const channelNames = entries.map((e: { channel: string }) => e.channel);

  if (channelNames.length === 0) {
    return { total: data.total ?? 0, page, limit, channels: [] };
  }

  try {
    const twitchUsers = await getUsers(channelNames);
    const map = new Map<string, TwitchUser>();
    for (const u of twitchUsers) {
      if (u) map.set(u.login.toLowerCase(), u);
    }
    return {
      total: data.total ?? 0,
      page,
      limit,
      channels: channelNames.map((channel: string) => {
        const twitch = map.get(channel.toLowerCase());
        return {
          channel,
          profileImageURL: twitch?.profileImageURL ?? null,
          displayName: twitch?.displayName ?? channel,
        };
      }),
    };
  } catch {
    return {
      total: data.total ?? 0,
      page,
      limit,
      channels: channelNames.map((channel: string) => ({
        channel,
        profileImageURL: null,
        displayName: channel,
      })),
    };
  }
}
