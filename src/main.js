System.register(["electron", "./ipc/server", "./global"], function (exports_1, context_1) {
    "use strict";
    var electron_1, global_1;
    var __moduleName = context_1 && context_1.id;
    function initialize() {
        global_1.init();
        global_1.projects_window.show();
    }
    return {
        setters: [
            function (electron_1_1) {
                electron_1 = electron_1_1;
            },
            function (_1) {
            },
            function (global_1_1) {
                global_1 = global_1_1;
            }
        ],
        execute: function () {
            electron_1.app.on("ready", initialize);
            electron_1.app.on("window-all-closed", () => {
                electron_1.app.quit();
            });
        }
    };
});
//# sourceMappingURL=main.js.map