
import { dialog, OpenDialogOptions } from "electron";
import register from "electron-ipc-tunnel/server";
import { projects_list, projects_window, workspace_window, setCurrentWorkspace, getCurrentWorkspace } from "../global"
import { ProjectsModel, ProjectModel } from "../projects"
import { puppet } from "../puppet"

register("add-project", async function(reply: any, path: string)
{
    return await projects_list.addProject(path);
});

register("open-project", async function(reply: any, path: string)
{
    const project: ProjectModel = projects_list.getProject(path);

    if (project == null)
        throw new Error("No such project: " + path);

    setCurrentWorkspace(project.workspace);
    workspace_window.show(path);
    projects_window.close();
});

register("get-projects-list", async function(reply: any)
{
    const projects: Array<ProjectModel> = projects_list.list;
    const result: any = [];

    for (let project of projects)
    {
        if (!project.workspace)
            continue;
        
        result.push({
            "name": project.workspace.name,
            "path": project.path
        })
    }

    return result
});

register("get-environments-list", async function(reply: any)
{
    const workspace: puppet.Workspace = getCurrentWorkspace();

    if (workspace == null)
    {
        return [];
    }

    const names: string[] = [];

    for (const env of await workspace.listEnvironments())
    {
        names.push(env.name);
    }

    return names;
});

register("get-environment-tree", async function(reply: any, name: string): Promise<any>
{
    const workspace: puppet.Workspace = getCurrentWorkspace();

    if (workspace == null)
    {
        return null;
    }

    const environment: puppet.Environment = await workspace.getEnvironment(name);

    if (environment == null)
    {
        return null;
    }

    return await environment.root.tree();
});

register("find-node", async function(reply: any, localPath: string): Promise<any>
{
    const workspace: puppet.Workspace = getCurrentWorkspace();

    if (workspace == null)
    {
        return null;
    }

    const node = await workspace.findNode(localPath);

    if (node == null)
    {
        return null;
    }

    await node.refresh();

    return node.dump();
});

register("refresh-workspace", async function(reply: any): Promise<any>
{
    const workspace: puppet.Workspace = getCurrentWorkspace();

    if (workspace == null)
    {
        return null;
    }

    await workspace.refresh();
});

register("show-open-directory-dialog", function(reply: any, defaultPath?: string)
{
    return new Promise<string>((resolve, reject) => 
    {
        const options: OpenDialogOptions = {
            'defaultPath': defaultPath,
            'properties': ['openDirectory']
        };
    
        dialog.showOpenDialog(options, (filePaths: string[]) =>
        {
            if (filePaths)
            {
                resolve(filePaths[0]);
            }
            else
            {
                resolve(null);
            }
        });
    });
});

register("get-current-workspace-path", async function()
{
    const workspace: puppet.Workspace = getCurrentWorkspace();

    if (workspace == null)
        return null;

    return workspace.path;
});
