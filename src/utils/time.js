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

//Parse HMS to seconds
module.exports.toSeconds = (hms) => {
  const time = hms.split(":");

  return +time[0] * 60 * 60 + +time[1] * 60 + +time[2];
};
