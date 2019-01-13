
import * as path from "path";
import * as async from "../async";
import * as os from "os";

import { SetupWorkspaceWindow } from "../windows/setup_workspace/window"

import { WorkspaceSettings } from "./workspace_settings"
import { PuppetModulesInfo } from "./modules_info"
import { Dictionary } from "../dictionary";
import { Environment } from "./environment"
import { Ruby } from "./ruby"
import { WorkspaceError, CompiledPromisesCallback } from "./util"
import { Folder, File } from "./files"

const PromisePool = require('es6-promise-pool');
const slash = require('slash');

export class Workspace
{
    private _workspaceSettings: WorkspaceSettings;
    private readonly _path: string;
    private _name: string;
    private _environments: Dictionary<string, Environment>;
    private _modulesInfo: PuppetModulesInfo;
    private readonly checkCertificates: boolean;

    private readonly _cachePath: string;
    private readonly _global: Dictionary<string, string>;

    constructor(workspacePath: string, cachePath: string = null, checkCertificates: boolean = true)
    {
        this._environments = new Dictionary();
        this._path = workspacePath;
        this._cachePath = cachePath || path.join(this._path, ".pe-cache");
        this._global = new Dictionary();
        this.checkCertificates = checkCertificates;
    }

    public get global()
    {
        return this._global;
    }

    public get cachePath(): string
    {
        return this._cachePath;
    }

    public get settingsPath(): string
    {
        return path.join(this._cachePath, "puppet.conf");
    }

    public async getSettings(): Promise<WorkspaceSettings>
    {
        if (this._workspaceSettings == null)
        {
            this._workspaceSettings = new WorkspaceSettings(this.settingsPath, this._path);

            if (!await this._workspaceSettings.read())
            {
                this._workspaceSettings.reset();
            }
        }
        
        return this._workspaceSettings;
    }

    public get path():string 
    {
        return this._path;
    }

    public get modulesInfo(): PuppetModulesInfo
    {
        return this._modulesInfo;
    }

    public static async InstallModules(path_: string, progressCallback: any): Promise<boolean>
    {
        if (!await async.isFile(path.join(path_, "Puppetfile")))
            return false;

        if (progressCallback) progressCallback("Installing modules...", false);
    
        try
        {
            const lines: string[] = [];
            const env: any = {};

            if (process.platform == "win32")
            {
                env["LIBRARIAN_PUPPET_USE_SHORT_CACHE_PATH"] = "true";
                env["LIBRARIAN_PUPPET_TMP"] = "C:/";
            }
            else
            {
                env["LIBRARIAN_PUPPET_TMP"] = path.join(path_, ".tmp");
            }

            await Ruby.CallRubyBin("librarian-puppet", ["install", "--verbose"], path_, env, (line: string) => 
            {
                if (line.length > 80)
                {
                    line = line.substr(0, 80) + " ...";
                }

                if (line.indexOf("No output") >= 0)
                    return;

                lines.push(line);

                if (lines.length > 4)
                {
                    lines.splice(0, 1);
                }

                if (progressCallback) progressCallback(lines.join("\n"), false);
            });
        }
        catch (e)
        {
            throw new WorkspaceError("Failed to install modules", e.toString());
        }

        return true;
    }
    
    public async downloadSignedCertificate(): Promise<void>
    {
        const paths = WorkspaceSettings.GetPaths();

        try
        {
            await Ruby.CallBin("puppet", [
                "ssl", "download_cert", 
                "--config '" + slash(this.settingsPath) + "'",
                "--confdir '" + paths.confdir + "'",
                "--vardir '" + paths.vardir + "'",
                "--rundir '" + paths.rundir + "'",
                "--logdir '" + paths.logdir + "'",
                "--verbose"
            ], this.path, {});
        }   
        catch (e)
        {
            throw new WorkspaceError("Failed to download signed certificate", e.toString());
        }

    }

