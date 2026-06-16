import { useQuery } from '@tanstack/react-query';
import type { User } from './types/user';

const AUTH_KEY = 'hype-auth';
export const API_BASE = 'https://api.hype.lol';

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
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
