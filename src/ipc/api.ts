
export interface IpcAPI
{
    addProject(path: string): Promise<boolean>;
    openProject(path: string): Promise<void>;
    createProject(): Promise<void>;
    getProjectList(): Promise<any>;
    getEnvironmentList(): Promise<string[]>;
    getEnvironmentTree(name: string): Promise<any>;
    findFile(localPath: string): Promise<any>;
    acquireNodeClass(environment: string, certname: string, className: string): Promise<any>;
    hasNodeClassProperty(environment: string, certname: string, className: string, propertyName: string): Promise<boolean>;
    setNodeClassProperty(environment: string, certname: string, hierarchy: number, className: string, propertyName: string, value: any): Promise<any>;
    removeNodeClassProperty(environment: string, certname: string, hierarchy: number, className: string, propertyName: string): Promise<any>;
    removeNodeClassProperties(environment: string, certname: string, className: string): Promise<any>;
    invalidateNodeClass(environment: string, certname: string, className: string): Promise<void>;
    getClassInfo(env: string): Promise<any>;
    initWorkspace(): Promise<any>;
    showOpenDirectoryDialog(defaultPath?: string, mode?: Array<'openDirectory' | 'createDirectory' | 'promptToCreate'>): Promise<string>;
    getCurrentWorkspacePath(): Promise<string>;
    assignNewClassToNode(environment: string, certname: string): Promise<string>;
    searchClasses(environment: string, certname: string, search: string): Promise<any[]>;
    searchDefinedTypes(environment: string, certname: string, search: string): Promise<any[]>;
    removeClassFromNode(environment: string, certname: string, className: string): Promise<void>;
    removeClassesFromNode(environment: string, certname: string): Promise<Array<string>>;
    acquireNodeResource(environment: string, certname: string, definedTypeName: string, title: string): Promise<any>;
    setNodeResourceProperty(environment: string, certname: string, hierarchy: number, definedTypeName: string, title: string, propertyName: string, value: any): Promise<boolean>;
    removeNodeResourceProperty(environment: string, certname: string, hierarchy: number, definedTypeName: string, title: string, propertyName: string): Promise<boolean>;
    removeResourceFromNode(environment: string, certname: string, definedTypeName: string, title: string): Promise<void>;
    renameNodeResource(environment: string, certname: string, definedTypeName: string, title: string, newTitle: string): Promise<boolean>;
    removeResourcesFromNode(environment: string, certname: string, definedTypeName: string): Promise<string[]>;
    invalidateNodeResource(environment: string, certname: string, definedTypeName: string, title: string): Promise<void>;
    chooseDefinedType(environment: string, certname: string): Promise<string>;
    createNewResourceToNode(environment: string, certname: string, definedTypeName: string, title: string): Promise<any>;
    removeAllResourcesFromNode(environment: string, certname: string): Promise<any[]>;
    acquireNodeFacts(environment: string, certname: string): Promise<any>;
    invalidateNode(environment: string, certname: string): Promise<void>;
    isNodeClassValid(environment: string, certname: string, className: string): Promise<boolean>;
    isNodeDefinedTypeValid(environment: string, certname: string, definedTypeName: string, title: string): Promise<boolean>;
    removeEnvironment(name: string): Promise<boolean>;
    getGlobalModules(): Promise<any>;
    getEnvironmentModules(env: string): Promise<any>;
    createEnvironment(): Promise<boolean>;
    installModules(): Promise<void>;
    publishCSR(server: string, certname: string): Promise<string>;
    downloadSignedCertificate(): Promise<void>;
}
