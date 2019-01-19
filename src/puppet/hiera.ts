
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

    public isPropertyDefined(property: string): boolean
    {
        if (this.file == null)
            return false;

        return this.file.config.hasOwnProperty(property);
    }

    public dump(): any
    {
        return {
            "name": this.entry.name,
            "path": this.path
        };
    }

    public async create(env: Environment, hierarchy: Hierarchy): Promise<File>
    {
        const split = this.path.split("/");

        const rootPath = this.entry.datadir || hierarchy.datadir;
        const root = env.getRoot(rootPath);
        const f = await root.createFile(split);

        if (f != null)
        {
            this._file = f;
        }
        
        return f;
    }

    public async resolve(env: Environment, hierarchy: Hierarchy): Promise<boolean>
    {
        const split = this.path.split("/");

        const rootPath = this.entry.datadir || hierarchy.datadir;
        const root = env.getRoot(rootPath);
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
    private _entries: Array<CompiledHierarchyEntry>;
    private _source: Hierarchy;

    constructor(source: Hierarchy, entries: Array<CompiledHierarchyEntry>)
    {
        this._entries = entries;
        this._source = source;
    }

    public get(hierarchy: number): CompiledHierarchyEntry
    {
        if (hierarchy < 0 || hierarchy >= this._entries.length)
            return null;
        return this._entries[hierarchy];
    }

    public get source(): Hierarchy
    {
        return this._source;
    }

    public get hierarhy(): Array<CompiledHierarchyEntry>
    {
        return this._entries;
    }

    public dump(): any[]
    {
        const result: any[] = [];
        for (const entry of this._entries)
        {
            result.push(entry.dump())
        }
        return result;
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

    public getTokens(): Array<string>
    {
        const tokens: string[] = [];
        const regexp = new RegExp(/\%\{\:{0,2}([^\}]+)\}/g);

        let match;
        while ((match = regexp.exec(this.path)) != null) 
        {
            tokens.push(match[1]);
        }

        return tokens;
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

    public get entries(): Array<HierarchyEntry>
    {
        return this._hierarchy;
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
            await cc.resolve(env, this);
            c.push(cc);
        }

        return new CompiledHierarchy(this, c);
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