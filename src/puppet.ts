import * as process from "process";
import * as path from "path";
import * as os from "os";

import * as async from "./async";

import {Dictionary} from "./dictionary";
const slash = require('slash');
const PromisePool = require('es6-promise-pool');

import {PuppetASTParser, PuppetASTClass, PuppetASTDefinedType, PuppetASTFunction, PuppetASTResolvedDefinedType, Resolver} from "./puppet/ast";
import { throws } from "assert";

export module puppet
{
    export class RubyPath
    {
        public path: string;
        public rubyPath: string;
        public gemPath: string;
    }

    export class Ruby
    {
        public static Path(): RubyPath
        {
            if (process.platform == "win32")
            {
                return require('rubyjs-win32');
            }
            else if (process.platform == "darwin")
            {
                return require('rubyjs-darwin');
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
                await async.execFile(Ruby.Path().rubyPath, argsTotal, cwd);
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

            return async.execFileInOut(Ruby.Path().rubyPath, argsTotal, cwd, data);
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

        public get defaults(): Array<string>
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
                "defaults": this.defaults,
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

        public get defaults(): Array<string>
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
                "defaults": this.defaults,
                "inherits": this.info["inherits"],
                "description": this.description,
                "options": this.options,
                "tags": this.tags
            }
        }
    }

    class PuppetFunctionInfo
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
        private readonly _functions: Dictionary<string, PuppetFunctionInfo>;

        constructor(modulesPath: string, cachePath: string, data: any)
        {
            this._modulesPath = modulesPath;
            this._cachePath = cachePath;
            this._classes = new Dictionary();
            this._definedTypes = new Dictionary();
            this._functions = new Dictionary();

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

            for (const function_ of data["puppet_functions"])
            {
                const name: string = function_["name"];
                this._functions.put(name, new PuppetFunctionInfo(name, function_, this));
            }
        }

        public getCompiledClassPath(fileName: string)
        {
            return path.join(this._cachePath, "obj", fileName + ".o");
        }

