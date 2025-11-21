import isDev from "electron-is-dev";
import log from "electron-log";

if (isDev) {
  log.transports.file.level = false;
  log.transports.console.level = "debug";
} else {
  log.transports.file.level = "info";
  log.transports.console.level = "warn";
}

export default log;
