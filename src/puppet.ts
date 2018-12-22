import * as process from "process";
import * as path from "path";
import * as os from "os";

import * as async from "./async";

import {Dictionary} from "./dictionary";
const slash = require('slash');
const PromisePool = require('es6-promise-pool');

import {PuppetASTParser, PuppetASTClass, PuppetASTDefinedType, PuppetASTResolvedDefinedType, Resolver} from "./puppet/ast";
import { throws } from "assert";

export module puppet
{
    export class Ruby
    {
        public static Path(): string
        {
            if (process.platform == "darwin")
            {
                return require('traveling-ruby-osx');
            }

            if (process.platform == "win32")
            {
                return require('traveling-ruby-win32');
            }
            
            if (process.platform == "linux")
            {
                return require('traveling-ruby-linux-x86_64');
            }

            return null;
        }

        public static async Call(script: string, args: Array<string>, cwd: string): Promise<boolean>
        {
            const rubyScript = require('app-root-path').resolve(path.join("ruby", script));

            const argsTotal = [];

            argsTotal.push(rubyScript);

            for (let arg of args)
            {
                argsTotal.push(arg);
            }
        
            try
            {
                await async.execFile(Ruby.Path(), argsTotal, cwd);
                return true;
            }
            catch (e)
            {
                console.log("Failed to execute " + script + ": " + e);
                return false;
            }
        }

        public static CallInOut(script: string, args: Array<string>, cwd: string, data: string): Promise<string>
        {
            const rubyScript = require('app-root-path').resolve(path.join("ruby", script));

            const argsTotal = [];

            argsTotal.push(rubyScript);

            for (let arg of args)
            {
                argsTotal.push(arg);
            }

            return async.execFileInOut(Ruby.Path(), argsTotal, cwd, data);
        }
    }

    class PuppetClassInfo
    {
        public readonly name: string;
        private readonly info: any;
        private readonly _options: any;
        private readonly _tags: any;
        private readonly _description: string;
        private readonly _modules: PuppetModulesInfo;

        constructor(name: string, info: any, modules: PuppetModulesInfo)
        {
            this.name = name;
            this.info = info;
            this._modules = modules;
            this._options = {};
            this._tags = {};

            const docstring = info["docstring"];
            if (docstring)
            {
                this._description = docstring["text"];

                const tags = docstring["tags"];
                if (tags)
                {
                    for (const tag of tags)
                    {
                        const tag_name = tag["tag_name"];
                        const name = tag["name"];

                        if (tag_name == "option" && name == "editor")
                        {
                            this._options[tag["opt_name"]] = tag["opt_text"];
                        }

                        const text = tag["text"];
                        if (text)
                        {
                            if (this._tags[tag_name] == null)
                                this._tags[tag_name] = {};

                            this._tags[tag_name][name] = text;
                        }
                    }
                }
            }
            else
            {
                this._description = "";
            }
        }

        public get file(): string
        {
            return this.info["file"];
        }

        public get fields(): Array<string>
        {
            return Object.keys(this.info["defaults"] || {});
        }

        public get description(): string
        {
            return this._description;
        }

        public get options(): any
        {
            return this._options;
        }

        public get tags(): any
        {
            return this._tags;
        }

        public get source(): string
        {
            return this.info["source"];
        }

        public get modulesInfo(): PuppetModulesInfo
        {
            return this._modules;
        }

        public dump()
        {
            return {
                "name": this.name,
                "file": this.info["file"],
                "fields": this.fields,
                "inherits": this.info["inherits"],
                "description": this.description,
                "options": this.options,
                "tags": this.tags
            }
        }
    }

    class PuppetDefinedTypeInfo
    {
        public readonly name: string;
        private readonly info: any;
        private readonly _tags: any;
        private readonly _options: any;
        private readonly _description: string;
        private readonly _modules: PuppetModulesInfo;

        constructor(name: string, info: any, modules: PuppetModulesInfo)
        {
            this.name = name;
            this.info = info;
            this._modules = modules;
            this._options = {};
            this._tags = {};

            const docstring = info["docstring"];
            if (docstring)
            {
                this._description = docstring["text"];

                const tags = docstring["tags"];
                if (tags)
                {
                    for (const tag of tags)
                    {
                        const tag_name = tag["tag_name"];
                        const name = tag["name"];

                        if (tag_name == "option" && name == "editor")
                        {
                            this._options[tag["opt_name"]] = tag["opt_text"];
                        }

                        const text = tag["text"];
                        if (text)
                        {
                            if (this._tags[tag_name] == null)
                                this._tags[tag_name] = {};

                            this._tags[tag_name][name] = text;
                        }
                    }
                }
            }
            else
            {
                this._description = "";
            }
        }

        public get modulesInfo(): PuppetModulesInfo
        {
            return this._modules;
        }

        public get source(): string
        {
            return this.info["source"];
        }

        public get fields(): Array<string>
        {
            return Object.keys(this.info["defaults"] || {});
        }

        public get description(): string
        {
            return this._description;
        }

        public get options(): any
        {
            return this._options;
        }

