
import { Window } from "../window"
import { workspace_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";
import { throws } from "assert";

export class ProgressWindow extends Window
{
    constructor ()
    {
        super();
    }

    public async notifyProgressUpdate(text: string)
    {
        this.browserWindow.webContents.send('progressUpdate', text);
    }
    
    public async notifyProgressError(title: string, text: string)
    {
        this.browserWindow.webContents.send('progressError', title, text);
        this.browserWindow.setClosable(true);
    }

    public show(): Promise<void>
    {
        return new Promise<void>((resolve, reject) => 
        {
            this.openWindow(700, 400, "progress.html", null, {
                resizable: false,
                modal: true,
                autoHideMenuBar: true,
                closable: false,
                minimizable: false,
                maximizable: false,
                parent: workspace_window.browserWindow
            }, (browserWindow: BrowserWindow) => {
                browserWindow.webContents.send('init');
            });
    
            this.browserWindow.webContents.once("did-finish-load", () => {
                resolve();
            });
        })
    }

}