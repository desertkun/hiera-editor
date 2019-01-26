
import { Window } from "../window"
import { workspace_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";

export class EnterPasswordWindow extends Window
{
    private password: string;
    private readonly title: string;
    private readonly description: string;

    constructor (title: string, description: string)
    {
        super();

        this.password = null;
        this.title = title;
        this.description = description;
    }

    public show(): Promise<string>
    {
        const zis = this;

        return new Promise<string>((resolve, reject) => {

            this.openWindow(500, 180, "enter_password.html", null, {
                resizable: false,
                modal: true,
                autoHideMenuBar: true,
                parent: workspace_window.browserWindow
            }, (browserWindow: BrowserWindow) => {
                browserWindow.webContents.send('init', this.title, this.description);
            });
    
            ipcMain.on("updated", (event: any, password: string) => 
            {
                zis.password = password;
            });

            this.onClosed = () => {
                ipcMain.removeAllListeners("updated");
                resolve(this.password);
            };
        })
    }

}