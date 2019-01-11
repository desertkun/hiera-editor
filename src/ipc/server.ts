
import { dialog, OpenDialogOptions, Menu } from "electron";
import { projects_list, projects_window, workspace_window, setCurrentWorkspace, getCurrentWorkspace, workspace_menu } from "../global"
import { AssignClassWindow } from "../windows/assign_class/window"
import { CreateResourceWindow } from "../windows/create_resource/window"
import { CreateEnvironmentWindow } from "../windows/create_environment/window"
import { CreateProjectWindow } from "../windows/create_project/window"
import { ProgressWindow } from "../windows/progress/window"
import { ProjectsModel, ProjectModel } from "../projects"
import { isDirectory, listFiles } from "../async"

import { Workspace } from "../puppet/workspace";
import { Environment } from "../puppet/environment";
import { Node } from "../puppet/files";

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
        Menu.setApplicationMenu(workspace_menu);
        projects_window.close();
    }

    public async createProject(): Promise<void>
    {
        const window = new CreateProjectWindow();
        const [path,env] = await window.show();

        if (!await isDirectory(path))
        {
            throw new Error("Please choose an empty directory");
        }

        const files = await listFiles(path);

        if (files.length > 0)
        {
            throw new Error("Please choose an empty directory");
        }

        if (!await projects_list.createProject(path, env))
        {
            throw new Error("Failed to create a new project");
        }

        await this.openProject(path);
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
        const workspace: Workspace = getCurrentWorkspace();

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
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }

        const environment: Environment = await workspace.getEnvironment(name);

        if (environment == null)
        {
            return null;
        }

        return await environment.root.tree();
    }

    public async findNode(localPath: string): Promise<any> 
    {
        const workspace: Workspace = getCurrentWorkspace();

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
        const workspace: Workspace = getCurrentWorkspace();

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
    
    public async acquireNodeResource(nodePath: string, definedTypeName: string, title: string): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }

        const node = await workspace.findNode(nodePath);

        if (node == null)
        {
            return null;
        }

        return await node.dumpResource(definedTypeName, title);
    }

    public async setNodeClassProperty(
        nodePath: string, className: string, propertyName: string, value: any
    ): Promise<any> 
    {
        const workspace: Workspace = getCurrentWorkspace();

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
    
    public async hasNodeClassProperty(nodePath: string, className: string, propertyName: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return false;
        }
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
        {
            return false;
        }
    
        return await node.hasClassProperty(className, propertyName);
    }

    public async removeNodeClassProperty(
        nodePath: string, className: string, propertyName: string
    ): Promise<any> 
    {
        const workspace: Workspace = getCurrentWorkspace();

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

    public async setNodeResourceProperty(nodePath: string, definedTypeName: string, title: string, propertyName: string, value: any): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
        {
            return null;
        }
    
        return await node.setResourceProperty(definedTypeName, title, propertyName, value);
    }

    public async removeNodeResourceProperty(nodePath: string, definedTypeName: string, title: string, propertyName: string): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
        {
            return null;
        }
    
        return await node.removeResourceProperty(definedTypeName, title, propertyName);
    }

    public async removeNodeClassProperties(nodePath: string, className: string): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
        {
            return null;
        }
    
        return await node.removeClassProperties(className);
    }

    public async getClassInfo(env: string): Promise<any> 
    {
        const workspace: Workspace = getCurrentWorkspace();

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

    public async initWorkspace(): Promise<any> 
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }

        await workspace.init((progress: number) => {
            workspace_window.browserWindow.webContents.send("refreshWorkspaceProgress", progress);
        }, (text: string, showProgress: boolean) => {
            workspace_window.browserWindow.webContents.send("refreshWorkspaceCategory", text, showProgress);
        });
    }

    public showOpenDirectoryDialog(defaultPath?: string, mode: Array<'openDirectory' | 'createDirectory' | 'promptToCreate'> = ['openDirectory']): Promise<any> 
    {
        return new Promise<string>((resolve, reject) => 
        {
            const options: OpenDialogOptions = {
                'defaultPath': defaultPath,
                'properties': mode
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
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return null;

        return workspace.path;
    }
    
    public async assignNewClassToNode(nodePath: string): Promise<string>
    {
        const workspace: Workspace = getCurrentWorkspace();

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

    public async chooseDefinedType(nodePath: string): Promise<string>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return null;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return null;
    
        const window = new CreateResourceWindow(nodePath);
        const result = await window.show();
        return result;
    }

    public async createNewResourceToNode(nodePath: string, definedTypeName: string, title: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return false;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return false;
    
        return await node.createResource(definedTypeName, title);
    }
    
    public async removeClassFromNode(nodePath: string, className: string): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;

        await node.removeClass(className);
    }
    
    public async removeResourceFromNode(nodePath: string, definedTypeName: string, title: string): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;

        await node.removeResource(definedTypeName, title);
    }

    public async removeResourcesFromNode(nodePath: string, definedTypeName: string): Promise<string[]>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;

        return await node.removeResources(definedTypeName);
    }
    
    public async removeAllResourcesFromNode(nodePath: string): Promise<any[]>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;

        return await node.removeAllResources();
    }

    public async renameNodeResource(nodePath: string, definedTypeName: string, title: string, newTitle: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;

        return await node.renameResource(definedTypeName, title, newTitle);
    }

    public async removeClassesFromNode(nodePath: string): Promise<Array<string>>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;

        return await node.removeAllClasses();
    }

    public async searchClasses(nodePath: string, search: string): Promise<any[]>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return [];
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return [];

        return await node.env.searchClasses(search);
    }

    public async searchDefinedTypes(nodePath: string, search: string): Promise<any[]>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return [];
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return [];

        return await node.env.searchDefinedTypes(search);
    }
    
    public async acquireNodeFacts(nodePath: string): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return null;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return null;

        return await node.acquireFacts();
    }

    public async setNodeFact(nodePath: string, fact: string, value: string): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;
            
        await node.setFact(fact, value);
    }

    public async updateNodeFacts(nodePath: string, facts: any): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;
            
        await node.updateFacts(facts);
    }

    public async invalidateNode(nodePath: string): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;
            
        await node.invalidate();
    }

    public async invalidateNodeClass(nodePath: string, className: string): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;
            
        await node.invalidateClass(className);
    }

    public async invalidateNodeResource(nodePath: string, definedTypeName: string, title: string): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;
            
        await node.invalidateDefinedType(definedTypeName, title);
    }
    
    public async isNodeClassValid(nodePath: string, className: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;
            
        return await node.isClassValid(className);
    }

    public async isNodeDefinedTypeValid(nodePath: string, definedTypeName: string, title: string): Promise<boolean>
    {
        
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(nodePath);
    
        if (node == null)
            return;
            
        return await node.isDefinedTypeValid(definedTypeName, title);
    }
    
    public async createFolder(path: string, name: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const directory = await workspace.findFolder(path);
    
        if (directory == null)
            return;

        return await directory.createFolder(name) != null;
    }

    public async createNode(path: string, name: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const directory = await workspace.findFolder(path);
    
        if (directory == null)
            return;

        return await directory.createNode(name) != null;
    }

    public async removeFolder(path: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const directory = await workspace.findFolder(path);
    
        if (directory == null)
            return;

        return await directory.remove();
    }

    public async removeNode(path: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return;
    
        const node = await workspace.findNode(path);
    
        if (node == null)
            return;

        return await node.remove();
    }
    
    public async removeEnvironment(name: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return false;
    
        return await workspace.removeEnvironment(name);
    }

    public async getGlobalModules(): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return false;
    
        return await workspace.getGlobalModules();
    }

    public async getEnvironmentModules(env: string): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
            return false;
    
        return await workspace.getEnvironmentModules(env);
    }

    public async createEnvironment(): Promise<boolean>
    {
        const window = new CreateEnvironmentWindow();

        const env = await window.show();
        if (env == null)
            return;

        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return;

        return await workspace.createEnvironment(env);
    }
    
    public async installModules(): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return;
            
        const progress = new ProgressWindow();
        await progress.show();

        try
        {
            const hadAny = await workspace.installModules((text: string) => 
            {
                progress.notifyProgressUpdate(text);
            });

            if (hadAny)
            {
                progress.close();
            }
            else
            {
                throw new Error("Puppetfile wasn't found. Please place Puppetfile in the root of your project, or in the environment folder.");
            }
        }
        catch (e)
        {
            if (e.hasOwnProperty("title"))
            {
                progress.notifyProgressError(e.title, e.message);
            }
            else
            {
                progress.notifyProgressError("Failed to process the workspace", e.message);
            }
        }
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