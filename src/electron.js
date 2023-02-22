const path = require("path");
const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const isDev = require("electron-is-dev");
const windowStateKeeper = require("electron-window-state");
const { sendToken } = require("./auth/oauth");
const FFmpeg = require("./ffmpeg");
const ProgressBar = require("electron-progressbar");
const { toHMS } = require("./utils/helpers");

if (require("electron-squirrel-startup")) return app.quit();
require("update-electron-app")();

let mainWindow;

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("hype", process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient("hype");
}

function createWindow() {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 900,
    defaultHeight: 600,
  });

  mainWindow = new BrowserWindow({
    minWidth: 900,
    minHeight: 600,
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: true,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, "preload.js"),
      devTools: isDev ? true : false,
      webSecurity: true,
    },
    title: `${app.getName()} v${app.getVersion()}`,
  });

  mainWindow.setMenu(null);
  mainWindow.loadURL(isDev ? "http://localhost:3000" : `file://${path.join(__dirname, "../build/index.html")}`);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  //open links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders, url } = details;
    if (!url.includes("hype.lol")) UpsertKeyValue(responseHeaders, "Access-Control-Allow-Origin", ["*"]);

    callback({
      responseHeaders,
    });
  });

  mainWindow.on("page-title-updated", (e) => {
    e.preventDefault();
  });

  mainWindowState.manage(mainWindow);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    if (process.platform !== "darwin") {
      // Find the arg that is our custom protocol url and store it
      const url = commandLine.find((commandLine) => commandLine.startsWith("hype://"));
      if (!url) return;

      const command = url.split("hype://")[1];
      if (command.startsWith("oauth")) {
        sendToken(command, mainWindow);
      }
    }
  });

  // Create mainWindow, load the rest of the app, etc...
  app.whenReady().then(() => {
    createWindow();
  });
}

// Handle the protocol. In this case, we choose to show an Error Box.
app.on("open-url", (event, url) => {
  if (url.startsWith("hype://")) {
    const command = url.split("hype://")[1];
    if (command.startsWith("oauth")) {
      sendToken(command, mainWindow);
    }
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on("clip", async (event, args) => {
  const { startSeconds, endSeconds, vodId, m3u8, startHMS, endHMS } = args;
  const fileName = `/${vodId}-${toHMS(startSeconds)}-${toHMS(startSeconds + endSeconds)}-clip.mp4`;
  const saveDialog = await dialog.showSaveDialog({
    filters: [{ name: "Videos", extensions: ["mp4"] }],
    defaultPath: __dirname + fileName,
    properties: ["showOverwriteConfirmation", "createDirectory"],
    nameFieldLabel: fileName,
  });

  if (saveDialog.canceled) return;
  const clipPath = saveDialog.filePath;

  const progressBar = new ProgressBar({
    indeterminate: false,
    text: `Clipping ${vodId} VOD from ${startHMS} to ${endHMS}`,
    title: "Hype",
    browserWindow: {
      closable: true,
      minimizable: true,
    },
  });

  progressBar.on("completed", () => {
    progressBar.detail = "Done!";
  });

  FFmpeg.clip(startHMS, endSeconds, m3u8, progressBar, clipPath)
    .then(() => progressBar.setCompleted())
    .catch((e) => {
      progressBar.close(e);
      dialog.showErrorBox("Hype", "Something went wrong! Either try again or report it in Discord. \n" + e);
    });
});

ipcMain.on("vod", async (event, args) => {
  const { m3u8, duration, vodId } = args;
  const fileName = `/${vodId}-vod.mp4`;
  const saveDialog = await dialog.showSaveDialog({
    filters: [{ name: "Videos", extensions: ["mp4"] }],
    defaultPath: __dirname + fileName,
    properties: ["showOverwriteConfirmation", "createDirectory"],
    nameFieldLabel: fileName,
  });

  if (saveDialog.canceled) return;
  const clipPath = saveDialog.filePath;

  const progressBar = new ProgressBar({
    indeterminate: false,
    text: `Downloading ${vodId} VOD`,
    title: "Hype",
    browserWindow: {
      closable: true,
      minimizable: true,
    },
  });

  progressBar.on("completed", () => {
    progressBar.detail = "Done!";
  });

  FFmpeg.downloadVod(m3u8, duration, progressBar, clipPath)
    .then(() => progressBar.setCompleted())
    .catch((e) => {
      progressBar.close(e);
      dialog.showErrorBox("Hype", "Something went wrong! Either try again or report it in Discord. \n" + e);
    });
});

const UpsertKeyValue = (obj, keyToChange, value) => {
  const keyToChangeLower = keyToChange.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === keyToChangeLower) {
      obj[key] = value;
      return;
    }
  }
  obj[keyToChange] = value;
};
