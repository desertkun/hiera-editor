
import { ipc } from "../ipc/client";

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;

let renderer: WorkspaceRenderer;

class WorkspaceRenderer
{
    constructor()
    {
        this.init();
    }

    private async init()
    {
        const path: string = await ipc.getCurrentWorkspacePath();

        if (path != null)
        {
            const shortenedPath = ellipsis(path, 80, { side: 'start'});

            document.title = shortenedPath;
        }

        const environments: string[] = await ipc.getEnvironmentList();

        $('#tree').jstree({
            "plugins" : [ "wholerow" ],
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

$(() =>
{
    $(".panel-left").resizable({
        handleSelector: ".splitter",
        resizeHeight: false
    });

    renderer = new WorkspaceRenderer();
});
