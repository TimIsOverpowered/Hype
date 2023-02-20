const ffmpegStatic = require("ffmpeg-static").replace("app.asar", "app.asar.unpacked");
const ffmpeg = require("fluent-ffmpeg");
const { toSeconds } = require("./utils/helpers");
ffmpeg.setFfmpegPath(ffmpegStatic);

module.exports.clip = (start, end, m3u8, progressBar, path) => {
  return new Promise((resolve, reject) => {
    const ffmpeg_process = ffmpeg(m3u8)
      .seekInput(start)
      .videoCodec("copy")
      .audioCodec("copy")
      .outputOptions(["-bsf:a aac_adtstoasc"])
      .duration(end)
      .toFormat("mp4")
      .on("progress", (progress) => {
        const { frames, timemark } = progress;
        const currentTime = toSeconds(timemark);
        const percent = Math.round((currentTime / end) * 100);
        progressBar.detail = `Processing Video ${percent}% Processed Frames: ${frames}`;
      })
      .on("start", (cmd) => {
        console.info(cmd);
      })
      .on("error", (err) => {
        reject(err);
        ffmpeg_process.kill("SIGKILL");
      })
      .on("end", () => {
        resolve();
      })
      .saveToFile(path);
  });
};
