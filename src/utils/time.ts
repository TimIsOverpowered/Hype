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
