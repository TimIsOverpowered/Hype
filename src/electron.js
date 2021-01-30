const path = require("path");

const { app, BrowserWindow, protocol } = require("electron");
const isDev = require("electron-is-dev");
const windowStateKeeper = require("electron-window-state");

if (require("electron-squirrel-startup")) {
  app.quit();
}

function createWindow() {
  //fix window state after finishing oauth.
  let mainWindowState = windowStateKeeper({
    defaultWidth: 1000,
    defaultHeight: 800,
  });

  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

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
          console.log("failed?");
          console.error(err);
        });
      setTimeout(() => {
        win.webContents.reload();
      }, 5000);
    }
  });

  win.webContents.on("new-window", (event, url) => {
    event.preventDefault()
    win.loadURL(url)
  });

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
