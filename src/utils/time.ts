import { HMS_PAD_WIDTH, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '../constants/ui';

export const toHHMMSS = (seconds: number): string => {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = totalSeconds % SECONDS_PER_MINUTE;
  return [hours, minutes, secs].map((a: number) => a.toString().padStart(HMS_PAD_WIDTH, '0')).join(':');
};

export const toSeconds = (hms: string): number => {
  const time = hms.split(':');
  return +time[0] * SECONDS_PER_HOUR + +time[1] * SECONDS_PER_MINUTE + +time[2];
};

export const hmsValid = (str: string): boolean => {
  const regex = /^(?:(?:([01]?\d|2[0-9]|3[0-9]|4[0-8]):)?([0-5]?\d):)?([0-5]?\d)$/;
  return regex.test(str);
};

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function humanizeDuration(ms: number): string {
  if (ms <= 0) return '0 seconds';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (seconds > 0) parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  if (parts.length === 0) return '0 seconds';
  const limited = parts.slice(0, 2);
  return limited.join(', ');
}

export function getCurrentChapter(
  timeSeconds: number,
  chapters: readonly { positionMilliseconds: number; durationMilliseconds: number; game?: string }[] | undefined,
): string | null {
  if (!chapters?.length) return null;
  const timeMs = timeSeconds * 1000;
  for (const ch of chapters) {
    if (timeMs >= ch.positionMilliseconds && timeMs < ch.positionMilliseconds + ch.durationMilliseconds) {
      return ch.game || null;
    }
  }
  return null;
}
