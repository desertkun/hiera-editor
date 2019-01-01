
import { ProjectsModel } from "./projects"
import { ProjectsWindow } from "./windows/projects/window"
import { WorkspaceWindow } from "./windows/workspace/window"
import { CreateEnvironmentWindow } from "./windows/create_environment/window"
import { puppet } from "./puppet"
import { Menu } from "electron";

export const projects_list: ProjectsModel = new ProjectsModel();
export const projects_window: ProjectsWindow = new ProjectsWindow();
export const workspace_window: WorkspaceWindow = new WorkspaceWindow();

export let workspace_menu: Menu;
export let projects_menu: Menu;

let current_workspace: puppet.Workspace;

function initMenu()
{
    workspace_menu = Menu.buildFromTemplate([
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'New Environment',
                    async click () 
                    { 
                        const window = new CreateEnvironmentWindow();

                        const env = await window.show();
                        if (env == null)
                            return;

                        const workspace: puppet.Workspace = getCurrentWorkspace();
                        if (workspace == null)
                            return;

                        const success = await workspace.createEnvironment(env);
                        if (!success)
                            return;

                        workspace_window.browserWindow.webContents.send('refresh');
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {role: 'toggledevtools'}
            ]
        },
        {
            role: 'window',
            submenu: [
                {role: 'minimize'},
                {role: 'close'}
            ]
        }
    ]);

    projects_menu = Menu.buildFromTemplate([
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'New Project',
                    click () 
                    { 
                        //
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {role: 'toggledevtools'}
            ]
        },
        {
            role: 'window',
            submenu: [
                {role: 'minimize'},
                {role: 'close'}
            ]
        }
    ]);

    Menu.setApplicationMenu(projects_menu);
}

export function init()
{
    initMenu();
    projects_list.load();
}

export function getCurrentWorkspace(): puppet.Workspace
{
    return current_workspace;
}

export function setCurrentWorkspace(workspace: puppet.Workspace)
{
    current_workspace = workspace;
}