
import { Window } from "../window"
import { workspace_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";
import { throws } from "assert";

export class CreateResourceWindow extends Window
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

            this.openWindow(600, 400, "create_resource.html", null, {
                resizable: false,
                modal: true,
                autoHideMenuBar: true,
                parent: workspace_window.browserWindow
            }, (browserWindow: BrowserWindow) => {
                browserWindow.webContents.send('init', this.nodePath);
            });
    
            ipcMain.on("resource-selected", (event: any, definedTypeName: string) => 
            {
                if (definedTypeName != null)
                {
                    this.selected = true;
                    resolve(definedTypeName);
                }

                this.close();
            });

            this.onClosed = () => {
                ipcMain.removeAllListeners("resource-selected");

                if (!this.selected)
                {
                    resolve(null);
                }
            };
        })
    }

}