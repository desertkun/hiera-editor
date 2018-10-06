"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("electron-ipc-tunnel/client");
class Ipc extends client_1.default {
    getProjectList() {
        return this.send("get-projects-list");
    }
    addProject(path) {
        return this.send("add-project", path);
    }
    openProject(path) {
        return this.send("open-project", path);
    }
    getEnvironmentList() {
        return this.send("get-environments-list");
    }
    getCurrentWorkspacePath() {
        return this.send("get-current-workspace-path");
    }
    showOpenDirectoryDialog(defaultPath) {
        return this.send("show-open-directory-dialog", defaultPath);
    }
}
exports.Ipc = Ipc;
exports.ipc = new Ipc();
//# sourceMappingURL=client.js.map