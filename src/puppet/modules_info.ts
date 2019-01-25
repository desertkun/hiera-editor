
import * as path from "path";
import * as async from "../async";

import { Dictionary } from "../dictionary";
import { PuppetClassInfo, PuppetDefinedTypeInfo, PuppetFunctionInfo } from "./class_info"
import { CompiledPromisesCallback } from "./util"
import { Ruby } from "./ruby"
import { rubyBridge } from "../global"

const slash = require('slash');

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

    public async loadRubyFunctions()
    {
        const fixedScripts: string[] = [];

        for (const f of this._functions.getValues())
        {
            if (!f.isRuby())
                continue;
            
            console.log("Loading function " + f.name + " (" + f.type + ")");
            fixedScripts.push(slash(path.join(this._modulesPath, f.file)));
        }

        if (fixedScripts.length == 0)
            return;

        await rubyBridge.load(fixedScripts);
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

        async function compileFiles(files: any, modulesPath: string)
        {
            console.log("Compiling " + Object.keys(files).join(", ") + "...");

            try
            {
                await Ruby.CallAndSendStdIn("puppet-parser.rb", [], modulesPath, JSON.stringify(files));
                console.log("Compiling done!");
            }
            catch (e)
            {
                console.log("Failed to compile: " + e);
            }

            cb.done += 1;

            if (cb.callback) cb.callback(cb.done);
        }

        const compileFileList: Array<[string, string]> = [];

        for (let clazz of classes)
        {
            const file = path.join(this._cachePath, "obj", clazz.file + ".o");

            if (cachedStats[clazz.file])
            {
                const cachedStat = cachedStats[clazz.file];
                if (cachedStat != null)
                {
                    const cachedTime: Number = cachedStat.mtimeMs;

                    const realStat = realStats[clazz.file];
                    
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

            compileFileList.push([file, clazz.source]);
        }

        for (let definedType of definedTypes)
        {
            const file = path.join(this._cachePath, "obj", definedType.file + ".o");

            if (cachedStats[definedType.file])
            {
                const cachedStat = cachedStats[definedType.file];
                if (cachedStat != null)
                {
                    const cachedTime: Number = cachedStat.mtimeMs;

                    const realStat = realStats[definedType.file];
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

            compileFileList.push([file, definedType.source]);
        }

        for (let function_ of functions)
        {
            const file = path.join(this._cachePath, "func", function_.file + ".o");

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

            compileFileList.push([file, function_.source]);
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

            result.push([compileFiles, files, this._modulesPath]);
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