
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
    removeNodeClassProperties(nodePath: string, className: string): Promise<any>;
    getClassInfo(env: string): Promise<any>;
    refreshWorkspace(): Promise<any>;
    showOpenDirectoryDialog(defaultPath?: string): Promise<string>;
    getCurrentWorkspacePath(): Promise<string>;
    assignNewClassToNode(nodePath: string): Promise<string>;
    searchClasses(nodePath: string, search: string): Promise<any[]>;
    searchDefinedTypes(nodePath: string, search: string): Promise<any[]>;
    removeClassFromNode(nodePath: string, className: string): Promise<void>;
    removeClassesFromNode(nodePath: string): Promise<Array<string>>;
    acquireNodeResource(nodePath: string, definedTypeName: string, title: string): Promise<any>;
    setNodeResourceProperty(nodePath: string, definedTypeName: string, title: string, propertyName: string, value: any): Promise<any>;
    removeNodeResourceProperty(nodePath: string, definedTypeName: string, title: string, propertyName: string): Promise<any>;
    removeResourceFromNode(nodePath: string, definedTypeName: string, title: string): Promise<void>;
    renameNodeResource(nodePath: string, definedTypeName: string, title: string, newTitle: string): Promise<boolean>;
    removeResourcesFromNode(nodePath: string, definedTypeName: string): Promise<string[]>;
    chooseDefinedType(nodePath: string): Promise<string>;
    createNewResourceToNode(nodePath: string, definedTypeName: string, title: string): Promise<any>;
    removeAllResourcesFromNode(nodePath: string): Promise<any[]>;
    acquireNodeFacts(nodePath: string): Promise<any>;
    setNodeFact(nodePath: string, fact: string, value: string): Promise<void>;
    updateNodeFacts(nodePath: string, facts: any): Promise<void>;
    invalidateNode(nodePath: string): Promise<void>;
    isNodeClassValid(nodePath: string, className: string): Promise<boolean>;
    isNodeDefinedTypeValid(nodePath: string, definedTypeName: string, title: string): Promise<boolean>;
    createFolder(path: string, name: string): Promise<boolean>;
    createNode(path: string, name: string): Promise<boolean>;
    removeFolder(path: string): Promise<boolean>;
    removeNode(path: string): Promise<boolean>;
    removeEnvironment(name: string): Promise<boolean>;
    getGlobalModules(): Promise<any>;
    getEnvironmentModules(env: string): Promise<any>;
    createEnvironment(): Promise<boolean>;
}
