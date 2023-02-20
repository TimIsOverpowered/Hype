//Sleep for x ms
module.exports.sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

//Parse seconds to HH:mm:ss format
module.exports.toHMS = (seconds) => {
  return [3600, 60]
    .reduceRight(
      (p, b) => (r) => [Math.floor(r / b)].concat(p(r % b)),
      (r) => [r]
    )(seconds)
    .map((a) => a.toString().padStart(2, "0"))
    .join(":");
};

//Parse seconds to HH:mm:ss format
module.exports.toHHMMSS = (seconds) => {
  return [3600, 60]
    .reduceRight(
      (p, b) => (r) => [Math.floor(r / b)].concat(p(r % b)),
      (r) => [r]
    )(seconds)
    .map((a) => a.toString().padStart(2, "0"))
    .join(":");
};

//Parse seconds to 1h2m3s format
module.exports.toHMS = (secs) => {
  let sec_num = parseInt(secs, 10);
  let hours = Math.floor(sec_num / 3600);
  let minutes = Math.floor(sec_num / 60) % 60;
  let seconds = sec_num % 60;

  return `${hours}h${minutes}m${seconds}s`;
};

//Parse HMS to seconds
module.exports.toSeconds = (hms) => {
  const time = hms.split(":");

  return +time[0] * 60 * 60 + +time[1] * 60 + +time[2];
};

//Check if HH:mm:ss is valid
module.exports.hmsValid = (str) => {
  const regex = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
  return regex.test(str);
};
