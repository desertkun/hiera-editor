System.register(["../window", "../puppet"], function (exports_1, context_1) {
    "use strict";
    var window_1, puppet_1, WorkspaceWindow;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (window_1_1) {
                window_1 = window_1_1;
            },
            function (puppet_1_1) {
                puppet_1 = puppet_1_1;
            }
        ],
        execute: function () {
            WorkspaceWindow = class WorkspaceWindow extends window_1.Window {
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
                    this.generate();
                }
                init() {
                }
                async generate() {
                    const a = JSON.stringify(["*/manifests/**/*.pp", "*/functions/**/*.pp", "*/types/**/*.pp", "*/lib/**/*.rb"]);
                    const b = "out.json";
                    await puppet_1.puppet.Ruby.Call("puppet-strings.rb", [a, b], "C:\\Work\\puppet-anthill-dev\\modules");
                    const fe = 1;
                }
            };
            exports_1("WorkspaceWindow", WorkspaceWindow);
        }
    };
});
//# sourceMappingURL=window.js.map