        public get tags(): any
        {
            return this._tags;
        }

        public get file(): string
        {
            return this.info["file"];
        }

        public dump()
        {
            return {
                "name": this.name,
                "file": this.info["file"],
                "fields": this.fields,
                "inherits": this.info["inherits"],
                "description": this.description,
                "options": this.options,
                "tags": this.tags
            }
        }
    }

    class CompiledPromisesCallback
    {
        public callback: any;
        public done: number;

        constructor()
        {
            this.done = 0;
        }
    }

    export class PuppetError extends Error {}
    export class WorkspaceError extends PuppetError {}
    export class NoSuchEnvironmentError extends PuppetError {}
    export class CompilationError extends PuppetError {}

    export class PuppetModulesInfo
    {
        private readonly _cachePath: string;
        private readonly _modulesPath: string;
        private readonly _classes: Dictionary<string, PuppetClassInfo>;
        private readonly _definedTypes: Dictionary<string, PuppetDefinedTypeInfo>;

        constructor(modulesPath: string, cachePath: string, data: any)
        {
            this._modulesPath = modulesPath;
            this._cachePath = cachePath;
            this._classes = new Dictionary();
            this._definedTypes = new Dictionary();

            for (const puppetClass of data["puppet_classes"])
            {
                const name: string = puppetClass["name"];
                this._classes.put(name, new PuppetClassInfo(name, puppetClass, this));
            }

            for (const definedType of data["defined_types"])
            {
                const name: string = definedType["name"];
                this._definedTypes.put(name, new PuppetDefinedTypeInfo(name, definedType, this));
            }
        }

        public getCompiledClassPath(fileName: string)
        {
            return path.join(this._cachePath, "obj", fileName + ".o");
        }

        public async searchClasses(search: string, results: Array<any>): Promise<void>
        {
            for (const puppetClass of this._classes.getValues())
            {
                if (puppetClass.name.indexOf(search) >= 0 ||
                    puppetClass.description.indexOf(search) >= 0 ||
                    puppetClass.file.indexOf(search) >= 0)
                {
                    results.push(puppetClass.dump());
                }
            }

            results.sort((a: any, b: any) => 
            {
                return a.name.localeCompare(b.name);
            })
        }

        public async searchDefinedTypes(search: string, results: Array<any>): Promise<void>
        {
            for (const puppetDefinedType of this._definedTypes.getValues())
            {
                if (puppetDefinedType.name.indexOf(search) >= 0 ||
                    puppetDefinedType.description.indexOf(search) >= 0 ||
                    puppetDefinedType.file.indexOf(search) >= 0)
                {
                    results.push(puppetDefinedType.dump());
                }
            }

            results.sort((a: any, b: any) => 
            {
                return a.name.localeCompare(b.name);
            })
        }

        public async generateCompilePromises(cb: CompiledPromisesCallback): Promise<Array<any>>
        {
            const result: Array<any> = [];
            const classes = this.classes.getValues();
            const definedTypes = this.definedTypes.getValues();

            const _cachedStats: any = {};
            const _realStats: any = {};

            for (let clazz of classes)
            {
                const file = this.getCompiledClassPath(clazz.file);
                const realFile = path.join(this._modulesPath, clazz.file);

                _cachedStats[clazz.file] = async.fileStat(file);
                _realStats[clazz.file] = async.fileStat(realFile);
            }

            for (let definedType of definedTypes)
            {
                const file = this.getCompiledClassPath(definedType.file);
                const realFile = path.join(this._modulesPath, definedType.file);

                _cachedStats[definedType.file] = async.fileStat(file);
                _realStats[definedType.file] = async.fileStat(realFile);
            }

            const cachedStats = await async.PromiseAllObject(_cachedStats);
            const realStats = await async.PromiseAllObject(_realStats);

            for (let clazz of classes)
            {
                const file = path.join(this._cachePath, "obj", clazz.file + ".o");
                const realFile = path.join(this._modulesPath, clazz.file);

                if (cachedStats[clazz.file])
                {
                    const cachedStat = cachedStats[clazz.file];
                    const cachedTime: Number = cachedStat.mtimeMs;

                    const realStat = realStats[clazz.file];
                    const realTime: Number = realStat.mtimeMs;

                    if (cachedTime >= realTime)
                    {
                        // compiled file is up-to-date
                        continue;
                    }
                }

                try
                {
                    async function compile(file: string, modulesPath: string, source: string)
                    {
                        console.log("Compiling " + file + "...");

                        try
                        {
                            await puppet.Ruby.CallInOut("puppet-parser.rb", [file], modulesPath, source);
                            console.log("Compiling " + file + " done!");
                        }
                        catch (e)
                        {
                            console.log("Failed to compile " + file + ": " + e);
                        }

                        cb.done += 1;

                        if (cb.callback) cb.callback(cb.done);
                    }

                    result.push([compile, file, this._modulesPath, clazz.source]);
                }
                catch (e) {
                    console.log(e);
                }
            }

            for (let definedType of definedTypes)
            {
                const file = path.join(this._cachePath, "obj", definedType.file + ".o");
                const realFile = path.join(this._modulesPath, definedType.file);

                if (cachedStats[definedType.file])
                {
                    const cachedStat = cachedStats[definedType.file];
                    const cachedTime: Number = cachedStat.mtimeMs;

                    const realStat = realStats[definedType.file];
                    const realTime: Number = realStat.mtimeMs;

                    if (cachedTime >= realTime)
                    {
                        // compiled file is up-to-date
                        continue;
                    }
                }

                try
                {
                    async function compile(file: string, modulesPath: string, source: string)
                    {
                        console.log("Compiling " + file + "...");

                        try
                        {
                            await puppet.Ruby.CallInOut("puppet-parser.rb", [file], modulesPath, source);
                            console.log("Compiling " + file + " done!");
                        }
                        catch (e)
                        {
                            console.log("Failed to compile " + file + ": " + e);
                        }

                        cb.done += 1;

                        if (cb.callback) cb.callback(cb.done);
                    }

                    result.push([compile, file, this._modulesPath, definedType.source]);
                }
                catch (e) {
                    console.log(e);
                }
            }

            return result;
        }

