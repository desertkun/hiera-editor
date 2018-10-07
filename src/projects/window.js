System.register(["../window"], function (exports_1, context_1) {
    "use strict";
    var window_1, ProjectsWindow;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (window_1_1) {
                window_1 = window_1_1;
            }
        ],
        execute: function () {
            ProjectsWindow = class ProjectsWindow extends window_1.Window {
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
                }
            };
            exports_1("ProjectsWindow", ProjectsWindow);
        }
    };
});
//# sourceMappingURL=window.js.map