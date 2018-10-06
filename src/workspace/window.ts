
import { Window } from "../window"

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
    }

    private init()
    {
        //const a = JSON.stringify(["*/manifests/**/*.pp", "*/functions/**/*.pp", "*/types/**/*.pp", "*/lib/**/*.rb"])
        //const b = "out.json"
        //puppet.Ruby.Call("puppet-strings.rb", [a, b], "/Users/desertkun/Documents/Work/anthill-puppet-dev/modules")

    }
}