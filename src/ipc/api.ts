
export interface IpcAPI
{
    addProject(path: string): Promise<boolean>;
    openProject(path: string): Promise<void>;
    getProjectList(): Promise<any>;
    getEnvironmentList(): Promise<string[]>;
    getEnvironmentTree(name: string): Promise<any>;
    findNode(localPath: string): Promise<any>;
    acquireNodeClass(nodePath: string, className: string): Promise<any>;
    setNodeClassProperty(nodePath: string, className: string, propertyName: string, value: any): Promise<any>;
    removeNodeClassProperty(nodePath: string, className: string, propertyName: string): Promise<any>;
    getClassInfo(env: string): Promise<any>;
    refreshWorkspace(): Promise<any>;
    showOpenDirectoryDialog(defaultPath?: string): Promise<string>;
    getCurrentWorkspacePath(): Promise<string>;
}
