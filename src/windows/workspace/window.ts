
import { Window } from "../window"
import { puppet } from "../../puppet";

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
    }

    private init()
    {

    }
}