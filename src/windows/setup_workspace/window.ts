
import { Window } from "../window"
import { workspace_window } from "../../global"
import { BrowserWindow, ipcMain } from "electron";
import { WorkspaceSettings } from "../../puppet/workspace_settings";
import { WorkspaceError } from "../../puppet/util";

export class SetupWorkspaceWindow extends Window
{
    private readonly workspaceSettings: WorkspaceSettings;
    private valid: boolean;

    constructor (workspaceSettings: WorkspaceSettings)
    {
        super();

        this.workspaceSettings = workspaceSettings;
    }

    public show(): Promise<void>
    {
        return new Promise<void>((resolve, reject) => 
        {
            this.openWindow(600, 620, "setup_workspace.html", null, 
            {
                resizable: false,
                modal: true,
                autoHideMenuBar: true,
                minimizable: false,
                maximizable: false,
                parent: workspace_window.browserWindow
            }, (browserWindow: BrowserWindow) => 
            {
                browserWindow.webContents.send('init', this.workspaceSettings.server, this.workspaceSettings.certname);
            });

            ipcMain.on("setup-complete", (event: any) => 
            {
                this.valid = true;
                this.close();
            });

            this.onClosed = () => 
            {
                ipcMain.removeAllListeners("setup-complete");

                if (this.valid)
                {
                    resolve();
                }
                else
                {
                    reject(new WorkspaceError("Failed to setup workspace", 
                        "You need to setup the workspace in order to use Hiera Editor"));
                }
            };
        })
    }

}