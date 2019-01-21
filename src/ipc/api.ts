
import { ClassDump, ResourceDump, EnvironmentTreeDump } from "./objects"

export interface IpcAPI
{
    addProject(path: string): Promise<boolean>;
    openProject(path: string): Promise<void>;
    createProject(): Promise<void>;
    getProjectList(): Promise<any>;
    getEnvironmentList(): Promise<string[]>;
    getEnvironmentTree(name: string): Promise<EnvironmentTreeDump>;
    findFile(localPath: string): Promise<any>;
    acquireNodeClass(environment: string, certname: string, className: string): Promise<ClassDump>;
    hasNodeClassProperty(environment: string, certname: string, className: string, propertyName: string): Promise<boolean>;
    setNodeClassProperty(environment: string, certname: string, hierarchy: number, className: string, propertyName: string, value: any): Promise<any>;
    setNodeProperty(environment: string, certname: string, hierarchy: number, property: string, value: any): Promise<any>;
    removeNodeProperty(environment: string, certname: string, hierarchy: number, propertyName: string): Promise<any>;
    removeNodeClassProperty(environment: string, certname: string, hierarchy: number, className: string, propertyName: string): Promise<any>;
    removeNodeClassProperties(environment: string, certname: string, className: string): Promise<any>;
    invalidateNodeClass(environment: string, certname: string, className: string): Promise<void>;
    getClassInfo(env: string): Promise<any>;
    initWorkspace(): Promise<any>;
    showOpenDirectoryDialog(defaultPath?: string, mode?: Array<'openDirectory' | 'createDirectory' | 'promptToCreate'>): Promise<string>;
    getCurrentWorkspacePath(): Promise<string>;
    assignNewHieraClass(environment: string, certname: string, includeName: string, hierarchy: number): Promise<string>;
    managePropertyHierarchy(environment: string, certname: string, property: string, _constructor: string): Promise<boolean>;
    searchClasses(environment: string, certname: string, search: string): Promise<any[]>;
    searchDefinedTypes(environment: string, certname: string, search: string): Promise<any[]>;
    removeHieraClassFromNode(environment: string, certname: string, key: string, hierarchy: number, className: string): Promise<void>;
    removeHieraClasses(environment: string, certname: string, includeName: string): Promise<Array<string>>;
    acquireNodeResource(environment: string, certname: string, definedTypeName: string, title: string): Promise<ResourceDump>;
    setNodeResourceProperty(environment: string, certname: string, hierarchy: number, key: string, definedTypeName: string, title: string, propertyName: string, value: any): Promise<boolean>;
    removeNodeResourceProperty(environment: string, certname: string, hierarchy: number, key: string, definedTypeName: string, title: string, propertyName: string): Promise<boolean>;
    removeResourceFromNode(environment: string, certname: string, key: string, hierarchy: number, definedTypeName: string, title: string): Promise<boolean>;
    renameNodeResource(environment: string, certname: string, key: string, hierarchy: number, definedTypeName: string, title: string, newTitle: string): Promise<boolean>;
    removeResourcesFromNode(environment: string, certname: string, key: string, hierarchy: number, definedTypeName: string): Promise<boolean>;
    chooseDefinedType(environment: string, certname: string): Promise<string>;
    createNewResourceToNode(environment: string, certname: string, key: string, hierarchy: number, definedTypeName: string, title: string): Promise<any>;
    removeAllResourcesFromNode(environment: string, certname: string, key: string, hierarchy: number): Promise<boolean>;
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
    checkAuthentication(): Promise<void>;
}
