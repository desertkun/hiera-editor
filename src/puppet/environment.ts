
import * as async from "../async";
import * as path from "path";
import * as os from "os";

import { Dictionary } from "../dictionary";
import { Workspace } from "./workspace"
import { PuppetModulesInfo } from "./modules_info"
import { PuppetClassInfo, PuppetDefinedTypeInfo, PuppetFunctionInfo } from "./class_info"
import { Ruby } from "./ruby"
import { PuppetASTParser, PuppetASTClass, PuppetASTEnvironment, Resolver, PuppetASTFunction, ResolveError } from "./ast"
import { CompiledPromisesCallback, GlobalVariableResolver, CompilationError, WorkspaceError } from "./util"
import { Hierarchy } from "./hiera"
import { NodeContext } from "./node"
import { Folder } from "./files";
import { PuppetHTTP } from "./http"
import { isArray } from "util";
import { WorkspaceSettings } from "./workspace_settings";
import { EnvironmentTreeDump, NodeDump } from "../ipc/objects"
import { HIERA_EDITOR_FIELD, HIERA_EDITOR_VALUE } from "./cert"

const forge = require("node-forge");
const PromisePool = require('es6-promise-pool');

export class Environment
{
    private readonly _name: string;
    private readonly _path: string;
    private readonly _cachePath: string;
    private readonly _workspace: Workspace;
    private readonly _hierarchy: Hierarchy;
    private readonly _global: Dictionary<string, string>;
    private readonly _nodes: Dictionary<string, NodeContext>;
    private readonly _roots: Dictionary<string, Folder>;
    private readonly _warnings: WorkspaceError[];
    private readonly _offline: boolean;
    private readonly _nodeFacts: Dictionary<string, any>;
    private readonly _certificates: Dictionary<string, any>;
    private _modulesInfo: PuppetModulesInfo;

    constructor(workspace: Workspace, name: string, _path: string, cachePath: string, offline: boolean = false)
    {
        this._name = name;
        this._workspace = workspace;
        this._path = _path;
        this._warnings = [];
        this._hierarchy = new Hierarchy(path.join(_path, "hiera.yaml"));
        this._roots = new Dictionary();
        this._cachePath = cachePath;
        this._global = new Dictionary();
        this._global.put("environment", name);
        this._nodes = new Dictionary();
        this._nodeFacts = new Dictionary();
        this._certificates = new Dictionary();
        this._offline = offline;
    }

    public get modulesInfo(): PuppetModulesInfo
    {
        return this._modulesInfo;
    }

    public get global()
    {
        return this._global;
    }

    public getRoot(_path: string): Folder
    {
        const existing = this._roots.get(_path);
        if (existing)
            return existing;
        const root = new Folder(this, "data", path.join(this._path, _path), this.name, null);
        this._roots.put(_path, root);
        return root;
    }

    public get warnings(): Error[]
    {
        return this._warnings;
    }

    public addWarning(warning: WorkspaceError)
    {
        this._warnings.push(warning);
    }

    public get certNodeFactsPath(): string
    {
        return path.join(this._cachePath, "facts")
    }

    public getNode(certname: string): NodeContext
    {
        return this._nodes.get(certname);
    }

    public getNodeFactsPath(certName: string): string
    {
        return path.join(this._cachePath, "facts", certName + ".json")
    }

    public get certificateCachePath(): string
    {
        return path.join(this._cachePath, "certs")
    }

    public get certListCachePath(): string
    {
        return path.join(this._cachePath, "certnames.json")
    }

