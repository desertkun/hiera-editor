
import { Window } from "../window"
import { workspace_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";
import { throws } from "assert";

export class CreateEnvironmentWindow extends Window
{
    selected: boolean;

    constructor ()
    {
        super();
    }

    public show(): Promise<string>
    {
        return new Promise<string>((resolve, reject) => {

            this.openWindow(600, 124, "create_environment.html", null, {
                resizable: false,
                modal: true,
                autoHideMenuBar: true,
                parent: workspace_window.browserWindow
            }, (browserWindow: BrowserWindow) => {
                browserWindow.webContents.send('init');
            });
    
            ipcMain.on("environment-name-entered", (event: any, env: string) => 
            {
                if (env != null)
                {
                    this.selected = true;
                    resolve(env);
                }

                this.close();
            });

            this.onClosed = () => {
                ipcMain.removeAllListeners("environment-name-entered");

                if (!this.selected)
                {
                    resolve(null);
                }
            };
        })
    }

}