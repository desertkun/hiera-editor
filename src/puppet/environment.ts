
import * as async from "../async";
import * as path from "path";
import * as os from "os";

import { Dictionary } from "../dictionary";
import { Workspace } from "./workspace"
import { PuppetModulesInfo } from "./modules_info"
import { Folder } from "./files"
import { PuppetClassInfo, PuppetDefinedTypeInfo, PuppetFunctionInfo } from "./class_info"
import { Ruby } from "./ruby"
import { CompiledPromisesCallback } from "./util"

const PromisePool = require('es6-promise-pool');

export class Environment
{
    private readonly _name: string;
    private readonly _path: string;
    private readonly _cachePath: string;
    private readonly _root: Folder;
    private readonly _workspace: Workspace;
    private readonly _global: Dictionary<string, string>;
    private _modulesInfo: PuppetModulesInfo;

    constructor(workspace: Workspace, name: string, path: string, cachePath: string)
    {
        this._name = name;
        this._workspace = workspace;
        this._path = path;
        this._cachePath = cachePath;
        this._root = new Folder(this, "data", this.dataPath, name, null);

        this._global = new Dictionary();
        this._global.put("environment", name);
    }

    public get global()
    {
        return this._global;
    }

    public get root(): Folder
    {
        return this._root;
    }

    public get workspace(): Workspace
    {
        return this._workspace;
    }

    public async searchClasses(search: string): Promise<any[]>
    {
        const results: Array<any> = [];

        this._modulesInfo.searchClasses(search, results);
        this._workspace.modulesInfo.searchClasses(search, results)

        return results;
    }

    public async searchDefinedTypes(search: string): Promise<any[]>
    {
        const results: Array<any> = [];

        this._modulesInfo.searchDefinedTypes(search, results);
        this._workspace.modulesInfo.searchDefinedTypes(search, results)

        return results;
    }

    public findClassInfo(className: string): PuppetClassInfo
    {
        if (this._modulesInfo)
        {
            const localClassInfo = this._modulesInfo.findClass(className);

            if (localClassInfo)
                return localClassInfo;
        }

        return this._workspace.modulesInfo.findClass(className);
    }
    
    public findDefineTypeInfo(definedTypeName: string): PuppetDefinedTypeInfo
    {
        if (this._modulesInfo)
        {
            const localClassInfo = this._modulesInfo.findDefinedType(definedTypeName);

            if (localClassInfo)
                return localClassInfo;
        }

        return this._workspace.modulesInfo.findDefinedType(definedTypeName);
    }

    public findFunctionInfo(className: string): PuppetFunctionInfo
    {
        if (this._modulesInfo)
        {
            const localFunctionInfo = this._modulesInfo.findFunction(className);

            if (localFunctionInfo)
                return localFunctionInfo;
        }

        return this._workspace.modulesInfo.findFunction(className);
    }

    public async create()
    {
        if (!await async.isDirectory(this.dataPath))
            await async.createDirectory(this.dataPath);
            
        if (!await async.isDirectory(this.modulesPath))
            await async.createDirectory(this.modulesPath);
        
        if (!await async.isDirectory(this.manifestsPath))
            await async.createDirectory(this.manifestsPath);
    }

    public get dataPath(): string
    {
        return path.join(this._path, "data");
    }

    public get name():string 
    {
        return this._name;
    }

    public get path():string 
    {
        return this._path;
    }

    private get cachePath(): string
    {
        return path.join(this._cachePath, "env-" + this.name);
    }

    private get cacheModulesFilePath(): string
    {
        return path.join(this.cachePath, "modules.json");
    }

    private get manifestsPath(): string
    {
        return path.join(this.path, "manifests");
    }

    private get modulesPath(): string
    {
        return path.join(this.path, "modules");
    }

    public getClassInfo(): any
    {
        const classes: any = {};
        const types: any = {};

        const globalClassInfo = this._workspace.modulesInfo.dump(classes, types);
        if (this._modulesInfo) this._modulesInfo.dump(classes, types);

        return {
            "classes": classes,
            "types": types
        }
    }

    public async installModules(callback: any): Promise<boolean>
    {
        return await Workspace.InstallModules(this._path, callback);
    }

    public async init(progressCallback: any = null, updateProgressCategory: any = null): Promise<any>
    {
        if (!await async.isDirectory(this.cachePath))
        {
            if (!await async.makeDirectory(this.cachePath))
            {
                throw "Failed to create cache directory";
            }
        }

        if (await async.isFile(path.join(this._path, "Puppetfile")) &&
            !await async.isDirectory(this.modulesPath))
        {
            await this.installModules(updateProgressCategory);   
        }

        if (await async.isDirectory(this.modulesPath))
        {
            let upToDate: boolean = false;

            const b = this.cacheModulesFilePath;
            const bStat = await async.fileStat(b);
            if (bStat) {
                const mTime: Number = bStat.mtimeMs;
                const recentTime: Number = await async.mostRecentFileTime(this.modulesPath);

                if (recentTime <= mTime) {
                    // cache is up to date
                    upToDate = true;
                }

            }

            if (!upToDate) {
                const a = JSON.stringify([
                    "*/manifests/**/*.pp", "*/functions/**/*.pp", "*/types/**/*.pp", "*/lib/**/*.rb"
                ]);

                await Ruby.Call("puppet-strings.rb", [a, b], this.modulesPath);
            }
        }

        const modulesInfo = await this.loadModulesInfo();
        if (modulesInfo != null)
        {
            const promiseCallback = new CompiledPromisesCallback();
            const modulesInfoPromises = await modulesInfo.generateCompilePromises(promiseCallback);
            const originalPoolSize: number = modulesInfoPromises.length;

            function* promiseProducer()
            {
                for (const p of modulesInfoPromises)
                {
                    const f = p[0];
                    p.splice(0, 1);
                    yield f.apply(f, p);
                }
            }

            const logicalCpuCount = Math.max(os.cpus().length - 1, 1);
            const pool = new PromisePool(promiseProducer, logicalCpuCount);

            if (progressCallback)
            {
                promiseCallback.callback = (done: number) =>
                {
                    if (originalPoolSize != 0)
                    {
                        const progress: number = done / originalPoolSize;
                        progressCallback(progress);
                    }
                };
            }
        }
    }

    private async loadModulesInfo(): Promise<PuppetModulesInfo>
    {
        if (!await async.isFile(this.cacheModulesFilePath))
        {
            return null;
        }

        const data: any = await async.readJSON(this.cacheModulesFilePath);
        this._modulesInfo = new PuppetModulesInfo(this.modulesPath, this.cachePath, data);
        return this._modulesInfo;
    }

    public async getModules(): Promise<any>
    {
        const modulesPath = this.modulesPath;

        if (!await async.isDirectory(modulesPath))
            return {};

        const files = await async.listFiles(modulesPath);

        const result: any = {};

        for (const file of files)
        {
            const modulePath = path.join(modulesPath, file);
            const metadataPath = path.join(modulePath, "metadata.json");
            const manifestsPath = path.join(modulePath, "manifests");
            const filesPath = path.join(modulePath, "files");

            if (await async.isFile(metadataPath) ||
                await async.isDirectory(manifestsPath) ||
                await async.isDirectory(filesPath) )
            {
                result[file] = {};
            }
        }

        return result;
    }
}