
import { Window } from "../window"
import { workspace_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";

export class ManagePropertyHierarchyWindow extends Window
{
    private changed: boolean;
    private readonly environment: string;
    private readonly certname: string;
    private readonly property: string;
    private readonly hierarchy: any[];
    private readonly _constructor: string;

    constructor (environment: string, certname: string, property: string, hierarchy: any[], _constructor: string)
    {
        super();

        this.changed = false;
        this.environment = environment;
        this.certname = certname;
        this.property = property;
        this.hierarchy = hierarchy;
        this._constructor = _constructor;
    }

    public show(): Promise<boolean>
    {
        return new Promise<boolean>((resolve, reject) => {

            this.openWindow(600, 400, "manage_property_hierarchy.html", null, {
                resizable: false,
                modal: true,
                autoHideMenuBar: true,
                parent: workspace_window.browserWindow
            }, (browserWindow: BrowserWindow) => {
                browserWindow.webContents.send('init', this.environment, this.certname, 
                    this.property, this.hierarchy, this._constructor);
            });
    
            ipcMain.on("hierarchy-changed", (event: any) => 
            {
                this.changed = true;
            });

            this.onClosed = () => {
                ipcMain.removeAllListeners("hierarchy-changed");
                resolve(this.changed);
            };
        })
    }

}