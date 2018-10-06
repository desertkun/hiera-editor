"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../ipc/client");
const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;
let renderer;
class WorkspaceRenderer {
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
}
$(() => {
    $(".panel-left").resizable({
        handleSelector: ".splitter",
        resizeHeight: false
    });
    renderer = new WorkspaceRenderer();
});
//# sourceMappingURL=renderer.js.map