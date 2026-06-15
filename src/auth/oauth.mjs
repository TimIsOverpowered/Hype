import { session } from "electron";
import querystring from "node:querystring";

export const sendToken = (command, window) => {
  session.defaultSession.clearStorageData({
    storages: ["cookies", "filesystem"],
  });
  const qs = querystring.parse(command, "?");
  const { token } = qs;
  if (!token) return;
  if (token.length === 0) return;
  window.webContents.send("access_token", token);
};
