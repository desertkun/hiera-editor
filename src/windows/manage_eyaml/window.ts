
import { Window } from "../window"
import { workspace_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";

export class ManageEYamlWindow extends Window
{
    private changed: string;
    private readonly publicKey: string;
    private readonly havePublicKey: boolean;

    constructor (publicKey: string, havePublicKey: boolean)
    {
        super();

        this.changed = null;
        this.publicKey = publicKey;
        this.havePublicKey = havePublicKey;
    }

    public show(): Promise<string>
    {
        return new Promise<string>((resolve, reject) => {

            this.openWindow(700, 500, "manage_eyaml.html", null, {
                resizable: false,
                modal: true,
                autoHideMenuBar: true,
                parent: workspace_window.browserWindow
            }, (browserWindow: BrowserWindow) => {
                browserWindow.webContents.send('init', this.publicKey, this.havePublicKey); 
            });
    
            ipcMain.on("updated", (event: any, publicKey: string) => 
            {
                this.changed = publicKey;
            });

            this.onClosed = () => {
                ipcMain.removeAllListeners("updated");
                resolve(this.changed);
            };
        })
    }

}