        public get classes(): Dictionary<string, PuppetClassInfo>
        {
            return this._classes;
        }

        public get definedTypes(): Dictionary<string, PuppetDefinedTypeInfo>
        {
            return this._definedTypes;
        }

        public get modulesPath(): string
        {
            return this._modulesPath;
        }

        public get cachePath(): string
        {
            return this._cachePath;
        }

        public findClass(className: string): PuppetClassInfo
        {
            return this._classes.get(className);
        }

        public findDefinedType(definedTypeName: string): PuppetDefinedTypeInfo
        {
            return this._definedTypes.get(definedTypeName);
        }

        public dump(classes: any, types: any)
        {
            for (const _c of this._classes.getValues())
            {
                classes[_c.name] = _c.dump();
            }

            for (const _t of this._definedTypes.getValues())
            {
                types[_t.name] = _t.dump();
            }
        }
    }

    export class Workspace
    {
        private readonly _path: string;
        private _name: string;
        private _environments: Dictionary<string, Environment>;
        private _modulesInfo: PuppetModulesInfo;

        private readonly _cachePath: string;
        private readonly _global: Dictionary<string, string>;

        constructor(workspacePath: string, cachePath: string = null)
        {
            this._environments = new Dictionary();
            this._path = workspacePath;
            this._cachePath = cachePath || path.join(this._path, ".pe-cache");
            this._global = new Dictionary();
        }

        public get global()
        {
            return this._global;
        }

        public get cachePath(): string
        {
            return this._cachePath;
        }

        public get path():string 
        {
            return this._path;
        }

        public get modulesInfo(): PuppetModulesInfo
        {
            return this._modulesInfo;
        }

        public async findNode(path: string): Promise<Node>
        {
            const entries = path.split("/");

            if (entries.length < 2)
                return null;

            const environment = entries[0];
            const env: Environment = await this.getEnvironment(environment);
            if (env == null)
                return null;
            entries.splice(0, 1);
            return await env.root.findNode(entries);
        }

        public get modulesPath(): string
        {
            return path.join(this._path, "modules");
        }

        public get cacheModulesFilePath(): string
        {
            return path.join(this.cachePath, "modules.json");
        }

        public get name():string 
        {
            return this._name;
        }

        public async refresh(progressCallback: any = null, updateProgressCategory: any = null): Promise<any>
        {
            if (!await async.isDirectory(this.path))
            {
                throw new WorkspaceError("Workspace path does not exist");
            }

            if (!await async.isDirectory(this.cachePath))
            {
                if (!await async.makeDirectory(this.cachePath))
                {
                    throw new WorkspaceError("Failed to create cache directory");
                }
            }

            let upToDate: boolean = false;

            if (updateProgressCategory) updateProgressCategory("Processing classes...");

            const bStat = await async.fileStat(this.cacheModulesFilePath);
            if (bStat)
            {
                const mTime: Number = bStat.mtimeMs;
                const recentTime: Number = await async.mostRecentFileTime(this.modulesPath);

                if (recentTime <= mTime)
                {
                    // cache is up to date
                    upToDate = true;
                }

            }

            if (!upToDate)
            {
                if (updateProgressCategory) updateProgressCategory("Extracting class info...");

                const a = JSON.stringify([
                    "*/manifests/**/*.pp", "*/functions/**/*.pp", "*/types/**/*.pp", "*/lib/**/*.rb"
                ]);

                await puppet.Ruby.Call("puppet-strings.rb", [a, this.cacheModulesFilePath], this.modulesPath);
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
                        yield p[0](p[1], p[2], p[3]);
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

                if (updateProgressCategory) updateProgressCategory("Compiling classes...");

                await pool.start();
            }

            for (const env of await this.listEnvironments())
            {
                if (updateProgressCategory) updateProgressCategory("Processing environment: " + env.name);
                await env.refresh(progressCallback)
            }
        }