    public get hierarchy(): Hierarchy
    {
        return this._hierarchy;
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

    public async enterNodeContext(certname: string, facts?: any): Promise<NodeContext>
    {
        const existing = this._nodes.get(certname);

        if (existing != null)
        {
            return existing;
        }

        const new_ = new NodeContext(certname, this);
        this._nodes.put(certname, new_);
        
        try
        {
            await new_.init(facts);
        }
        catch (e)
        {
            if (e instanceof CompilationError || e instanceof ResolveError)
            {
                console.log(e);
            }
            else
            {
                throw e;
            }
        }

        return new_;
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

    public async tree(): Promise<EnvironmentTreeDump>
    {
        const nodes: {[key: string]: NodeDump} = {};

        for (const certname of this._nodes.getKeys())
        {
            const node = this._nodes.get(certname);
            nodes[certname] = await node.dump();
        }

        const warnings = [];
        for (const warn of this._warnings)
        {
            warnings.push({
                title: warn.title,
                message: warn.message
            })
        }

        return {
            "nodes": nodes,
            "warnings": warnings
        };
    }

    public get root(): Folder
    {
        return this.getRoot(this._hierarchy.datadir);
    }

    public get dataPath(): string
    {
        return path.join(this._path, this._hierarchy.datadir);
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
        return this._cachePath;
    }

    private get cacheManifestsFilePath(): string
    {
        return path.join(this.cachePath, "manifests");
    }

    private get cacheModulesFilePath(): string
    {
        return path.join(this.cachePath, "modules.json");
    }

    public get manifestsName(): string
    {
        return "manifests";
    }

    public get manifestsPath(): string
    {
        return path.join(this.path, this.manifestsName);
    }

    private get modulesPath(): string
    {
        return path.join(this.path, "modules");
    }

    public getClassInfo(): any
    {
        const classes: any = {};
        const types: any = {};

        this._workspace.modulesInfo.dump(classes, types);

        if (this._modulesInfo) 
            this._modulesInfo.dump(classes, types);

        return {
            "classes": classes,
            "types": types
        }
    }

    public async installModules(callback: any): Promise<boolean>
    {
        return await Workspace.InstallModules(this._path, callback);
    }
    
    private async compileModules(progressCallback: any = null, updateProgressCategory: any = null): Promise<any>
    {
        // compile modules

        if (await async.isDirectory(this.modulesPath))
        {
            let upToDate: boolean = false;

            const bStat = await async.fileStat(this.cacheModulesFilePath);
            if (bStat) {
                const mTime: Number = bStat.mtimeMs;
                const recentTime: Number = await async.mostRecentFileTime(this.modulesPath);

                if (recentTime <= mTime) {
                    // cache is up to date
                    upToDate = true;
                }

            }

            if (!upToDate) {
                await Ruby.CallScript("puppet-strings.rb", [this.cacheModulesFilePath], this.modulesPath);
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

            if (updateProgressCategory) updateProgressCategory("Compiling environment modules...", true);
            await pool.start();
        }
    }

    private async compileManifests(progressCallback: any = null, updateProgressCategory: any = null): Promise<any>
    {
        // compile manifests

        if (await async.isDirectory(this.manifestsPath))
        {
            let upToDate: boolean = false;

            const bStat = await async.fileStat(this.cacheManifestsFilePath);
            if (bStat) {
                const mTime: Number = bStat.mtimeMs;
                const recentTime: Number = await async.mostRecentFileTime(this.manifestsPath);

                if (recentTime <= mTime) {
                    // cache is up to date
                    upToDate = true;
                }
            }

            if (!upToDate) 
            {
                const files_ = await async.listFiles(this.manifestsPath);
                const files = files_.filter((name) => name.endsWith(".pp"));
                files.sort();
                
                const promiseCallback = new CompiledPromisesCallback();
                const compilePromises = await this.generateCompilePromises(files, this.manifestsName, promiseCallback);
                const originalPoolSize: number = compilePromises.length;

                function* promiseProducer()
                {
                    for (const p of compilePromises)
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

                if (updateProgressCategory) updateProgressCategory("Compiling manifests...", true);
                await pool.start();
            }
        }

    }

    public getCertificate(certname: string): any
    {
        return this._certificates.get(certname);
    }

    private async loadCertificates(updateProgressCategory: any, certList: string[], settings: WorkspaceSettings)
    {
        
        if (!await async.isDirectory(this.certificateCachePath))
        {
            await async.makeDirectory(this.certificateCachePath);
        }

        const certsExist = [];

        for (const certname of certList)
        {
            certsExist.push(async.isFile(path.join(this.certificateCachePath, certname + ".txt")));
        }

        const ex = await Promise.all(certsExist.map(p => p.catch(() => undefined)));
        const loadCerts = [];

        for (let i = 0, t = certList.length; i < t; i++)
        {
            const certname = certList[i];
            const exists = ex[i];

            if (exists)
            {
                loadCerts.push(async.readFile(path.join(this.certificateCachePath, certname + ".txt")));
            }
            else
            {
                loadCerts.push(Promise.resolve(null));
            }
        }
        
        const certs = await Promise.all(loadCerts.map(p => p.catch((e: any): any => undefined)));

        for (let i = 0, t = certList.length; i < t; i++)
        {
            const certname = certList[i];
            let certificate = certs[i];

            if (certificate == null)
            {
                if (updateProgressCategory) updateProgressCategory(
                    "[" + this.name + "] Downloading certificate for node " + certname + "...", false);
        
                certificate = await PuppetHTTP.GetCertificate(certname, this.name, settings);
                await async.writeFile(path.join(this.certificateCachePath, certname + ".txt"), certificate);
            }

            const cert = forge.pki.certificateFromPem(certificate);

            if (cert == null)
                continue;

            this._certificates.put(certname, cert);
        }
    }

    private async updateCertList(updateProgressCategory: any, settings: WorkspaceSettings): Promise<string[]>
    {
        if (updateProgressCategory) updateProgressCategory("[" + this.name + "] Updating certificate list...", false);

        let certList: string[];

        try
        {
            certList = await PuppetHTTP.GetCertList(this.name, settings);
        }
        catch (e)
        {
            throw new WorkspaceError("Failed to obtain certificate list", e.toString());
        }

        await this.loadCertificates(updateProgressCategory, certList, settings);

        await async.writeJSON(this.certListCachePath, certList);
        return certList;
    }

    public async init(progressCallback: any = null, updateProgressCategory: any = null): Promise<any>
    {
        const zis = this;

        this._warnings.length = 0;

        if (!await async.isDirectory(this.cachePath))
        {
            if (!await async.makeDirectory(this.cachePath))
            {
                throw "Failed to create cache directory";
            }
        }

        await this._hierarchy.load();

        if (await async.isFile(path.join(this._path, "Puppetfile")) &&
            !await async.isDirectory(this.modulesPath))
        {
            await this.installModules(updateProgressCategory);   
        }

        if (!await async.isDirectory(this.compileDirectory))
        {
            await async.makeDirectory(this.compileDirectory);
        }

        await this.compileModules(progressCallback, updateProgressCategory);
        await this.compileManifests(progressCallback, updateProgressCategory);

        const settings = await this.workspace.getSettings();

        let nodeList: string[];

        if (this._offline)
        {
            nodeList = [];
        }
        else
        {
            if (await async.isFile(this.certListCachePath))
            {
                try
                {
                    nodeList = await this.updateCertList(updateProgressCategory, settings);
                }
                catch (e)
                {
                    this.addWarning(e);
                    nodeList = await async.readJSON(this.certListCachePath);
    
                    if (!isArray(nodeList))
                    {
                        nodeList = [];
                        await async.writeJSON(this.certListCachePath, nodeList);
                        throw e;
                    }
                }
            }
            else
            {
                nodeList = await this.updateCertList(updateProgressCategory, settings);
            }
        }

        const nodeIgnoreList = this.workspace.getNodeIgnoreList();
        nodeList = nodeList.filter((certname: string) => 
        {
            if (nodeIgnoreList.indexOf(certname) >= 0)
                return false;
            
            const cert = zis._certificates.get(certname);
            if (cert != null)
            {
                const ext = cert.getExtension({id: HIERA_EDITOR_FIELD});
                if (ext != null)
                {
                    // cut the fist two characters
                    // https://puppet.com/docs/puppet/6.0/ssl_attributes_extensions.html#manually-checking-for-extensions-in-csrs-and-certificates
                    if (ext.value.substr(2) == HIERA_EDITOR_VALUE)
                        return false;
                }
            }

            return true;
        });
        this._nodeFacts.clear();

        if (!this._offline)
        {
            if (!await async.isDirectory(this.certNodeFactsPath))
                await async.makeDirectory(this.certNodeFactsPath);

            const count = {
                c: 0,
                total: nodeList.length
            };

            const queries = [];

            for (const certName of nodeList)
            {
                queries.push(this.fetchNodeFacts(certName, count, progressCallback, settings));
            }

            if (queries.length > 0)
            {
                if (updateProgressCategory) updateProgressCategory("[" + this.name + "] Fetching node facts...", true);
        
                await Promise.all(queries);
            }

            if (updateProgressCategory) updateProgressCategory("[" + this.name + "] Resolving nodes...", true);
        }

        this._nodes.clear();

        for (const certname of this._nodeFacts.getKeys())
        {
            const facts = this._nodeFacts.get(certname);
            const node = await this.enterNodeContext(certname, facts);
            this._nodes.put(certname, node);
        }
    }

    private async fetchNodeFacts(certname: string, count: any, progressCallback: any, settings: WorkspaceSettings)
    {
        const p = this.getNodeFactsPath(certname);

        let facts;

        try
        {
            facts = await PuppetHTTP.GetNodeFacts(this.name, certname, settings);
            await async.writeJSON(p, facts);
        }
        catch (e)
        {
            this.addWarning(new WorkspaceError("Failed to fetch facts for node '" + certname + '"', e.toString()));
            
            if (await async.isFile(p))
            {
                try
                {
                    facts = await async.readJSON(p);
                }
                catch (e)
                {
                    try
                    {
                        await async.remove(p);
                    }
                    catch (e)
                    {
                        //
                    }

                    this.addWarning(new WorkspaceError("Failed to fetch back up facts for node '" + certname + '"', e.toString()));
                }
            }
        }

        this._nodeFacts.put(certname, facts);
        
        if (progressCallback)
        {
            count.c++;
            progressCallback(count.c / count.total);
        }
    }

    public async loadModulesInfo(): Promise<PuppetModulesInfo>
    {
        if (this._modulesInfo != null)
        {
            return this._modulesInfo;
        }

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

    public getCompiledPath(fileName: string)
    {
        return path.join(this._cachePath, "obj", fileName + ".o");
    }

    public get compileDirectory()
    {
        return path.join(this._cachePath, "obj");
    }
    
    public async generateCompilePromises(files: string[], directory: string, cb: CompiledPromisesCallback): Promise<Array<any>>
    {
        const result: Array<any> = [];
        const _cachedStats: any = {};
        const _realStats: any = {};

        for (let fileName of files)
        {
            const file = this.getCompiledPath(path.join(directory, fileName));
            const realFile = path.join(this._path, directory, fileName);

            _cachedStats[file] = async.fileStat(file);
            _realStats[file] = async.fileStat(realFile);
        }

        const cachedStats = await async.PromiseAllObject(_cachedStats);
        const realStats = await async.PromiseAllObject(_realStats);

        const compileFileList: Array<[string, string]> = [];

        for (let fileName of files)
        {
            const file = this.getCompiledPath(path.join(directory, fileName));

            if (cachedStats[file])
            {
                const cachedStat = cachedStats[file];
                if (cachedStat != null)
                {
                    const cachedTime: Number = cachedStat.mtimeMs;

                    const realStat = realStats[file];
                    
                    if (realStat != null)
                    {
                        const realTime: Number = realStat.mtimeMs;

                        if (cachedTime >= realTime)
                        {
                            // compiled file is up-to-date
                            continue;
                        }
                    }
                }
            }

            const realFile = path.join(this._path, directory, fileName);
            let data;

            try
            {
                data = await async.readFile(realFile);
            }
            catch (e)
            {
                continue;
            }

            compileFileList.push([file, data]);
        }

        async function compileFiles(files: any, compilePath: string)
        {
            console.log("Compiling " + Object.keys(files).join(", ") + "...");

            try
            {
                await Ruby.CallAndSendStdIn("puppet-parser.rb", [], compilePath, JSON.stringify(files));
                console.log("Compiling done!");
            }
            catch (e)
            {
                console.log("Failed to compile: " + e);
            }

            cb.done += 1;

            if (cb.callback) cb.callback(cb.done);
        }

        while (true)
        {
            const files: any = {};
            let foundOne: boolean = false;

            for (let i = 0; i < 16; i++)
            {
                if (compileFileList.length == 0)
                    break;

                const [file, source] = compileFileList.pop();
                files[file] = source;
                foundOne = true;
            }

            if (!foundOne)
                break;

            result.push([compileFiles, files, this.compileDirectory]);
        }

        return result;
    }

}