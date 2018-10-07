System.register(["./projects", "./projects/window", "./workspace/window"], function (exports_1, context_1) {
    "use strict";
    var projects_1, window_1, window_2, projects_list, projects_window, workspace_window, current_workspace;
    var __moduleName = context_1 && context_1.id;
    function init() {
        projects_list.load();
    }
    exports_1("init", init);
    function getCurrentWorkspace() {
        return current_workspace;
    }
    exports_1("getCurrentWorkspace", getCurrentWorkspace);
    function setCurrentWorkspace(workspace) {
        current_workspace = workspace;
    }
    exports_1("setCurrentWorkspace", setCurrentWorkspace);
    return {
        setters: [
            function (projects_1_1) {
                projects_1 = projects_1_1;
            },
            function (window_1_1) {
                window_1 = window_1_1;
            },
            function (window_2_1) {
                window_2 = window_2_1;
            }
        ],
        execute: function () {
            exports_1("projects_list", projects_list = new projects_1.ProjectsModel());
            exports_1("projects_window", projects_window = new window_1.ProjectsWindow());
            exports_1("workspace_window", workspace_window = new window_2.WorkspaceWindow());
        }
    };
});
//# sourceMappingURL=global.js.map