        public getCompiledFunctionPath(fileName: string)
        {
            return path.join(this._cachePath, "func", fileName + ".o");
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
            const functions = this.functions.getValues();

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

            for (let function_ of functions)
            {
                const file = this.getCompiledFunctionPath(function_.file);
                const realFile = path.join(this._modulesPath, function_.file);

                _cachedStats[function_.file] = async.fileStat(file);
                _realStats[function_.file] = async.fileStat(realFile);
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

            for (let function_ of functions)
            {
                const file = path.join(this._cachePath, "func", function_.file + ".o");
                const realFile = path.join(this._modulesPath, function_.file);

                if (cachedStats[function_.file])
                {
                    const cachedStat = cachedStats[function_.file];
                    const cachedTime: Number = cachedStat.mtimeMs;

                    const realStat = realStats[function_.file];
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
                        console.log("Compiling function " + file + "...");

                        try
                        {
                            await puppet.Ruby.CallInOut("puppet-parser.rb", [file], modulesPath, source);
                            console.log("Compiling function " + file + " done!");
                        }
                        catch (e)
                        {
                            console.log("Failed to compile " + file + ": " + e);
                        }

                        cb.done += 1;

                        if (cb.callback) cb.callback(cb.done);
                    }

                    result.push([compile, file, this._modulesPath, function_.source]);
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

        public get functions(): Dictionary<string, PuppetFunctionInfo>
        {
            return this._functions;
        }

        public get modulesPath(): string
        {
            return this._modulesPath;
        }

        public get cachePath(): string
        {
            return this._cachePath;
        }

        public findFunction(name: string): PuppetFunctionInfo
        {
            return this._functions.get(name);
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

        public async createEnvironment(name: string): Promise<boolean>
        {
            if (await this.getEnvironment(name) != null)
                return false;

            const environmentsPath = this.environmentsPath;

            if (!await async.createDirectory(path.join(environmentsPath, name)))
                return false;

            const env = await this.getEnvironment(name);
            await env.create();
            return true;
        }

        public async removeEnvironment(name: string): Promise<boolean>
        {
            const env = await this.getEnvironment(name);

            if (env == null)
                return false;

            if (!await async.remove(env.path))
                return false;

            this._environments.remove(name);

            return true;
        }

        public async findFolder(path: string): Promise<Folder>
        {
            if (path == null || path == "")
                return null;

            const entries = path.split("/");

            const environment = entries[0];
            const env: Environment = await this.getEnvironment(environment);

            if (entries.length == 1)
            {
                return env.root;
            }

            if (env == null)
                return null;
            entries.splice(0, 1);
            return await env.root.findFolder(entries);
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

        public get environmentsPath(): string
        {
            return path.join(this._path, "environments");
        }

        public async getEnvironment(name: string): Promise<Environment>
        {
            const environmentsPath = this.environmentsPath;

            if (!await async.isDirectory(environmentsPath))
            {
                // Workspace does not have environments folder
                return null;
            }

            const environmentPath = path.join(environmentsPath, name);

            if (!await async.isDirectory(environmentPath))
            {
                // Environment does not exists
                return null;
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

        public async getGlobalModules(): Promise<any>
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

        public async getEnvironmentModules(name: string): Promise<any>
        {
            const env = await this.getEnvironment(name);

            if (env == null)
                return {};

            return await env.getModules();
        }

        public dump(): any
        {
            return {
                "name": this._name
            }
        }
    }
    
    export interface GlobalVariableResolver
    {
        get (key: string): string;
        has (key: string): boolean;
    }

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

    export class Folder
    {
        private readonly _name: string;
        private readonly _path: string;
        private readonly _env: Environment;
        private readonly _localPath: string;
        private readonly _parent: Folder;

        private readonly _nodes: Dictionary<string, Node>;
        private readonly _folders: Dictionary<string, Folder>;

        constructor(env: Environment, name: string, path: string, localPath: string, parent: Folder)
        {
            this._env = env;
            this._name = name;
            this._path = path;
            this._localPath = localPath;
            this._parent = parent;

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

        public async createNode(name: string): Promise<Node>
        {
            const entryPath = path.join(this._path, Node.NodePath(name));

            if (await async.isDirectory(entryPath))
            {
                return null;
            }

            if (await async.isFile(entryPath))
            {
                return null;
            }

            const node = await this.acquireNode(this._env, name, entryPath, slash(path.join(this._localPath, name)));

            if (node == null)
                return null;

            await node.save();
            return node;
        }

        public async createFolder(name: string): Promise<Folder>
        {
            const entryPath = path.join(this._path, name);

            if (await async.isDirectory(entryPath))
            {
                return null;
            }

            if (await async.isFile(entryPath))
            {
                return null;
            }

            if (!await async.createDirectory(entryPath))
            {
                return null;
            }

            return await this.getFolder(name);
        }

        public async remove(): Promise<boolean>
        {
            if (this._parent == null)
                return;

            return await this._parent.removeFolder(this._name);
        }

        public async removeFolder(name: string): Promise<boolean>
        {
            const folder = await this.getFolder(name);

            if (folder == null)
                return false;
                
            const entryPath = path.join(this._path, name);

            if (!await async.remove(entryPath))
            {
                return false;
            }

            this._folders.remove(name);
            return true;
        }

        public async removeNode(name: string): Promise<boolean>
        {
            const node = await this.getNode(name);

            if (node == null)
                return false;
                
            const entryPath = path.join(this._path, Node.NodePath(name));

            if (!await async.remove(entryPath))
            {
                return false;
            }

            this._nodes.remove(name);
            return true;
        }

        public async findFolder(localPath: Array<string>): Promise<Folder>
        {
            if (localPath.length > 1)
            {
                const dir = await this.getFolder(localPath[0]);
                localPath.splice(0, 1);
                return await dir.findFolder(localPath);
            }

            return await this.getFolder(localPath[0]);
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

            const newFolder = new Folder(env, name, path, localPath, this);
            this._folders.put(name, newFolder);
            return newFolder;
        }

        private async acquireNode(env: Environment, name: string, filePath: string, nodePath: string): Promise<Node>
        {
            if (this._nodes.has(name))
            {
                return this._nodes.get(name);
            }

            const newNode = new Node(env, name, filePath, nodePath, this);
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
        private readonly _parent: Folder;
        private _config: any;
        private _facts: any;

        private readonly _compiledClasses: Dictionary<string, PuppetASTClass>;
        private readonly _compiledFunctions: Dictionary<string, PuppetASTFunction>;
        private readonly _compiledResources: Dictionary<string, Dictionary<string, ResolvedResource>>;

        constructor(env: Environment, name: string, filePath: string, nodePath: string, parent: Folder)
        {
            this._env = env;
            this._name = name;
            this._filePath = filePath;
            this._nodePath = nodePath;
            this._config = {};
            this._facts = {};
            this._parent = parent;

            this._compiledClasses = new Dictionary();
            this._compiledResources = new Dictionary();
            this._compiledFunctions = new Dictionary();
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

        public async invalidateClass(className: string): Promise<void>
        {
            if (this._compiledClasses.has(className))
            {
                const compiled = this._compiledClasses.get(className);
                this._compiledClasses.remove(className);

                // invalidate also a direct parent, if any
                if (compiled.parentName != null)
                {
                    await this.invalidateClass(compiled.parentName);
                }
            }
        }

        public async invalidateDefinedType(definedTypeName: string, title: string): Promise<void>
        {
            if (this._compiledResources.has(definedTypeName))
            {
                const titles = this._compiledResources.get(definedTypeName);

                titles.remove(title);
            }
        }

        public async remove(): Promise<boolean>
        {
            if (this._parent == null)
                return;

            return await this._parent.removeNode(this._name);
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
            
            this._compiledClasses.put(className, clazz);

            try
            {
                await clazz.resolve(clazz, new class extends Resolver
                {
                    public resolveClass(className: string): Promise<PuppetASTClass>
                    {
                        return zis.resolveClass(className, global);
                    }

                    public resolveFunction(name: string): Promise<PuppetASTFunction>
                    {
                        return zis.resolveFunction(name, global);
                    }

                    public getGlobalVariable(name: string): string
                    {
                        return global.get(name);
                    }

                    public hasGlobalVariable(name: string): boolean
                    {
                        return global.has(name);
                    }
                });
            }
            catch (e)
            {
                console.log(e);
                this._compiledClasses.remove(className);
                throw new CompilationError("Failed to compile class: " + e);
            }

            return clazz;
        }

        public async resolveFunction(name: string, global: GlobalVariableResolver): Promise<PuppetASTFunction>
        {
            name = Node.fixClassName(name);

            if (this._compiledFunctions.has(name))
            {
                return this._compiledFunctions.get(name);
            }

            const zis = this;
            console.log("Compiling function " + name + " (for environment " + this._name + ")");

            const functionInfo = this.env.findFunctionInfo(name);

            if (functionInfo == null)
            {
                return null;   
            }

            const compiledPath = functionInfo.modulesInfo.getCompiledFunctionPath(functionInfo.file);
            let parsedJSON = null;

            try
            {
                parsedJSON = await async.readJSON(compiledPath);
            }
            catch (e)
            {
                throw new CompilationError("Failed to parse function " + name);
            }

            const obj = PuppetASTParser.Parse(parsedJSON);

            if (!(obj instanceof PuppetASTFunction))
                throw "Not a function";

            const function_: PuppetASTFunction = obj;
            this._compiledFunctions.put(name, function_);
            return function_;
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

                    public resolveFunction(name: string): Promise<PuppetASTFunction>
                    {
                        return zis.resolveFunction(name, global);
                    }

                    public getGlobalVariable(name: string): string
                    {
                        return global.get(name);
                    }

                    public hasGlobalVariable(name: string): boolean
                    {
                        return global.has(name);
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
            if (await async.isFile(this.path))
            {
                await this.parse();
            }

            if (this._config["resources"] == null)
                this._config["resources"] = {};
            
            if (this._config["classes"] == null)
                this._config["classes"] = [];
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
        
        public hasGlobal(key: string): boolean
        {
            if (key == "facts")
            {
                return this.configFacts != null;
            }

            if (this.configFacts != null && this.configFacts.hasOwnProperty(key))
                return true;

            if (this._env.global.has(key) || this._env.workspace.global.has(key))
                return true;

            if (this._config != null && this._config.hasOwnProperty(key))
                return true;
            
            return false;
        }

        public getGlobal(key: string): string
        {
            if (key == "facts")
            {
                return this.configFacts;
            }

            if (this.configFacts != null && this.configFacts.hasOwnProperty(key))
                return this.configFacts[key];

            if (this._env.global.has(key))
                return this._env.global.get(key);

            if (this._env.workspace.global.has(key))
                return this._env.workspace.global.get(key);

            if (this._config != null)
                return this._config[key];
            
            return null;
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

            return await this.resolveClass(className, {
                get: (key: string) => zis.getGlobal(key),
                has: (key: string) => zis.hasGlobal(key)
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
            
            return await this.resolveResource(definedTypeName, title, values, {
                get: (key: string) => zis.getGlobal(key),
                has: (key: string) => zis.hasGlobal(key)
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

        public async hasClassProperty(className: string, propertyName: string): Promise<boolean>
        {
            const classInfo = this._env.findClassInfo(className);

            if (classInfo == null)
                return false;

            const compiled = await this.acquireClass(className);

            if (!compiled)
                return false;

            const propertyPath = this.compilePropertyPath(className, propertyName);

            return this.config != null && this.config.hasOwnProperty(propertyPath);
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

            for (const propertyName of compiled.resolvedFields.getKeys())
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
            const fields: string[] = [];
            const definedFields: string[] = [];
            const requiredFields: string[] = [];
            const values: any = {};
            const classHints: any = compiled.hints;

            for (const name of compiled.resolvedFields.getKeys())
            {
                const property = compiled.getResolvedProperty(name);
                fields.push(name);

                if (classInfo.defaults.indexOf(name) < 0)
                {
                    requiredFields.push(name);
                }

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

                if (this.config.hasOwnProperty(propertyPath))
                {
                    const configValue = this.config[propertyPath];
                    values[name] = configValue;
                    definedFields.push(name);
                }
            }

            return {
                "icon": classInfo.options.icon,
                "values": values,
                "classInfo": classInfo.dump(),
                "defaults": defaultValues,
                "types": types,
                "errors": errors,
                "propertyHints": hints,
                "hints": classHints,
                "definedFields": definedFields,
                "fields": fields,
                "requiredFields": requiredFields
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
            const fields: string[] = [];
            const definedFields: string[] = [];
            const requiredFields: string[] = [];
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
                        definedFields.push(k);
                    }
                }
            }

            for (const name of compiled.resource.resolvedFields.getKeys())
            {
                const property = compiled.resource.resolvedFields.get(name);

                if (classInfo.defaults.indexOf(name) < 0)
                {
                    requiredFields.push(name);
                }

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

                if (property.hasValue)
                {
                    defaultValues[name] = property.value;
                }

                fields.push(name);
            }
            
            return {
                "icon": classInfo.options.icon,
                "values": values,
                "classInfo": classInfo.dump(),
                "defaults": defaultValues,
                "types": types,
                "errors": errors,
                "propertyHints": hints,
                "definedFields": definedFields,
                "fields": fields,
                "requiredFields": requiredFields
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