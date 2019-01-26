
import { Window } from "../window"
import { Menu } from "electron"

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
        const zis = this;

        this._workspacePath = workspacePath;

        this.openWindow(1000, 600, "workspace.html", "workspace-window.json", {
            resizable: true,
            autoHideMenuBar: true,
            minWidth: 600,
            minHeight: 400
        });

        const selectionMenu = Menu.buildFromTemplate([
            {role: 'copy'},
            {type: 'separator'},
            {role: 'selectall'},
        ])
    
        const inputMenu = Menu.buildFromTemplate([
            {role: 'undo'},
            {role: 'redo'},
            {type: 'separator'},
            {role: 'cut'},
            {role: 'copy'},
            {role: 'paste'},
            {type: 'separator'},
            {role: 'selectall'},
        ])
    
        this.browserWindow.webContents.on('context-menu', (e, props) => {
            const { selectionText, isEditable } = props;
            if (isEditable) {
                inputMenu.popup({
                    window: zis.browserWindow
                });
            } else if (selectionText && selectionText.trim() !== '') {
                selectionMenu.popup({
                    window: zis.browserWindow
                });
            }
        })
    }

    private init()
    {

    }
}