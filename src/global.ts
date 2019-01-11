
import { ProjectsModel } from "./projects"
import { ProjectsWindow } from "./windows/projects/window"
import { WorkspaceWindow } from "./windows/workspace/window"
import { Menu } from "electron";
import { Workspace } from "./puppet/workspace"

export const projects_list: ProjectsModel = new ProjectsModel();
export const projects_window: ProjectsWindow = new ProjectsWindow();
export const workspace_window: WorkspaceWindow = new WorkspaceWindow();

export let workspace_menu: Menu;
export let projects_menu: Menu;

let current_workspace: Workspace;

function initMenu()
{
    workspace_menu = Menu.buildFromTemplate([
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

export function getCurrentWorkspace(): Workspace
{
    return current_workspace;
}

export function setCurrentWorkspace(workspace: Workspace)
{
    current_workspace = workspace;
}