        private async loadModulesInfo(): Promise<PuppetModulesInfo>
        {
            if (this._modulesInfo)
                return this._modulesInfo;

            if (!await async.isFile(this.cacheModulesFilePath))
            {
                return null;
            }

            const data: any = await async.readJSON(this.cacheModulesFilePath);
            this._modulesInfo = new PuppetModulesInfo(this.modulesPath, this.cachePath, data);
            return this._modulesInfo;
        }

        public async getEnvironment(name: string): Promise<Environment>
        {
            const environmentsPath = path.join(this._path, "environments");

            if (!await async.isDirectory(environmentsPath))
            {
                throw new WorkspaceError("Workspace does not have environments folder")
            }

            const environmentPath = path.join(environmentsPath, name);

            if (!await async.isDirectory(environmentsPath))
            {
                throw new NoSuchEnvironmentError("Environment " + name + " does not exists");
            }

            return this.acquireEnvironment(name, environmentPath, this.cachePath);
        }

        private acquireEnvironment(name: string,  environmentPath: string, cachePath: string): Environment
        {
            if (this._environments.has(name))
            {
                return this._environments.get(name);
            }

            const newEnv = new Environment(this, name, environmentPath, cachePath);
            this._environments.put(name, newEnv);
            return newEnv;
        }

        public async listEnvironments(): Promise<Array<Environment>>
        {
            const environmentsPath = path.join(this._path, "environments");

            if (!await async.fileExists(environmentsPath))
            {
                return [];
            }

            const dirs: string[] = await async.listFiles(environmentsPath);
            const result: Array<Environment> = [];

            for (const envName of dirs)
            {
                const envPath: string = path.join(environmentsPath, envName);

                if (!await async.isDirectory(envPath))
                    continue;

                const env: Environment = this.acquireEnvironment(envName, envPath, this.cachePath);
                result.push(env);
            }

            return result;
        }

        public async validate()
        {
            const environmentsPath = path.join(this._path, "environments");

            if (!await async.fileExists(environmentsPath))
            {
                throw new Error("The path does not appear to be a puppet root code folder. " +
                                 "The puppet root code folder should contain the \"environments\" folder inside.");
            }

            const confPath = path.join(this._path, "environment.conf");

            if (!await async.fileExists(confPath))
            {
                throw new Error("The path does not appear to be a puppet root code folder. " +
                                 "The puppet root code folder should contain the \"environment.conf\" file inside.");
            }
        }

        public async load()
        {
            await this.validate();

            const workspaceFilePath = path.join(this._path, "workspace.json");

            const exists: boolean = await async.fileExists(workspaceFilePath);
            if (!exists)
            {
                this._name = path.basename(this._path);
                return true;
            }
            
            let data;

            try
            {
                data = await async.readJSON(workspaceFilePath);
            }
            catch (e)
            {
                return new Error("Failed to load workspace: " + e.message);
            }

            if (!data)
            {
                return new Error("Failed to load workspace: corrupted.");
            }

            this._name = data["name"];

            return (this._name != null);
        }

        public dump(): any
        {
            return {
                "name": this._name
            }
        }
    }
    
    export type GlobalVariableResolver = (key: string) => string;

    export class ResolvedResource
    {
        public definedType: PuppetASTDefinedType;
        public resource: PuppetASTResolvedDefinedType;
    }

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
            this._root = new Folder(this, "data", this.dataPath, name);

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

