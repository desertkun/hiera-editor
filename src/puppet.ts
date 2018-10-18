import * as process from "process";
import * as path from "path";
import * as os from "os";

import * as async from "./async";
import {Dictionary} from "./dictionary";
const slash = require('slash');
const PromisePool = require('es6-promise-pool');

import {PuppetASTParser, PuppetASTClass} from "./puppet/ast";

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
        private readonly _description: string;
        private readonly _modules: PuppetModulesInfo;

        constructor(name: string, info: any, modules: PuppetModulesInfo)
        {
            this.name = name;
            this.info = info;
            this._modules = modules;
            this._options = {};

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
                    }
                }
            }
        }

        public get file(): string
        {
            return this.info["file"];
        }

        public get description(): string
        {
            return this._description;
        }

        public get options(): any
        {
            return this._options;
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
                "inherits": this.info["inherits"],
                "description": this.description,
                "options": this.options
            }
        }
    }

    class PuppetDefinedTypeInfo
    {
        public readonly name: string;
        private readonly info: any;
        private readonly _modules: PuppetModulesInfo;

        constructor(name: string, info: any, modules: PuppetModulesInfo)
        {
            this.name = name;
            this.info = info;
            this._modules = modules;
        }

        public get modulesInfo(): PuppetModulesInfo
        {
            return this._modules;
        }

        public get source(): string
        {
            return this.info["source"];
        }

        public get file(): string
        {
            return this.info["file"];
        }

        public dump()
        {
            return {
                "name": this.name,
                "file": this.info["file"]
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

        public async generateCompilePromises(cb: CompiledPromisesCallback): Promise<Array<any>>
        {
            const result: Array<any> = [];
            const classes = this.classes.getValues();

            const _cachedStats: any = {};
            const _realStats: any = {};

            for (let clazz of classes)
            {
                const file = this.getCompiledClassPath(clazz.file);
                const realFile = path.join(this._modulesPath, clazz.file);

                _cachedStats[clazz.file] = async.fileStat(file);
                _realStats[clazz.file] = async.fileStat(realFile);
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
                        cb.callback(cb.done);
                    }

                    result.push([compile, file, this._modulesPath, clazz.source]);
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

        constructor(path: string)
        {
            this._environments = new Dictionary();
            this._path = path;
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

        public get cachePath(): string
        {
            return path.join(this._path, ".pe-cache");
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

        public async refresh(progressCallback: any, updateProgressCategory: any): Promise<any>
        {
            if (!await async.isDirectory(this.cachePath))
            {
                if (!await async.makeDirectory(this.cachePath))
                {
                    throw "Failed to create cache directory";
                }
            }

            let upToDate: boolean = false;

            updateProgressCategory("Processing classes...");

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
                updateProgressCategory("Extracting class info...");

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
                promiseCallback.callback = (done: number) =>
                {
                    if (originalPoolSize != 0)
                    {
                        const progress: number = done / originalPoolSize;
                        progressCallback(progress);
                    }
                };

                updateProgressCategory("Compiling classes...");

                await pool.start();
            }

            for (const env of await this.listEnvironments())
            {
                updateProgressCategory("Processing environment: " + env.name);
                await env.refresh(progressCallback)
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

        public async getEnvironment(name: string): Promise<Environment>
        {
            const environmentsPath = path.join(this._path, "environments");

            if (!await async.isDirectory(environmentsPath))
            {
                return null;
            }

            const environmentPath = path.join(environmentsPath, name);

            if (!await async.isDirectory(environmentsPath))
            {
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

        public dump(): any
        {
            return {
                "name": this._name
            }
        }
    }

    export class Environment
    {
        private readonly _name: string;
        private readonly _path: string;
        private readonly _cachePath: string;
        private readonly _root: Folder;
        private readonly _workspace: Workspace;
        private readonly _compiledClasses: Dictionary<string, PuppetASTClass>;
        private _modulesInfo: PuppetModulesInfo;

        constructor(workspace: Workspace, name: string, path: string, cachePath: string)
        {
            this._name = name;
            this._workspace = workspace;
            this._path = path;
            this._cachePath = cachePath;
            this._root = new Folder(this, "data", this.dataPath, name);
            this._compiledClasses = new Dictionary();
        }

        public get root(): Folder
        {
            return this._root;
        }

        public get workspace(): Workspace
        {
            return this._workspace;
        }

        public async resolveClass(className: string): Promise<PuppetASTClass>
        {
            if (this._compiledClasses.has(className))
            {
                return this._compiledClasses.get(className);
            }

            const zis = this;
            console.log("Compiling class " + className + " (for environment " + this._name + ")");

            const classInfo = this.findClassInfo(className);

            if (classInfo == null)
                throw Error("No such class info: " + className);

            const compiledPath = classInfo.modulesInfo.getCompiledClassPath(classInfo.file);
            let parsedJSON = null;

            try
            {
                parsedJSON = await async.readJSON(compiledPath);
            }
            catch (e)
            {
                console.log("Failed to parse class " + className);
                throw e;
            }

            const obj = PuppetASTParser.Parse(parsedJSON);

            if (!(obj instanceof PuppetASTClass))
                throw "Not a class";

            const clazz: PuppetASTClass = obj;
            await clazz.resolve((className: string) => {
                return zis.resolveClass(className);
            });

            this._compiledClasses.put(className, clazz);
            return clazz;
        }

        public findClassInfo(className: string): PuppetClassInfo
        {
            const localClassInfo = this._modulesInfo.findClass(className);

            if (localClassInfo)
                return localClassInfo;

            return this._workspace.modulesInfo.findClass(className);
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
            const classInfo = this._modulesInfo.dump(classes, types);

            return {
                "classes": classes,
                "types": types
            }
        }

        public async refresh(progressCallback: any): Promise<any>
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

        private acquireNode(env: Environment, name: string, filePath: string, nodePath: string): Node
        {
            if (this._nodes.has(name))
            {
                return this._nodes.get(name);
            }

            const newNode = new Node(env, name, filePath, nodePath);
            this._nodes.put(name, newNode);
            return newNode;
        }

        public async getNode(name: string): Promise<Node>
        {
            const entryPath = path.join(this._path, Node.NodePath(name));

            if (!await async.isFile(entryPath))
            {
                return null;
            }

            return this.acquireNode(this._env, name, entryPath, slash(path.join(this._localPath, name)));
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
                    result.push(this.acquireNode(
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

        constructor(env: Environment, name: string, filePath: string, nodePath: string)
        {
            this._env = env;
            this._name = name;
            this._filePath = filePath;
            this._nodePath = nodePath;
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

        public dump()
        {
            return {
                "env": this._env.name,
                "classes": this._config["classes"] || []
            }
        }

        public async refresh()
        {
            this._config = await async.readYAML(this.path);
            const a = 0;
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

        public hasClass(className: string): boolean
        {
            return this._config["classes"].indexOf(className) >= 0
        }

        public async compileClass(className: string)
        {
            if (!this.hasClass(className))
                throw Error("No such class: " + className);

            const compiled = await this._env.resolveClass(className);
            return compiled;
        }

        public async acquireClass(className: string)
        {
            const compiled = await this.compileClass(className);
            return compiled;
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

    /*
    enum PropertyType
    {
        string,
        integer,
    }

    class Property
    {

        constructor(name: string)
        {
            this._name = name;
        }

        public get name():string 
        {
            return this._name;
        }
    }
    */
}