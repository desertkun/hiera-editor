
import * as path from "path";
import * as async from "../async";

import { Environment } from "./environment"
import { Dictionary } from "../dictionary";
import { PuppetASTParser, PuppetASTClass, PuppetASTDefinedType, PuppetASTFunction, PuppetASTResolvedDefinedType, Resolver } from "../puppet/ast";
import { ResolvedResource, GlobalVariableResolver, CompilationError } from "./util"

const slash = require('slash');

export class Folder
{
    private readonly _name: string;
    private readonly _path: string;
    private readonly _env: Environment;
    private readonly _localPath: string;
    private readonly _parent: Folder;

    private readonly _nodes: Dictionary<string, File>;
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

    public async findFile(localPath: Array<string>): Promise<File>
    {
        if (localPath.length > 1)
        {
            const dir = await this.getFolder(localPath[0]);
            if (dir == null)
                return null;
            localPath.splice(0, 1);
            return await dir.findFile(localPath);
        }

        return await this.getFile(localPath[0]);
    }

    public async createFile(name: string): Promise<File>
    {
        const entryPath = path.join(this._path, File.FilePath(name));

        if (await async.isDirectory(entryPath))
        {
            return null;
        }

        if (await async.isFile(entryPath))
        {
            return null;
        }

        const node = await this.acquireFile(this._env, name, entryPath, slash(path.join(this._localPath, name)));

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

    public async removeFile(name: string): Promise<boolean>
    {
        const node = await this.getFile(name);

        if (node == null)
            return false;
            
        const entryPath = path.join(this._path, File.FilePath(name));

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

    private async acquireFile(env: Environment, name: string, filePath: string, nodePath: string): Promise<File>
    {
        if (this._nodes.has(name))
        {
            return this._nodes.get(name);
        }

        const newNode = new File(env, name, filePath, nodePath, this);
        this._nodes.put(name, newNode);
        await newNode.init();
        return newNode;
    }

    public async getFile(name: string): Promise<File>
    {
        const entryPath = path.join(this._path, File.FilePath(name));

        if (!await async.isFile(entryPath))
        {
            return null;
        }

        return await this.acquireFile(this._env, name, entryPath, slash(path.join(this._localPath, name)));
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

    public async getNodes(): Promise<Array<File>>
    {
        if (!await async.fileExists(this._path))
        {
            return [];
        }

        if (!await async.isDirectory(this._path))
        {
            return [];
        }

        const result:Array<File> = [];

        for (const entry of await async.listFiles(this._path))
        {
            const nodeName = File.ValidatePath(entry);

            if (nodeName == null)
                continue;

            const entryPath = path.join(this._path, entry);

            if (await async.isFile(entryPath))
            {
                result.push(await this.acquireFile(
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

export class File
{
    private readonly _name: string;
    private readonly _filePath: string;
    private readonly _nodePath: string;
    private readonly _env: Environment;
    private readonly _parent: Folder;
    private _config: any;

    constructor(env: Environment, name: string, filePath: string, nodePath: string, parent: Folder)
    {
        this._env = env;
        this._name = name;
        this._filePath = filePath;
        this._nodePath = nodePath;
        this._config = {};
        this._parent = parent;
    }

    static FilePath(name: string): string
    {
        return name + ".yaml";
    }

    static ValidatePath(pathName: string): string
    {
        if (!pathName.endsWith(".yaml"))
            return null;

        return pathName.substr(0, pathName.length - 5);
    }

    public async remove(): Promise<boolean>
    {
        if (this._parent == null)
            return;

        return await this._parent.removeFile(this._name);
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
    
    public dump()
    {
        return {
            "env": this._env.name
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

    public async init()
    {
        if (await async.isFile(this.path))
        {
            await this.parse();
        }
    }
    
    public async save()
    {
        const ordered: any = {};

        for (const key of Object.keys(this._config).sort())
        {
            ordered[key] = this._config[key];
        }

        await async.writeYAML(this.path, ordered);
    }

    public async parse()
    {
        const document = await async.readYAML(this.path);
        this._config = document.toJSON();
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


    public has(key: string): boolean
    {
        return this._config.hasOwnProperty(key);
    }

    public get(key: string): string
    {
        return this._config[key];
    }
}