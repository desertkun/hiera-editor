
import { Window } from "../window"
import { puppet } from "../puppet";

const $ = require("jquery");

export class WorkspaceWindow extends Window
{
    private _workspacePath: string;

    constructor ()
    {
        super();

        this._workspacePath = "";

        this.init();

    }

    public show(workspacePath: string)
    {
        this._workspacePath = workspacePath;

        this.openWindow(1000, 600, "workspace.html", "workspace-window.json", {
            "resizable": true,
            "minWidth": 600,
            "minHeight": 400
        });

        this.browserWindow.webContents.toggleDevTools();

        //this.generate();
    }

    private init()
    {

    }

    private async generate()
    {
        const a = JSON.stringify(["*/manifests/**/*.pp", "*/functions/**/*.pp", "*/types/**/*.pp", "*/lib/**/*.rb"])
        const b = "out.json";
        await puppet.Ruby.Call("puppet-strings.rb", [a, b], "C:\\Work\\puppet-anthill-dev\\modules");

        const fe = 1;
    }
}