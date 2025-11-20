//Sleep for x ms
export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

//Parse seconds to HH:mm:ss format
export const toHHMMSS = (seconds) => {
  return [3600, 60]
    .reduceRight(
      (p, b) => (r) => [Math.floor(r / b)].concat(p(r % b)),
      (r) => [r]
    )(seconds)
    .map((a) => a.toString().padStart(2, "0"))
    .join(":");
};

//Parse seconds to 1h2m3s format
export const toHMS = (secs) => {
  let sec_num = parseInt(secs, 10);
  let hours = Math.floor(sec_num / 3600);
  let minutes = Math.floor(sec_num / 60) % 60;
  let seconds = sec_num % 60;

  return `${hours}h${minutes}m${seconds}s`;
};

//Parse HMS to seconds
export const toSeconds = (hms) => {
  const time = hms.split(":");

  return +time[0] * 60 * 60 + +time[1] * 60 + +time[2];
};

//Check if HH:mm:ss is valid up to 48 hours
export const hmsValid = (str) => {
  const regex = /^(?:(?:([01]?\d|2[0-9]|3[0-9]|4[0-8]):)?([0-5]?\d):)?([0-5]?\d)$/;
  return regex.test(str);
};
