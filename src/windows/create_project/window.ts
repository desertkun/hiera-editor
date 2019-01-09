
import { Window } from "../window"
import { projects_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";
import { throws } from "assert";

export class CreateProjectWindow extends Window
{
    selected: boolean;

    constructor ()
    {
        super();
    }

    public show(): Promise<[string, string]>
    {
        return new Promise<[string, string]>((resolve, reject) => {

            this.openWindow(500, 300, "create_project.html", null, {
                resizable: false,
                modal: true,
                autoHideMenuBar: true,
                parent: projects_window.browserWindow
            }, (browserWindow: BrowserWindow) => {
                browserWindow.webContents.send('init');
            });
    
            ipcMain.on("project-created", (event: any, path: string, env: string) => 
            {
                if (env != null)
                {
                    this.selected = true;
                    resolve([path, env]);
                }

                this.close();
            });

            this.onClosed = () => {
                ipcMain.removeAllListeners("project-created");

                if (!this.selected)
                {
                    resolve(null);
                }
            };
        })
    }

}