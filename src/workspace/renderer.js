System.register(["../ipc/client"], function (exports_1, context_1) {
    "use strict";
    var client_1, $, ellipsis, remote, renderer, WorkspaceRenderer;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (client_1_1) {
                client_1 = client_1_1;
            }
        ],
        execute: function () {
            $ = require("jquery");
            ellipsis = require('text-ellipsis');
            remote = require('electron').remote;
            WorkspaceRenderer = class WorkspaceRenderer {
                constructor() {
                    this.init();
                }
                async init() {
                    const path = await client_1.ipc.getCurrentWorkspacePath();
                    if (path != null) {
                        const shortenedPath = ellipsis(path, 80, { side: 'start' });
                        document.title = shortenedPath;
                    }
                    const environments = await client_1.ipc.getEnvironmentList();
                    $('#tree').jstree({
                        "plugins": ["wholerow"],
                        "core": {
                            "animation": false,
                            "themes": {
                                "name": "proton",
                                "responsive": true
                            }
                        },
                    });
                }
            };
            $(() => {
                $(".panel-left").resizable({
                    handleSelector: ".splitter",
                    resizeHeight: false
                });
                renderer = new WorkspaceRenderer();
            });
        }
    };
});
//# sourceMappingURL=renderer.js.map