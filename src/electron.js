const path = require("path");
const {
  app,
  BrowserWindow,
  protocol,
  shell,
  ipcMain,
  dialog,
} = require("electron");
const isDev = require("electron-is-dev");
const windowStateKeeper = require("electron-window-state");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const twitch = require("./twitch");
const ProgressBar = require("electron-progressbar");
const { errors } = require("@feathersjs/client");

if (require("electron-squirrel-startup")) {
  app.quit();
}

function createWindow() {
  //fix window state
  let mainWindowState = windowStateKeeper({
    defaultWidth: 900,
    defaultHeight: 600,
  });

  // Create the browser window.
  const win = new BrowserWindow({
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.setTitle("Hype");

  // and load the index.html of the app.
  // win.loadFile("index.html");
  win.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  );

  // Open the DevTools.
  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  protocol.registerFileProtocol("hype", (request, callback) => {
    const url = request.url;
    if (url.includes("oauth")) {
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

  win.webContents.on("will-navigate", (event, url) => {
    const parsedUrl = new URL(url);

    if (
      parsedUrl.origin !== "https://twitch.tv" ||
      parsedUrl.origin !== "https://api.hype.lol" ||
      parsedUrl.origin !== "https://id.twitch.tv"
    ) {
      event.preventDefault();
    }
  });

  win.webContents.on("new-window", (event, url) => {
    event.preventDefault();
    setImmediate(() => {
      const parsedUrl = new URL(url);
      if (
        parsedUrl.origin === "https://twitch.tv" ||
        parsedUrl.origin === "https://api.hype.lol" ||
        parsedUrl.origin === "https://id.twitch.tv"
      ) {
        shell.openExternal(url);
      }
    });
    return { action: "deny" };
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
        .seekOutput(start)
        .outputOptions([`-to ${end}`])
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

  //mainWindowState.manage(win);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
