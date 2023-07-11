const { session } = require("electron");
const querystring = require("node:querystring");

module.exports.sendToken = (command, window) => {
  session.defaultSession.clearStorageData({
    storages: ["cookies", "filesystem"],
  });
  const qs = querystring.parse(command, "?");
  const { access_token } = qs;
  if (!access_token) return;
  if (access_token.length === 0) return;
  window.webContents.send("access_token", access_token);
};
