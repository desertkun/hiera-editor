"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const window_1 = require("../window");
class WorkspaceWindow extends window_1.Window {
    constructor() {
        super();
        this._workspacePath = "";
        this.init();
    }
    show(workspacePath) {
        this._workspacePath = workspacePath;
        this.openWindow(1000, 600, "workspace.html", "workspace-window.json", {
            "resizable": true,
            "minWidth": 600,
            "minHeight": 400
        });
        this.browserWindow.webContents.toggleDevTools();
    }
    init() {
        //const a = JSON.stringify(["*/manifests/**/*.pp", "*/functions/**/*.pp", "*/types/**/*.pp", "*/lib/**/*.rb"])
        //const b = "out.json"
        //puppet.Ruby.Call("puppet-strings.rb", [a, b], "/Users/desertkun/Documents/Work/anthill-puppet-dev/modules")
    }
}
exports.WorkspaceWindow = WorkspaceWindow;
//# sourceMappingURL=window.js.map