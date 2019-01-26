
import * as async from "../async"
import * as path from "path"

import { isObject, isArray, isString } from "util";
import { NodeContext } from "./node"
import { PuppetASTVariable } from "./ast"
import { Environment } from "./environment"
import { File, Folder } from "./files"
import { WorkspaceError } from "./util";
import { HierarchyEntryDump } from "../ipc/objects"

const forge = require('node-forge');

export class CompiledHierarchyEntry
{
    public entry: HierarchyEntry;
    public path: string;

    private _file: File;
    private _eyaml: EYaml;

    constructor (path: string, entry: HierarchyEntry)
    {
        this.path = path;
        this.entry = entry;
        this._file = null;
        this._eyaml = entry.eyaml;
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

    public dump(): HierarchyEntryDump
    {
        return {
            name: this.entry.name,
            path: this.path,
            eyaml: this.eyaml != null
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

    public get eyaml(): EYaml
    {
        return this._eyaml;
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

    private _eyaml: EYaml;

    constructor (hierarchy: Hierarchy, entry: any)
    {
        if (isString(entry))
        {
            this.path = entry;
        }
        else
        {
            this.path = entry["path"];
            this.name = entry["name"];
            this.options = entry["options"];
            this.datadir = entry["datadir"];                        
        }

        switch (hierarchy.version)
        {
            case 5:
            {
                if (this.options != null && entry["lookup_key"] == "eyaml_lookup_key")
                {
                    this._eyaml = new EYaml(this.options, hierarchy.eyaml);
                }
                break;
            }
            default:
            {
                if (this.path.endsWith(".eyaml"))
                {
                    this._eyaml = new EYaml(null, hierarchy.eyaml);
                }
                break;
            }
        }

        if (this._eyaml == null)
        {
            this._eyaml = hierarchy.eyaml;
        }
    }

    public get eyaml(): EYaml
    {
        return this._eyaml;
    }
}

export type EYamlKeyPair = [string?, string?];

export class ErrorPrivateKeyIsNotProtected extends Error
{

}

export class EYaml
{
    private _pkcs7_public_key: string;
    private _pkcs7_private_key: string;

    constructor (data: any, parent?: EYaml)
    {
        if (parent != null)
        {
            this._pkcs7_public_key = parent._pkcs7_public_key;
            this._pkcs7_private_key = parent._pkcs7_private_key;
        }

        if (data != null)
        {
            if (data.hasOwnProperty("pkcs7_public_key"))
                this._pkcs7_public_key = data["pkcs7_public_key"];
                
            if (data.hasOwnProperty("pkcs7_private_key"))
                this._pkcs7_private_key = data["pkcs7_private_key"];
        }
    }

    public encrypt(value: string, publicKey: string): any
    {
        const cert = forge.pki.certificateFromPem(publicKey);
        const p7 = forge.pkcs7.createEnvelopedData();
        p7.addRecipient(cert);
        p7.content = forge.util.createBuffer();
        p7.content.putString(value);
        p7.encrypt();
        const bytes = forge.asn1.toDer(p7.toAsn1()).getBytes();
        const raw = forge.util.encode64(bytes);
        return "ENC[PKCS7," + raw + "]";
    }

    public get private_key()
    {
        return this._pkcs7_private_key;
    }
    
    public get public_key()
    {
        return this._pkcs7_public_key;
    }
}

export class Hierarchy
{
    private _hierarchy: Array<HierarchyEntry>;
    private _datadir: string;
    private _eyaml: EYaml;
    private _version: number;
    private readonly _path: string;

    constructor (_path: string)
    {
        this._path = _path;

        this._datadir = "data";
        this._hierarchy = [
            new HierarchyEntry(this, "nodes/%{::trusted.certname}.yaml"), 
            new HierarchyEntry(this, "common.yaml")
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
                    const key = path.shift();
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

    public async load(): Promise<void>
    {
        if (!await async.isFile(this._path))
            return;

        let data: any = null;

        try
        {
            const document = await async.readYAML(this._path);
            data = document.toJSON();
        }
        catch (e)
        {
            throw new WorkspaceError("Failed to parse hiera.yaml", e.toString());
        }

        if (!isObject(data))
            throw new WorkspaceError("Failed to parse hiera.yaml", "Not an object");

        function fix(obj: any)
        {
            const result: any = {};

            for (const key in obj)
            {
                let value = obj[key];

                if (isObject(value) && !isArray(value))
                {
                    value = fix(value);
                }

                if (key.startsWith(":"))
                {
                    result[key.substr(1)] = value;
                }
                else
                {
                    result[key] = value;
                }
            }

            return result;
        }

        data = fix(data);

        this._version = data["version"] || 3;

        switch (this._version)
        {
            case 5:
            {
                const defaults = data["defaults"];

                if (defaults)
                {
                    this._datadir = defaults["datadir"] || this._datadir;
                    const lookup_key = defaults["lookup_key"];
                    if (lookup_key == "eyaml_lookup_key" && defaults.hasOwnProperty("options"))
                    {
                        this._eyaml = new EYaml(defaults["options"])
                    }
                }
                break
            }
            default:
            {
                const yaml = data["yaml"] || data["eyaml"];

                if (yaml)
                {
                    this._datadir = yaml["datadir"];
                }

                if (data.hasOwnProperty("eyaml"))
                {
                    const eyaml = data["eyaml"];
                    this._eyaml = new EYaml(eyaml);
                }
                break
            }
        }

        const hierarchy = data["hierarchy"];

        if (!isArray(hierarchy))
            throw new WorkspaceError("Failed to parse hiera.yaml", "Hierarchy is not an array");

        this._hierarchy = [];

        for (const entry of hierarchy)
        {
            if (isString(entry))
            {
                this._hierarchy.push(new HierarchyEntry(this, entry));
            }
            if (isObject(entry))
            {
                if (entry.hasOwnProperty("path"))
                {
                    this._hierarchy.push(new HierarchyEntry(this, entry));
                }
                else if (entry.hasOwnProperty("paths"))
                {
                    const paths: string[] = entry["paths"];

                    for (const path_ of paths)
                    {
                        entry["path"] = path_;

                        this._hierarchy.push(new HierarchyEntry(this, entry));
                    }
                }
            }
        }
    }

    public get path(): string
    {
        return this._path;
    }

    public get version(): number
    {
        return this._version;
    }

    public get eyaml(): EYaml
    {
        return this._eyaml;
    }

    public get datadir(): string
    {
        return this._datadir;
    }
}