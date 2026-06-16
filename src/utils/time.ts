export const toHHMMSS = (seconds: number): string => {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hours, minutes, secs].map((a: number) => a.toString().padStart(2, '0')).join(':');
};

export const toSeconds = (hms: string): number => {
  const time = hms.split(':');
  return +time[0] * 3600 + +time[1] * 60 + +time[2];
};

export const hmsValid = (str: string): boolean => {
  const regex = /^(?:(?:([01]?\d|2[0-9]|3[0-9]|4[0-8]):)?([0-5]?\d):)?([0-5]?\d)$/;
  return regex.test(str);
};
