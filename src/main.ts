
import { app, BrowserWindow } from "electron";
import * as path from "path";
import * as url from "url";
import { puppet } from "./puppet";
import "./ipc/server";

import { ProjectsModel } from "./projects"
import { init, projects_window } from "./global"

//app.commandLine.appendSwitch('remote-debugging-port', '9229');

function initialize() 
{
    init();
    projects_window.show();
}

app.on("ready", initialize);

app.on("window-all-closed", () => {
    app.quit();
});

