System.register(["electron-ipc-tunnel/client"], function (exports_1, context_1) {
    "use strict";
    var client_1, Ipc, ipc;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (client_1_1) {
                client_1 = client_1_1;
            }
        ],
        execute: function () {
            Ipc = class Ipc extends client_1.default {
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
            };
            exports_1("Ipc", Ipc);
            exports_1("ipc", ipc = new Ipc());
        }
    };
});
//# sourceMappingURL=client.js.map