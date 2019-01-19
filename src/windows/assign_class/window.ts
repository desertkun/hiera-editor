
import { Window } from "../window"
import { workspace_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";
import { throws } from "assert";

export class AssignClassWindow extends Window
{
    private selected: boolean;
    private readonly environment: string;
    private readonly certname: string;
    private readonly hierarchy: number;
    private readonly nodeHierarchy: any;
    private readonly includeName: string;

    constructor (environment: string, certname: string, hierarchy: number, nodeHierarchy: any, includeName: string)
    {
        super();

        this.selected = false;
        this.environment = environment;
        this.certname = certname;
        this.hierarchy = hierarchy;
        this.nodeHierarchy = nodeHierarchy;
        this.includeName = includeName;
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
                browserWindow.webContents.send('init', this.environment, this.certname,
                     this.hierarchy, this.nodeHierarchy, this.includeName);
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