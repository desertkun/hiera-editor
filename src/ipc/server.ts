
import { dialog, OpenDialogOptions, Menu } from "electron";
import { projects_list, projects_window, workspace_window, setCurrentWorkspace, getCurrentWorkspace, workspace_menu } from "../global"
import { AssignClassWindow } from "../windows/assign_class/window"
import { CreateResourceWindow } from "../windows/create_resource/window"
import { CreateEnvironmentWindow } from "../windows/create_environment/window"
import { CreateProjectWindow } from "../windows/create_project/window"
import { ProgressWindow } from "../windows/progress/window"
import { ManagePropertyHierarchyWindow } from "../windows/manage_property_hierarchy/window"
import { ProjectModel } from "../projects"
import { isDirectory, listFiles } from "../async"
import { Workspace } from "../puppet/workspace";
import { Environment } from "../puppet/environment";
import register from "electron-ipc-tunnel/server";
import { IpcAPI } from "./api"
import { WorkspaceSettings } from "../puppet/workspace_settings";
import { Ruby } from "../puppet/ruby";
import { WorkspaceError } from "../puppet/util";
import { ClassDump, ResourceDump, EnvironmentTreeDump } from "./objects";

export class IpcServer implements IpcAPI
{
    public async addProject(path: string): Promise<boolean>
    {
        return await projects_list.addProject(path);
    }

    public async openProject(path: string, offline: boolean): Promise<void> 
    {
        const project: ProjectModel = projects_list.getProject(path);

        if (project == null)
            throw new Error("No such project: " + path);

        if (offline)
        {
            project.workspace.setOfflineMode();
        }

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

    public async getEnvironmentTree(name: string): Promise<EnvironmentTreeDump> 
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

        return await environment.tree();
    }

