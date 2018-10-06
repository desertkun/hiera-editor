"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
require("./ipc/server");
const global_1 = require("./global");
function initialize() {
    global_1.init();
    global_1.projects_window.show();
}
electron_1.app.on("ready", initialize);
electron_1.app.on("window-all-closed", () => {
    electron_1.app.quit();
});
//# sourceMappingURL=main.js.map