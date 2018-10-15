
import { ProjectsModel } from "./projects"
import { ProjectsWindow } from "./windows/projects/window"
import { WorkspaceWindow } from "./windows/workspace/window"
import { puppet } from "./puppet"

export const projects_list: ProjectsModel = new ProjectsModel();
export const projects_window: ProjectsWindow = new ProjectsWindow();
export const workspace_window: WorkspaceWindow = new WorkspaceWindow();

let current_workspace: puppet.Workspace;

export function init()
{
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