    public async findFile(localPath: string): Promise<any> 
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            return null;
        }

        const node = await workspace.findFile(localPath);

        if (node == null)
        {
            return null;
        }

        return node.dump();
    }

    public async acquireNodeClass(environment: string, certname: string, className: string): Promise<ClassDump> 
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return null;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return null;

        const node = env.getNode(certname);    
        if (node == null)
            return null;
            
        return await node.dumpClass(className);
    }
    
    public async acquireNodeResource(environment: string, certname: string, definedTypeName: string, title: string): Promise<ResourceDump>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return null;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return null;

        const node = env.getNode(certname);    
        if (node == null)
            return null;
            
        return await node.dumpResource(definedTypeName, title);
    }

    public async setNodeProperty(environment: string, certname: string, 
        hierarchy: number, property: string, value: any): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return null;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return null;

        const node = env.getNode(certname);    
        if (node == null)
            return null;
    
        return await node.setProperty(hierarchy, property, value);
    }

    public async setNodeClassProperty(
        environment: string, certname: string, hierarchy: number, 
        className: string, propertyName: string, value: any
    ): Promise<any> 
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return null;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return null;

        const node = env.getNode(certname);    
        if (node == null)
            return null;
    
        return await node.setClassProperty(className, hierarchy, propertyName, value);
    }
    
    public async hasNodeClassProperty(environment: string, certname: string, 
        className: string, propertyName: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;
    
        return await node.hasClassProperty(className, propertyName);
    }

    public async removeNodeProperty(environment: string, certname: string, hierarchy: number, propertyName: string): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;
    
        return await node.removeProperty(hierarchy, propertyName);
    }

    public async removeNodeClassProperty(
        environment: string, certname: string, hierarchy: number, className: string, propertyName: string
    ): Promise<any> 
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;
    
        return await node.removeClassProperty(className, hierarchy, propertyName);
    }

    public async setNodeResourceProperty(environment: string, certname: string, 
        hierarchy: number, key: string, definedTypeName: string, 
        title: string, propertyName: string, value: any): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;
    
        return await node.setResourceProperty(definedTypeName, title, hierarchy, key, propertyName, value);
    }

    public async removeNodeResourceProperty(
        environment: string, certname: string, 
        hierarchy: number, key: string, definedTypeName: string, 
        title: string, propertyName: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;
    
        return await node.removeResourceProperty(definedTypeName, title, hierarchy, key, propertyName);
    }

    public async removeNodeClassProperties(environment: string, certname: string, className: string): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;
    
        //return await node.removeClassProperties(className);
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
    
    public async assignNewHieraClass(environment: string, certname: string, includeName: string, hierarchy: number): Promise<string>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return null;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return null;

        const node = env.getNode(certname);    
        if (node == null)
            return null;

        const nodeHierarchy = node.hierarchy.get(hierarchy);
        if (nodeHierarchy == null)
            return;
    
        const window = new AssignClassWindow(environment, certname, hierarchy, {
            "name": nodeHierarchy.entry.name,
            "path": nodeHierarchy.path
        }, includeName);
        const className = await window.show();

        if (!className)
            return null;

        await node.assignClass(includeName, className, hierarchy);

        return className;
    }
    
    public async managePropertyHierarchy(environment: string, certname: string, property: string, _constructor: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return null;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return null;

        const node = env.getNode(certname);    
        if (node == null)
            return null;

        const hierarchy: any[] = [];

        for (const entry of node.hierarchy.hierarhy)
        {
            hierarchy.push({
                name: entry.entry.name,
                path: entry.path,
                eyaml: entry.eyaml,
                defined: entry.isPropertyDefined(property)
            })
        }

        const window = new ManagePropertyHierarchyWindow(environment, certname, property, hierarchy, _constructor);
        return await window.show();
    }

    public async chooseDefinedType(environment: string, certname: string): Promise<string>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return null;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return null;

        const node = env.getNode(certname);    
        if (node == null)
            return null;
    
        const window = new CreateResourceWindow(environment, certname);
        const result = await window.show();
        return result;
    }

    public async createNewResourceToNode(environment: string, certname: string, 
        key: string, hierarchy: number, definedTypeName: string, title: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;
    
        return await node.createResource(key, hierarchy, definedTypeName, title);
    }
    
    public async removeHieraClassFromNode(environment: string, certname: string, 
        key: string, hierarchy: number,  className: string): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return;

        const node = env.getNode(certname);    
        if (node == null)
            return;

        await node.removeClass(key, className, hierarchy);
    }
    
    public async removeResourceFromNode(environment: string, certname: string, 
        key: string, hierarchy: number, definedTypeName: string, title: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return;

        const node = env.getNode(certname);    
        if (node == null)
            return;

        return await node.removeResource(key, hierarchy, definedTypeName, title);
    }
    

    public async removeResourcesFromNode(environment: string, certname: string, 
        key: string, hierarchy: number, definedTypeName: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return;

        const node = env.getNode(certname);    
        if (node == null)
            return;

        return await node.removeResources(key, hierarchy, definedTypeName);
    }
    
    public async removeAllResourcesFromNode(environment: string, certname: string, 
        key: string, hierarchy: number): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return;

        const node = env.getNode(certname);    
        if (node == null)
            return;

        return await node.removeAllResources(key, hierarchy);
    }

    public async renameNodeResource(environment: string, certname: string, 
        key: string, hierarchy: number,
        definedTypeName: string, title: string, newTitle: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;

        return await node.renameResource(key, hierarchy, definedTypeName, title, newTitle);
    }

    public async removeHieraClasses(environment: string, certname: string, includeName: string): Promise<Array<string>>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return null;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return null;

        const node = env.getNode(certname);    
        if (node == null)
            return null;

        //return await node.removeAllClasses(includeName);
    }

    public async searchClasses(environment: string, certname: string, search: string): Promise<any[]>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return [];

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return [];

        const node = env.getNode(certname);    
        if (node == null)
            return [];

        return await node.env.searchClasses(search);
    }

    public async searchDefinedTypes(environment: string, certname: string, search: string): Promise<any[]>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return [];

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return [];

        const node = env.getNode(certname);    
        if (node == null)
            return [];

        return await node.env.searchDefinedTypes(search);
    }
    
    public async acquireNodeFacts(environment: string, certname: string): Promise<any>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return null;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return null;

        const node = env.getNode(certname);    
        if (node == null)
            return null;

        //return await node.acquireFacts();
    }

    public async invalidateNode(environment: string, certname: string): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return;

        const node = env.getNode(certname);    
        if (node == null)
            return;
            
        await node.invalidate();
    }

    public async invalidateNodeClass(environment: string, certname: string, className: string): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return;

        const node = env.getNode(certname);    
        if (node == null)
            return;
            
        await node.invalidateClass(className);
    }
    
    public async isNodeClassValid(environment: string, certname: string, className: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;
            
        return await node.isClassValid(className);
    }

    public async isNodeDefinedTypeValid(environment: string, certname: string, definedTypeName: string, title: string): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;
            
        return await node.isResourceValid(definedTypeName, title);
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
    
    public async publishCSR(server: string, certname: string): Promise<string>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            throw new WorkspaceError("Failed to publich CRS", "No workspace");
        }
            
        return await workspace.publishCSR(server, certname);
    }
    
    public async downloadSignedCertificate(): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            throw new WorkspaceError("Failed to publich CRS", "No workspace");
        }
            
        await workspace.downloadSignedCertificate();
    }

    public async checkAuthentication(): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            throw new WorkspaceError("Failed to publich CRS", "No workspace");
        }
            
        await workspace.checkAuthentication();
    }

    public async ignoreNode(cername: string): Promise<void>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            throw new WorkspaceError("Failed to publich CRS", "No workspace");
        }
            
        await workspace.addNodeToIgnoreList(cername);
    }
    
    public async clearIgnoreNodeList(): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();

        if (workspace == null)
        {
            throw new WorkspaceError("Failed to publich CRS", "No workspace");
        }
            
        return await workspace.clearNodeIgnoreList();
    }
    
    public async isEYamlKeysImported(environment: string, certname: string, hierarchy: number): Promise<boolean>
    {
        const workspace: Workspace = getCurrentWorkspace();
        if (workspace == null)
            return false;

        const env = await workspace.getEnvironment(environment);
        if (env == null)
            return false;

        const node = env.getNode(certname);    
        if (node == null)
            return false;

        return await node.isEYamlKeysImported(hierarchy);
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