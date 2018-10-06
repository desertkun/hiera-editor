"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const server_1 = require("electron-ipc-tunnel/server");
const global_1 = require("../global");
server_1.default("add-project", async function (reply, path) {
    return await global_1.projects_list.addProject(path);
});
server_1.default("open-project", async function (reply, path) {
    const project = global_1.projects_list.getProject(path);
    if (project == null)
        throw new Error("No such project: " + path);
    global_1.setCurrentWorkspace(project.workspace);
    global_1.workspace_window.show(path);
    global_1.projects_window.close();
});
server_1.default("get-projects-list", async function (reply) {
    const projects = global_1.projects_list.list;
    const result = [];
    for (let project of projects) {
        if (!project.workspace)
            continue;
        result.push({
            "name": project.workspace.name,
            "path": project.path
        });
    }
    return result;
});
server_1.default("get-environments-list", async function (reply, path) {
    const workspace = global_1.getCurrentWorkspace();
    if (workspace == null) {
        return [];
    }
    return await workspace.listEnvironments();
});
server_1.default("show-open-directory-dialog", function (reply, defaultPath) {
    return new Promise((resolve, reject) => {
        const options = {
            'defaultPath': defaultPath,
            'properties': ['openDirectory']
        };
        electron_1.dialog.showOpenDialog(options, (filePaths) => {
            if (filePaths) {
                resolve(filePaths[0]);
            }
            else {
                resolve(null);
            }
        });
    });
});
server_1.default("get-current-workspace-path", async function () {
    const workspace = global_1.getCurrentWorkspace();
    if (workspace == null)
        return null;
    return workspace.path;
});
//# sourceMappingURL=server.js.map