        public async refresh(progressCallback: any = null): Promise<any>
        {
            if (!await async.isDirectory(this.cachePath))
            {
                if (!await async.makeDirectory(this.cachePath))
                {
                    throw "Failed to create cache directory";
                }
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

                    await puppet.Ruby.Call("puppet-strings.rb", [a, b], this.modulesPath);
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
                        yield p[0](p[1], p[2], p[3]);
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
    }


    export class Folder
    {
        private readonly _name: string;
        private readonly _path: string;
        private readonly _env: Environment;
        private readonly _localPath: string;

        private readonly _nodes: Dictionary<string, Node>;
        private readonly _folders: Dictionary<string, Folder>;

        constructor(env: Environment, name: string, path: string, localPath: string)
        {
            this._env = env;
            this._name = name;
            this._path = path;
            this._localPath = localPath;

            this._nodes = new Dictionary();
            this._folders = new Dictionary();
        }

        public async findNode(localPath: Array<string>): Promise<Node>
        {
            if (localPath.length > 1)
            {
                const dir = await this.getFolder(localPath[0]);
                localPath.splice(0, 1);
                return await dir.findNode(localPath);
            }

            return await this.getNode(localPath[0]);
        }

        public async tree(): Promise<any>
        {
            const folders: any = [];

            for (const folder of await this.getFolders())
            {
                folders.push(await folder.tree());
            }

            const nodes: any = [];

            for (const node of await this.getNodes())
            {
                nodes.push({
                    "name": node.name,
                    "path": node.path,
                    "localPath": node.localPath
                });
            }

            return {
                "name": this._name,
                "folders": folders,
                "nodes": nodes
            };
        }

        private acquireFolder(env: Environment, name: string, path: string, localPath: string): Folder
        {
            if (this._folders.has(name))
            {
                return this._folders.get(name);
            }

            const newFolder = new Folder(env, name, path, localPath);
            this._folders.put(name, newFolder);
            return newFolder;
        }

        private async acquireNode(env: Environment, name: string, filePath: string, nodePath: string): Promise<Node>
        {
            if (this._nodes.has(name))
            {
                return this._nodes.get(name);
            }

            const newNode = new Node(env, name, filePath, nodePath);
            this._nodes.put(name, newNode);
            await newNode.init();
            return newNode;
        }

        public async getNode(name: string): Promise<Node>
        {
            const entryPath = path.join(this._path, Node.NodePath(name));

            if (!await async.isFile(entryPath))
            {
                return null;
            }

            return await this.acquireNode(this._env, name, entryPath, slash(path.join(this._localPath, name)));
        }

        public async getFolder(name: string): Promise<Folder>
        {
            const entryPath = path.join(this._path, name);

            if (!await async.isDirectory(entryPath))
            {
                return null;
            }

            return this.acquireFolder(this._env, name, entryPath, slash(path.join(this._localPath, name)));
        }

        public async getFolders(): Promise<Array<Folder>>
        {
            if (!await async.fileExists(this._path))
            {
                return [];
            }

            if (!await async.isDirectory(this._path))
            {
                return [];
            }

            const result:Array<Folder> = [];

            for (const entry of await async.listFiles(this._path))
            {
                const entryPath = path.join(this._path, entry);

                if (await async.isDirectory(entryPath))
                {
                    result.push(this.acquireFolder(
                        this._env, entry, entryPath, slash(path.join(this._localPath, entry))));
                }
            }

            return result;
        }

        public async getNodes(): Promise<Array<Node>>
        {
            if (!await async.fileExists(this._path))
            {
                return [];
            }

            if (!await async.isDirectory(this._path))
            {
                return [];
            }

            const result:Array<Node> = [];

            for (const entry of await async.listFiles(this._path))
            {
                const nodeName = Node.ValidatePath(entry);

                if (nodeName == null)
                    continue;

                const entryPath = path.join(this._path, entry);

                if (await async.isFile(entryPath))
                {
                    result.push(await this.acquireNode(
                        this._env, nodeName, entryPath, slash(path.join(this._localPath, nodeName))));
                }
            }

            return result;
        }

        public get name():string
        {
            return this._name;
        }

        public get path():string
        {
            return this._path;
        }

        public get localPath():string
        {
            return this._localPath;
        }
    }

    export class Node
    {
        private readonly _name: string;
        private readonly _filePath: string;
        private readonly _nodePath: string;
        private readonly _env: Environment;
        private _config: any;
        private _facts: any;

        private readonly _compiledClasses: Dictionary<string, PuppetASTClass>;
        private readonly _compiledResources: Dictionary<string, Dictionary<string, ResolvedResource>>;

        constructor(env: Environment, name: string, filePath: string, nodePath: string)
        {
            this._env = env;
            this._name = name;
            this._filePath = filePath;
            this._nodePath = nodePath;
            this._config = {};
            this._facts = {};

            this._compiledClasses = new Dictionary();
            this._compiledResources = new Dictionary();
        }

        static NodePath(name: string): string
        {
            return name + ".yaml";
        }

        static ValidatePath(pathName: string): string
        {
            if (!pathName.endsWith(".yaml"))
                return null;

            return pathName.substr(0, pathName.length - 5);
        }

        public async isClassValid(className: string): Promise<boolean>
        {
            return this._compiledClasses.has(className);
        }

        public async isDefinedTypeValid(definedTypeName: string, title: string): Promise<boolean>
        {
            if (this._compiledResources.has(definedTypeName))
            {
                const titles = this._compiledResources.get(definedTypeName);

                return titles.has(title);
            }

            return false;
        }

        public async invalidate(): Promise<void>
        {
            this._compiledClasses.clear();
            this._compiledResources.clear();
        }

        public static fixClassName(className: string): string
        {
            const path = className.split("::");
        
            if (path.length < 2)
                return className;

            if (path[0] == "")
                path.splice(0, 1);

            return path.join("::");
        }
        
        public async resolveClass(className: string, global: GlobalVariableResolver): Promise<PuppetASTClass>
        {
            className = Node.fixClassName(className);

            if (this._compiledClasses.has(className))
            {
                return this._compiledClasses.get(className);
            }

            const zis = this;
            console.log("Compiling class " + className + " (for environment " + this._name + ")");

            const classInfo = this.env.findClassInfo(className);

            if (classInfo == null)
                throw new CompilationError("No such class info: " + className);

            const compiledPath = classInfo.modulesInfo.getCompiledClassPath(classInfo.file);
            let parsedJSON = null;

            try
            {
                parsedJSON = await async.readJSON(compiledPath);
            }
            catch (e)
            {
                throw new CompilationError("Failed to parse class " + className);
            }

            const obj = PuppetASTParser.Parse(parsedJSON);

            if (!(obj instanceof PuppetASTClass))
                throw "Not a class";

            const clazz: PuppetASTClass = obj;

            try
            {
                await clazz.resolve(clazz, new class extends Resolver
                {
                    public resolveClass(className: string): Promise<PuppetASTClass>
                    {
                        return zis.resolveClass(className, global);
                    }

                    public async resolveGlobalVariable(name: string): Promise<string>
                    {
                        return global(name);
                    }
                });
            }
            catch (e)
            {
                console.log(e);
                throw new CompilationError("Failed to compile class: " + e);
            }

            this._compiledClasses.put(className, clazz);
            return clazz;
        }

        public async resolveResource(definedTypeName: string, title: string, properties: any, global: GlobalVariableResolver): Promise<ResolvedResource>
        {
            if (this._compiledResources.has(definedTypeName))
            {
                const titles = this._compiledResources.get(definedTypeName);

                if (titles.has(title))
                {
                    return titles.get(title);
                }
            }

            const zis = this;
            console.log("Compiling resource " + definedTypeName + " (with title " + title + " for environment " + this._name + ")");

            const definedTypeInfo = this.env.findDefineTypeInfo(definedTypeName);

            if (definedTypeInfo == null)
                throw new CompilationError("No such defined type info: " + definedTypeName);

            const compiledPath = definedTypeInfo.modulesInfo.getCompiledClassPath(definedTypeInfo.file);
            let parsedJSON = null;

            try
            {
                parsedJSON = await async.readJSON(compiledPath);
            }
            catch (e)
            {
                throw new CompilationError("Failed to parse defined type " + definedTypeName);
            }

            const obj = PuppetASTParser.Parse(parsedJSON);

            if (!(obj instanceof PuppetASTDefinedType))
                throw "Not a defined type";

            const definedType: PuppetASTDefinedType = obj;

            let resource: PuppetASTResolvedDefinedType;
            try
            {
                resource = await definedType.resolveAsResource(title, properties, new class extends Resolver
                {
                    public resolveClass(className: string): Promise<PuppetASTClass>
                    {
                        return zis.resolveClass(className, global);
                    }

                    public async resolveGlobalVariable(name: string): Promise<string>
                    {
                        return global(name);
                    }
                });
            }
            catch (e)
            {
                console.log(e);
                throw new CompilationError("Failed to compile class: " + e);
            }
            
            let titles = this._compiledResources.get(definedTypeName);
            if (titles == null)
            {
                titles = new Dictionary();
                this._compiledResources.put(definedTypeName, titles);
            }

            const resolved = new ResolvedResource();

            resolved.definedType = definedType;
            resolved.resource = resource;

            titles.put(title, resolved);
            return resolved;
        }

        public dump()
        {
            const resourceInfo: any = {};

            for (const typeName in this.configResources)
            {
                resourceInfo[typeName] = Object.keys(this.configResources[typeName]);
            }

            return {
                "env": this._env.name,
                "classes": this.configClasses,
                "resources": resourceInfo
            }
        }

        public get env(): Environment
        {
            return this._env;
        }

        public get config()
        {
            return this._config;
        }

        public get configFacts()
        {
            return this._facts;
        }

        public get configResources()
        {
            return this._config["resources"] || {};
        }

        public get configClasses()
        {
            return this._config["classes"] || [];
        }

        public async init()
        {
            await this.parse();
        }
        
        public async acquireFacts(): Promise<any>
        {
            return this.configFacts;
        }

        public async updateFacts(facts: any): Promise<void>
        {
            this._facts = facts;

            await this.invalidate();
            await this.save();
        }

        public async setFact(fact: string, value: string): Promise<void>
        {
            this.configFacts[fact] = value;

            await this.invalidate();
            await this.save();
        }

        public async removeFact(fact: string): Promise<void>
        {
            delete this.configFacts[fact];
        }

        public async save()
        {
            const facts = [];
            for (const key in this._facts)
            {
                facts.push(" " + key + " = " + JSON.stringify(this._facts[key]));
            }

            const ordered: any = {};

            for (const key of Object.keys(this._config).sort())
            {
              ordered[key] = this._config[key];
            }

            await async.writeYAML(this.path, ordered, facts.join("\n"));
        }

        private async parseCommentBefore(comment: string)
        {
            this._facts = {};
            const facts = this._facts;

            if (comment == null)
                return;

            const comments = comment.split("\n");

            for (comment of comments)
            {
                const m = comment.match(/^\s*(.+?)\s*=\s*(.+?)\s*$/);

                if (m == null)
                    continue;

                const a = m[1];
                let b = m[2];

                try
                {
                    b = JSON.parse(b);
                }
                catch (e)
                {
                    return "";
                }

                facts[a] = b; 
            }
        }

        public async parse()
        {
            const document = await async.readYAML(this.path);
            this._config = document.toJSON();
            const contents: any = document.contents;

            if (contents.items.length > 0)
            {
                await this.parseCommentBefore(contents.items[0].commentBefore);
            }
        }

        public get name():string
        {
            return this._name;
        }

        public get path():string
        {
            return this._filePath;
        }

        public get localPath():string
        {
            return this._nodePath;
        }

        public hasResources(definedTypeName: string): boolean
        {
            return this.configResources[definedTypeName] != null;
        }

        public hasResource(definedTypeName: string, title: string): boolean
        {
            const titles = this.configResources[definedTypeName];

            if (titles == null)
                return false;

            return titles.hasOwnProperty(title);
        }

        public hasClass(className: string): boolean
        {
            return this.configClasses.indexOf(className) >= 0
        }
        
        public getGlobal(key: string): string
        {
            if (key == "facts")
            {
                return this.configFacts;
            }

            return this.configFacts[key] || this._env.global.get(key) || this._env.workspace.global.get(key);
        }

        public async removeClass(className: string): Promise<void>
        {
            if (!this.hasClass(className))
                return;

            await this.removeClassProperties(className);

            if (this._config["classes"] == null)
                this._config["classes"] = [];

            const index = this.configClasses.indexOf(className);

            if (index >= 0)
            {
                this.configClasses.splice(index, 1);
                await this.save();
            }
        }

        public async removeResource(definedTypeName: string, title: string): Promise<void>
        {
            if (!this.hasResource(definedTypeName, title))
                return;

            const titles = this.configResources[definedTypeName];

            if (titles == null)
                return;

            delete titles[title];

            if (Object.keys(titles).length === 0)
            {
                delete this.configResources[definedTypeName];
            }

            await this.save();
        }

        public async removeAllResources(): Promise<any[]>
        {
            const result: any[] = [];

            for (const definedTypeName in this.configResources)
            {
                for (const title in this.configResources[definedTypeName])
                {
                    result.push([definedTypeName, title])
                }
            }

            this._config["resources"] = {};

            await this.save();
            return result;
        }

        public async removeResources(definedTypeName: string): Promise<string[]>
        {
            if (!this.hasResources(definedTypeName))
                return;

            const titles = this.configResources[definedTypeName];
            const names = Object.keys(titles);

            delete this.configResources[definedTypeName];
            await this.save();

            return names;
        }

        public async renameResource(definedTypeName: string, title: string, newTitle: string): Promise<boolean>
        {
            if (!this.hasResource(definedTypeName, title))
                return false;

            if (this.hasResource(definedTypeName, newTitle))
                return false;

            const titles = this.configResources[definedTypeName];

            const oldObj = titles[title];
            delete titles[title];
            titles[newTitle] = oldObj;

            await this.save();
            return true;
        }

        public async removeAllClasses(): Promise<Array<string>>
        {
            const toRemove = [];

            for (const className of this.configClasses)
            {
                toRemove.push(className);
            }
            
            for (const className of toRemove)
            {
                await this.removeClassProperties(className);
            }

            this._config["classes"] = [];
            await this.save();

            return toRemove;
        }

        public async assignClass(className: string): Promise<void>
        {
            const zis = this;
            if (this.hasClass(className))
                return;

            if (this._config["classes"] == null)
                this._config["classes"] = [];

            this.configClasses.push(className);
            await this.save();
        }

        public async createResource(definedTypeName: string, title: string): Promise<boolean>
        {
            const zis = this;
            if (this.hasResource(definedTypeName, title))
                return false;

            if (this._config["resources"] == null)
                this._config["resources"] = [];

            if (this.configResources[definedTypeName] == null)
                this.configResources[definedTypeName] = {};

            this.configResources[definedTypeName][title] = {};
            
            await this.save();
            return true;
        }

        public async acquireClass(className: string): Promise<PuppetASTClass>
        {
            const zis = this;
            if (!this.hasClass(className))
                throw Error("No such class: " + className);

            return await this.resolveClass(className, (key: string) =>
            {
                return zis.getGlobal(key);
            });
        }
        
        public async acquireResouce(definedTypeName: string, title: string): Promise<ResolvedResource>
        {
            const zis = this;
            if (!this.hasResource(definedTypeName, title))
                throw Error("No such resource: " + definedTypeName + " (title: " + title + ")");

            let values: any = {};

            if (this.configResources.hasOwnProperty(definedTypeName))
            {
                const t = this.configResources[definedTypeName][title];

                if (t != null)
                {
                    for (const key in t)
                    {
                        values[key] = t[key];
                    }
                }
            }

            values["title"] = title;
            
            return await this.resolveResource(definedTypeName, title, values, (key: string) =>
            {
                return zis.getGlobal(key);
            });
        }

        public compilePropertyPath(className: string, propertyName: string): string
        {
            return className + "::" + propertyName;
        }

        public async setClassProperty(className: string, propertyName: string, value: any): Promise<any>
        {
            const classInfo = this._env.findClassInfo(className);

            if (classInfo == null)
                return;

            const compiled = await this.acquireClass(className);

            if (!compiled)
                return;

            const propertyPath = this.compilePropertyPath(className, propertyName);
            this.config[propertyPath] = value;

            await this.save();
        }

        public async setResourceProperty(definedTypeName: string, title: string, propertyName: string, value: any): Promise<any>
        {
            if (propertyName == "title")
                return;

            const definedTypeInfo = this._env.findDefineTypeInfo(definedTypeName);

            if (definedTypeInfo == null)
                return;

            const compiled = await this.acquireResouce(definedTypeName, title);

            if (!compiled)
                return;

            if (this.configResources[definedTypeName] == null)
                this.configResources[definedTypeName] = {};

            const d = this.configResources[definedTypeName];

            if (d[title] == null)
                d[title] = {};

            const t = d[title];

            t[propertyName] = value;

            await this.save();
        }

        public async removeClassProperty(className: string, propertyName: string): Promise<any>
        {
            const classInfo = this._env.findClassInfo(className);

            if (classInfo == null)
                return;

            const compiled = await this.acquireClass(className);

            if (!compiled)
                return;

            const propertyPath = this.compilePropertyPath(className, propertyName);
            delete this.config[propertyPath];

            await this.save();
        }
        
        public async removeResourceProperty(definedTypeName: string, title: string, propertyName: string): Promise<any>
        {
            const definedTypeInfo = this._env.findDefineTypeInfo(definedTypeName);

            if (definedTypeInfo == null)
                return;

            const compiled = await this.acquireResouce(definedTypeName, title);

            if (!compiled)
                return;
                
            const d = this.configResources[definedTypeName];
            if (d == null)
                return;

            const t = d[title];
            if (t == null)
                return;

            delete t[propertyName];

            await this.save();
        }

        public async removeClassProperties(className: string): Promise<any>
        {
            const classInfo = this._env.findClassInfo(className);

            if (classInfo == null)
                return;

            const compiled = await this.acquireClass(className);

            if (!compiled)
                return;

            for (const propertyName of classInfo.fields)
            {
                const propertyPath = this.compilePropertyPath(className, propertyName);
                delete this.config[propertyPath];
            }

            await this.save();
        }

        public async dumpClass(className: string): Promise<any>
        {
            const classInfo = this._env.findClassInfo(className);

            if (classInfo == null)
                return {};

            const compiled = await this.acquireClass(className);

            const defaultValues: any = {};
            const types: any = {};
            const errors: any = {};
            const hints: any = {};
            const values: any = {};

            for (const name of compiled.resolvedProperties.getKeys())
            {
                const property = compiled.getResolvedProperty(name);

                if (property.hasType)
                {
                    types[name] = {
                        "type": property.type.constructor.name,
                        "data": property.type
                    };
                }

                if (property.hasValue)
                {
                    defaultValues[name] = property.value;
                }

                if (property.hasError)
                {
                    errors[name] = {
                        message: property.error.message,
                        stack: property.error.stack
                    };
                }

                if (property.hasHints)
                {
                    hints[name] = property.hints;
                }

                const propertyPath = this.compilePropertyPath(className, name);
                const configValue = this.config[propertyPath];
                if (configValue != null)
                {
                    values[name] = configValue;
                }
            }

            return {
                "icon": classInfo.options.icon,
                "values": values,
                "classInfo": classInfo.dump(),
                "defaults": defaultValues,
                "types": types,
                "errors": errors,
                "hints": hints
            }
        }

        public async dumpResource(definedTypeName: string, title: string): Promise<any>
        {
            const classInfo = this._env.findDefineTypeInfo(definedTypeName);

            if (classInfo == null)
                return {};

            const compiled: ResolvedResource = await this.acquireResouce(definedTypeName, title);

            const defaultValues: any = {};
            const types: any = {};
            const errors: any = {};
            const hints: any = {};
            const values: any = {};

            if (this.configResources[definedTypeName] != null)
            {
                const t = this.configResources[definedTypeName][title];

                if (t != null)
                {
                    for (const k in t)
                    {
                        values[k] = t[k];
                    }
                }
            }

            for (const name of compiled.resource.resolvedProperties.getKeys())
            {
                const property = compiled.resource.resolvedProperties.get(name);

                if (property.hasType)
                {
                    types[name] = {
                        "type": property.type.constructor.name,
                        "data": property.type
                    };
                }

                if (property.hasError)
                {
                    errors[name] = {
                        message: property.error.message,
                        stack: property.error.stack
                    };
                }

                if (property.hasHints)
                {
                    hints[name] = property.hints;
                }
            }
            
            for (const name in compiled.definedType.params)
            {
                const defaultParam = compiled.definedType.params[name];
                const property = compiled.resource.resolvedProperties.get(name);

                if (property == null || defaultParam == null)
                    continue;

                if (property.hasValue && defaultParam.hasOwnProperty("value"))
                {
                    defaultValues[name] = property.value;
                }
            }

            return {
                "icon": classInfo.options.icon,
                "values": values,
                "classInfo": classInfo.dump(),
                "defaults": defaultValues,
                "types": types,
                "errors": errors,
                "hints": hints,
                "fields": Object.keys(compiled.definedType.params)
            }
        }
    }

    export class Class
    {
        private readonly _name: string;

        constructor(name: string)
        {
            this._name = name;
        }

        public get name():string 
        {
            return this._name;
        }
    }
}