
import { dialog, OpenDialogOptions } from "electron";
import { projects_list, projects_window, workspace_window, setCurrentWorkspace, getCurrentWorkspace } from "../global"
import { AssignClassWindow } from "../windows/assign_class/window"
import { ProjectsModel, ProjectModel } from "../projects"
import { puppet } from "../puppet"

import register from "electron-ipc-tunnel/server";
import { IpcAPI } from "./api"

export class IpcServer implements IpcAPI
{
    public async addProject(path: string): Promise<boolean>
    {
        return await projects_list.addProject(path);
    }

    public async openProject(path: string): Promise<void> 
    {
        const project: ProjectModel = projects_list.getProject(path);

        if (project == null)
            throw new Error("No such project: " + path);

        setCurrentWorkspace(project.workspace);
        workspace_window.show(path);
        projects_window.close();
    }

    public async getProjectList(): Promise<any> 
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
    }

    public async getEnvironmentList(): Promise<string[]> 
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
    }

    public async getEnvironmentTree(name: string): Promise<any> 
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
    }

    public async findNode(localPath: string): Promise<any> 
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

        return node.dump();
    }

    public async acquireNodeClass(nodePath: string, className: string): Promise<any> 
    {
        const workspace: puppet.Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }

        const node = await workspace.findNode(nodePath);

        if (node == null)
        {
            return null;
        }

        return await node.dumpClass(className);
    }

    public async setNodeClassProperty(
        nodePath: string, className: string, propertyName: string, value: any
    ): Promise<any> 
    {
        const workspace: puppet.Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
        {
            return null;
        }
    
        return await node.setClassProperty(className, propertyName, value);
    }

    public async removeNodeClassProperty(
        nodePath: string, className: string, propertyName: string
    ): Promise<any> 
    {
        const workspace: puppet.Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
        {
            return null;
        }
    
        return await node.removeClassProperty(className, propertyName);
    }

    public async getClassInfo(env: string): Promise<any> 
    {
        const workspace: puppet.Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }

        const environment = await workspace.getEnvironment(env);

        if (environment == null)
        {
            return null;
        }

        return environment.getClassInfo();
    }

    public async refreshWorkspace(): Promise<any> 
    {
        const workspace: puppet.Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }

        await workspace.refresh((progress: number) => {
            workspace_window.browserWindow.webContents.send("refreshWorkspaceProgress", progress);
        }, (text: string) => {
            workspace_window.browserWindow.webContents.send("refreshWorkspaceCategory", text);
        });
    }

    public showOpenDirectoryDialog(defaultPath?: string): Promise<any> 
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
    }

    public async getCurrentWorkspacePath(): Promise<string> 
    {
        const workspace: puppet.Workspace = getCurrentWorkspace();

        if (workspace == null)
            return null;

        return workspace.path;
    }
    
    public async assignNewClassToNode(nodePath: string): Promise<string>
    {
        const workspace: puppet.Workspace = getCurrentWorkspace();

        if (workspace == null)
            return null;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return null;
    
        const window = new AssignClassWindow(nodePath);
        const className = await window.show();

        if (!className)
            return null;

        await node.assignClass(className);

        return className;
    }
    
    public async removeClassFromNode(nodePath: string, className: string): Promise<void>
    {
        const workspace: puppet.Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;

        await node.removeClass(className);
    }

    public async searchClasses(nodePath: string, search: string): Promise<any[]>
    {
        const workspace: puppet.Workspace = getCurrentWorkspace();

        if (workspace == null)
            return [];
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return [];

        return await node.env.searchClasses(search);
    }
}

const server: IpcServer = new IpcServer();

for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(server)))
{
    if (methodName == "constructor")
        continue;

    register(methodName, (receive: any, ...args: any[]) =>
    {
        return (server as any)[methodName].apply(server, args);
    });
}