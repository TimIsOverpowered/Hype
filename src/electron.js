const path = require("path");
const {
  app,
  BrowserWindow,
  protocol,
  shell,
  ipcMain,
  dialog,
  session,
} = require("electron");
const isDev = require("electron-is-dev");
const windowStateKeeper = require("electron-window-state");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath)
const twitch = require("./twitch");
const ProgressBar = require("electron-progressbar");

if (require("electron-squirrel-startup")) {
  app.quit();
}

function createWindow() {
  let mainWindowState = windowStateKeeper({
    defaultWidth: 900,
    defaultHeight: 600,
  });

  const win = new BrowserWindow({
    minWidth: 900,
    minHeight: 600,
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, "preload.js"),
      devTools: isDev ? true : false,
    },
  });

  //To fix Twitch player in prod mode.
  session.defaultSession.webRequest.onHeadersReceived({
    urls: [
      'https://player.twitch.tv/*',
      'https://embed.twitch.tv/*'
    ]
  }, (details, cb) => {
    var responseHeaders = details.responseHeaders;
    delete responseHeaders['Content-Security-Policy'];
    cb({
      cancel: false,
      responseHeaders
    });
  });

  win.setTitle("Hype");
  win.setMenu(null);

  win.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  let authWindow;

  protocol.registerFileProtocol("hype", (request, callback) => {
    const url = request.url;
    if (url.includes("oauth")) {
      authWindow.close();
      authWindow = null;
      const access_token = url.substring(
        url.indexOf("?access_token=") + 14,
        url.length
      );
      win.webContents
        .executeJavaScript(
          `localStorage.setItem('feathers-jwt', '${access_token}');`,
          true
        )
        .then(() => {
          //then sometimes doesn't get called.
          //win.webContents.reload();
        })
        .catch((err) => {
          console.error(err);
        });
      setTimeout(() => {
        win.webContents.reload();
      }, 5000);
    }
  });

  ipcMain.on("login", async (event, args) => {
    authWindow = new BrowserWindow({
      width: 800,
      height: 800,
      show: false,
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      devTools: false,
    });
    authWindow.setMenu(null);
    authWindow.loadURL("https://api.hype.lol/oauth/twitch?redirect=electron");
    authWindow.show();
  });

  win.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
    const parsedUrl = new URL(url);
    if (
      parsedUrl.origin === "https://twitch.tv" ||
      parsedUrl.origin === "https://www.twitch.tv" ||
      parsedUrl.origin === "https://hype.lol" ||
      parsedUrl.origin === "https://www.hype.lol" ||
      parsedUrl.origin === "https://patreon.com" ||
      parsedUrl.origin === "https://www.patreon.com" ||
      parsedUrl.origin === "https://discord.gg" ||
      parsedUrl.origin === "https://www.discord.gg"
    ) {
      shell.openExternal(url);
    }
  });

  win.webContents.on("new-window", (event, url) => {
    event.preventDefault();
    const parsedUrl = new URL(url);
    if (
      parsedUrl.origin === "https://twitch.tv" ||
      parsedUrl.origin === "https://www.twitch.tv" ||
      parsedUrl.origin === "https://hype.lol" ||
      parsedUrl.origin === "https://www.hype.lol" ||
      parsedUrl.origin === "https://patreon.com" ||
      parsedUrl.origin === "https://www.patreon.com" ||
      parsedUrl.origin === "https://discord.gg" ||
      parsedUrl.origin === "https://www.discord.gg"
    ) {
      shell.openExternal(url);
    }
  });

  let m3u8;

  ipcMain.on("clip", async (event, args) => {
    const saveDialog = await dialog.showSaveDialog({
      filters: [{ name: "Videos", extensions: ["mp4"] }],
      defaultPath: __dirname + `/out/${args.vodId}-clip.mp4`,
      properties: ["showOverwriteConfirmation", "createDirectory"],
      nameFieldLabel: `${args.vodId}-clip`,
    });

    if (saveDialog.canceled) return;
    const clipPath = saveDialog.filePath;

    const progressBar = new ProgressBar({
      indeterminate: false,
      text: "Clipping",
      title: "Hype by Overpowered",
    });

    progressBar
      .on("completed", function () {
        progressBar.detail = "Done!";
      })
      .on("aborted", function (error) {
        console.error(error);
      })
      .on("progress", function (value) {
        progressBar.detail = `${value}%`;
      });

    if (m3u8) {
      await clip(args.start, args.end, m3u8, progressBar, clipPath);
      return;
    }
    const vodTokenSig = await twitch.gqlGetVodTokenSig(args.vodId);
    m3u8 = twitch.getParsedM3u8(
      await twitch.getM3u8(args.vodId, vodTokenSig.value, vodTokenSig.signature)
    );

    await clip(args.start, args.end, m3u8, progressBar, clipPath);
  });

  const clip = (start, end, m3u8, progressBar, path) => {
    return new Promise((resolve, reject) => {
      const ffmpeg_process = ffmpeg(m3u8)
        .seekInput(start)
        .videoCodec("copy")
        .audioCodec("copy")
        .outputOptions(["-bsf:a aac_adtstoasc"])
        .duration(end)
        .toFormat("mp4")
        .on("progress", (progress) => {
          progressBar.value = Math.round(progress.percent);
        })
        .on("start", (cmd) => {
          console.info(cmd);
        })
        .on("error", function (err) {
          progressBar.close(err);
          reject(err);
          ffmpeg_process.kill("SIGKILL");
        })
        .on("end", function () {
          progressBar.setCompleted();
          resolve();
        })
        .saveToFile(path);
    });
  };

  ipcMain.on("vod", async (event, args) => {
    const saveDialog = await dialog.showSaveDialog({
      filters: [{ name: "Videos", extensions: ["mp4"] }],
      defaultPath: __dirname + `/out/${args.vodId}.mp4`,
      properties: ["showOverwriteConfirmation", "createDirectory"],
      nameFieldLabel: `${args.vodId}`,
    });

    if (saveDialog.canceled) return;
    const vodPath = saveDialog.filePath;

    const progressBar = new ProgressBar({
      indeterminate: false,
      text: "Downloading Vod",
      title: "Hype by Overpowered",
    });

    progressBar
      .on("completed", function () {
        progressBar.detail = "Done!";
      })
      .on("aborted", function (error) {
        console.error(error);
      })
      .on("progress", function (value) {
        progressBar.detail = `${value}%`;
      });

    if (m3u8) {
      await vod(m3u8, progressBar, vodPath);
      return;
    }
    const vodTokenSig = await twitch.gqlGetVodTokenSig(args.vodId);
    m3u8 = twitch.getParsedM3u8(
      await twitch.getM3u8(
        args.vodId,
        vodTokenSig.value,
        vodTokenSig.signature
      ),
      args.variant
    );

    await vod(m3u8, progressBar, vodPath);
  });

  const vod = (m3u8, progressBar, path) => {
    return new Promise((resolve, reject) => {
      const ffmpeg_process = ffmpeg(m3u8)
        .videoCodec("copy")
        .audioCodec("copy")
        .outputOptions(["-bsf:a aac_adtstoasc"])
        .toFormat("mp4")
        .on("progress", (progress) => {
          progressBar.value = Math.round(progress.percent);
        })
        .on("start", (cmd) => {
          //console.info(cmd);
        })
        .on("error", function (err) {
          progressBar.close(err);
          reject(err);
          ffmpeg_process.kill("SIGKILL");
        })
        .on("end", function () {
          progressBar.setCompleted();
          resolve();
        })
        .saveToFile(path);
    });
  };

  mainWindowState.manage(win);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
