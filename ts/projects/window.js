"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const window_1 = require("../window");
class ProjectsWindow extends window_1.Window {
    constructor() {
        super();
        this.init();
    }
    show() {
        this.openWindow(600, 400, "projects.html", "projects-window.json", {
            "resizable": false
        });
    }
    init() {
        //const a = JSON.stringify(["*/manifests/**/*.pp", "*/functions/**/*.pp", "*/types/**/*.pp", "*/lib/**/*.rb"])
        //const b = "out.json"
        //puppet.Ruby.Call("puppet-strings.rb", [a, b], "/Users/desertkun/Documents/Work/anthill-puppet-dev/modules")
    }
}
exports.ProjectsWindow = ProjectsWindow;
//# sourceMappingURL=window.js.map