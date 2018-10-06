"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const projects_1 = require("./projects");
const window_1 = require("./projects/window");
const window_2 = require("./workspace/window");
exports.projects_list = new projects_1.ProjectsModel();
exports.projects_window = new window_1.ProjectsWindow();
exports.workspace_window = new window_2.WorkspaceWindow();
let current_workspace;
function init() {
    exports.projects_list.load();
}
exports.init = init;
function getCurrentWorkspace() {
    return current_workspace;
}
exports.getCurrentWorkspace = getCurrentWorkspace;
function setCurrentWorkspace(workspace) {
    current_workspace = workspace;
}
exports.setCurrentWorkspace = setCurrentWorkspace;
//# sourceMappingURL=global.js.map