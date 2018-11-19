
import { Window } from "../window"
import { workspace_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";
import { throws } from "assert";

export class AssignClassWindow extends Window
{
    private selected: boolean;
    private readonly nodePath: string;

    constructor (nodePath: string)
    {
        super();

        this.selected = false;
        this.nodePath = nodePath;
    }

    public show(): Promise<string>
    {
        return new Promise<string>((resolve, reject) => {

            this.openWindow(600, 400, "assign_class.html", null, {
                resizable: false,
                modal: true,
                autoHideMenuBar: true,
                parent: workspace_window.browserWindow
            }, (browserWindow: BrowserWindow) => {
                browserWindow.webContents.send('init', this.nodePath);
            });
    
            ipcMain.on("class-selected", (event: any, className: string) => 
            {
                this.selected = true;
                resolve(className);
                this.close();
            });

            this.onClosed = () => {
                ipcMain.removeAllListeners("class-selected");

                if (!this.selected)
                {
                    resolve(null);
                }
            };
        })
    }

}