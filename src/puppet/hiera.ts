
import * as async from "../async"
import * as path from "path"

import { isObject, isArray, isString } from "util";
import { NodeContext } from "./node"
import { PuppetASTVariable } from "./ast"
import { Environment } from "./environment"
import { File, Folder } from "./files"

export class CompiledHierarchyEntry
{
    public entry: HierarchyEntry;
    public path: string;

    private _file: File;

    constructor (path: string, entry: HierarchyEntry)
    {
        this.path = path;
        this.entry = entry;
        this._file = null;
    }

    public get file(): File
    {
        return this._file;
    }

    public async resolve(env: Environment): Promise<boolean>
    {
        const split = this.path.split("/");

        const root = this.entry.datadir != null ? 
            new Folder(env, this.entry.datadir, path.join(env.path, this.entry.datadir), 
                this.entry.datadir, null) : env.root;

        const f = await root.findFile(split);

        if (f == null)
        {
            return false;
        }
        else
        {
            this._file = f;
            return true;
        }
    }
}

export class CompiledHierarchy
{
    private _hierarchy: Array<CompiledHierarchyEntry>;

    constructor(hierarchy: Array<CompiledHierarchyEntry>)
    {
        this._hierarchy = hierarchy;
    }

    public get hierarhy(): Array<CompiledHierarchyEntry>
    {
        return this._hierarchy;
    }
}

export class HierarchyEntry
{
    public name: string;
    public path: string;
    public datadir: string;
    public options: any;

    constructor (path: string, name?: string, options?: any, datadir?: any)
    {
        this.path = path;
        this.name = name;
        this.options = options;
        this.datadir = datadir;
    }
}

export class Hierarchy
{
    private _hierarchy: Array<HierarchyEntry>;
    private _datadir: string;
    private readonly _path: string;

    constructor (_path: string)
    {
        this._path = _path;

        this._datadir = "data";
        this._hierarchy = [
            new HierarchyEntry("nodes/%{::trusted.certname}"), 
            new HierarchyEntry("common")
        ];
    }

    public async compile(context: NodeContext, env: Environment): Promise<CompiledHierarchy>
    {
        const c: CompiledHierarchyEntry[] = [];
        const resolver = context.resolver();

        for (const entry of this._hierarchy)
        {
            const compiledEntryPath = entry.path.replace(/\%\{\:{0,2}([^\}]+)\}/, (orig: string, match: string) => 
            {
                const path: string[] = match.split(".");

                let value: any = context.rootFacts[path[0]];
                path.splice(0, 1);

                while (path.length > 0)
                {
                    if (value == null)
                        return "";
                    const key = path.pop();
                    value = value[key];
                }

                return value || "";
            });
            
            const cc = new CompiledHierarchyEntry(compiledEntryPath, entry);
            await cc.resolve(env);
            c.push(cc);
        }

        return new CompiledHierarchy(c);
    }

    public async load(): Promise<boolean>
    {
        if (!await async.isFile(this._path))
            return false;

        let data: any = null;

        try
        {
            data = await async.readYAML(this._path);
        }
        catch (e)
        {
            return false;
        }

        if (!isObject(data))
            return false;

        const hierarchy = data["hierarchy"];

        if (!isArray(hierarchy))
            return false;

        this._hierarchy = [];

        for (const entry of hierarchy)
        {
            if (isString(entry))
            {
                this._hierarchy.push(new HierarchyEntry(entry));
            }
            if (isObject(entry))
            {
                this._hierarchy.push(new HierarchyEntry(
                    entry["path"],
                    entry["name"],
                    entry["options"],
                    entry["datadir"]));
            }
        }

        return true;
    }

    public get path(): string
    {
        return this._path;
    }

    public get datadir(): string
    {
        return this._datadir;
    }
}