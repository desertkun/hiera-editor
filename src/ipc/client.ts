import IpcClient from "electron-ipc-tunnel/client";

export class Ipc extends IpcClient
{
    public getProjectList(): Promise<Array<any>>
    {
        return this.send("get-projects-list");
    }

    public addProject(path: string): Promise<any>
    {
        return this.send("add-project", path);
    }

    public openProject(path: string): Promise<any>
    {
        return this.send("open-project", path);
    }

    public getEnvironmentList(): Promise<string[]>
    {
        return this.send("get-environments-list");
    }

    public refreshWorkspace(): Promise<any>
    {
        return this.send("refresh-workspace");
    }

    public findNode(nodePath: string): Promise<any>
    {
        return this.send("find-node", nodePath);
    }

    public acquireNodeClass(nodePath: string, className: string): Promise<any>
    {
        return this.send("acquire-node-class", nodePath, className);
    }

    public getClassInfo(env: string): Promise<any>
    {
        return this.send("get-class-info", env);
    }

    public getEnvironmentTree(environment: string): Promise<any>
    {
        return this.send("get-environment-tree", environment);
    }

    public getCurrentWorkspacePath(): Promise<string>
    {
        return this.send("get-current-workspace-path");
    }

    public showOpenDirectoryDialog(defaultPath?: string): Promise<string>
    {
        return this.send("show-open-directory-dialog", defaultPath);
    }
}

export const ipc: Ipc = new Ipc();