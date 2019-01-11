
import { app } from "electron";
import "./ipc/server";
import { init, projects_window } from "./global"
const { autoUpdater } = require("electron-updater")

function initialize() 
{
    autoUpdater.checkForUpdatesAndNotify();
    init();
    projects_window.show();
}

app.on("ready", initialize);

app.on("window-all-closed", () => {
    app.quit();
});

