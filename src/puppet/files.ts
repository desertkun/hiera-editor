
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