    public async publishCSR(server: string, certname: string): Promise<string>
    {
        const settings = await this.getSettings();

        settings.server = server;
        settings.certname = certname;

        settings.write();

        const paths = WorkspaceSettings.GetPaths();
        let output;

        try
        {
            output = await Ruby.CallBin("puppet", [
                "ssl", "submit_request", 
                "--config '" + slash(this.settingsPath) + "'",
                "--confdir '" + paths.confdir + "'",
                "--vardir '" + paths.vardir + "'",
                "--rundir '" + paths.rundir + "'",
                "--logdir '" + paths.logdir + "'",
                "--verbose"
            ], this.path, {});
        }   
        catch (e)
        {
            throw new WorkspaceError("Failed to publish CSR", e.toString());
        }

        const m = output.match(/Certificate Request fingerprint \(.+\): ([A-F0-9:]+)/);
        if (m)
        {
            return m[1];
        }

        return null;
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

    public async findFile(path: string): Promise<File>
    {
        const entries = path.split("/");

        if (entries.length < 2)
            return null;

        const environment = entries[0];
        const env: Environment = await this.getEnvironment(environment);
        if (env == null)
            return null;
        entries.splice(0, 1);
        return await env.root.findFile(entries);
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

    public async installModules(callback: any): Promise<boolean>
    {
        let hadModules: boolean = await Workspace.InstallModules(this._path, callback);

        for (const env of await this.listEnvironments())
        {
            hadModules = hadModules || await env.installModules(callback)
        }

        return hadModules;
    }

    private async setupWorkspace(settings: WorkspaceSettings)
    {
        const setupWindow = new SetupWorkspaceWindow(settings);
        await setupWindow.show();
        await settings.write();
    }

    public async init(progressCallback: any = null, updateProgressCategory: any = null): Promise<any>
    {
        if (!await async.isDirectory(this.path))
        {
            throw new WorkspaceError("Workspace path does not exist", this.path);
        }

        if (!await async.isDirectory(this.cachePath))
        {
            if (!await async.makeDirectory(this.cachePath))
            {
                throw new WorkspaceError("Failed to create cache directory", this.cachePath);
            }
        }

        const settings = await this.getSettings();

        if (!await settings.isValid(this.checkCertificates))
        {
            if (updateProgressCategory) updateProgressCategory("Setting up workspace...", false);
            await this.setupWorkspace(settings);
            
            if (!await settings.isValid(this.checkCertificates))
            {
                throw new WorkspaceError("Workspace setup complete, BUT", "There seem to be no downloaded certificates found.");
            }
        }

        if (await async.isFile(path.join(this._path, "Puppetfile")) &&
            !await async.isDirectory(this.modulesPath))
        {
            await this.installModules(updateProgressCategory);   
        }

        let upToDate: boolean = false;

        if (updateProgressCategory) updateProgressCategory("Processing classes...", false);

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
            if (updateProgressCategory) updateProgressCategory("Extracting class info...", false);

            const a = JSON.stringify([
                "*/manifests/**/*.pp", "*/functions/**/*.pp", "*/types/**/*.pp", "*/lib/**/*.rb"
            ]);

            await Ruby.Call("puppet-strings.rb", [a, this.cacheModulesFilePath], this.modulesPath);
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

            if (updateProgressCategory) updateProgressCategory("Compiling classes...", true);

            await pool.start();
        }

        for (const env of await this.listEnvironments())
        {
            if (updateProgressCategory) updateProgressCategory("Processing environment: " + env.name, false);
            await env.init(progressCallback, updateProgressCategory)
        }

        if (updateProgressCategory) updateProgressCategory("Processing environments complete!", false);
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

        return this.acquireEnvironment(name, environmentPath, path.join(this.cachePath, "env-" + name));
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

            const env: Environment = this.acquireEnvironment(envName, envPath, path.join(this.cachePath, "env-" + envName));
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