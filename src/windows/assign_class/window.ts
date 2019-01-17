
import { Window } from "../window"
import { workspace_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";
import { throws } from "assert";

export class AssignClassWindow extends Window
{
    private selected: boolean;
    private readonly environment: string;
    private readonly certname: string;

    constructor (environment: string, certname: string)
    {
        super();

        this.selected = false;
        this.environment = environment;
        this.certname = certname;
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
                browserWindow.webContents.send('init', this.environment, this.certname);
            });
    
            ipcMain.on("class-selected", (event: any, className: string) => 
            {
                if (className != null)
                {
                    this.selected = true;
                    resolve(className);
                }

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