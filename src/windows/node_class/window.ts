
import { Window } from "../window"

const $ = require("jquery");

export class NodeClassWindow extends Window
{
    private readonly _envName: string;
    private readonly _nodePath: string;
    private readonly _className: string;

    constructor (envName: string, nodePath: string, className: string)
    {
        super();

        this._envName = envName;
        this._nodePath = nodePath;
        this._className = className;
    }

    public show()
    {
        this.openWindow(600, 600, "workspace/node/class.html", "node-class-window.json", {
            "resizable": true,
            "minWidth": 600,
            "minHeight": 400
        });

        this.browserWindow.webContents.send("init",
            this._envName,
            this._nodePath,
            this._className);
    }
}