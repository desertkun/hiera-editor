
import * as async from "../async"
import * as path from "path"

import { Dictionary } from "../dictionary"
import { PuppetASTParser, PuppetASTClass, PuppetASTFunction, Resolver,
    PuppetASTResolvedDefinedType, PuppetASTDefinedType,
    PuppetASTEnvironment } from "./ast"

import { ResolvedResource, GlobalVariableResolver, CompilationError } from "./util"
import { Environment } from "./environment"
import { CompiledHierarchy } from "./hiera"

const parseDomain = require('domain-name-parser');

class NodeContextResolver implements Resolver
{
    private context: NodeContext;
    private global: GlobalVariableResolver;

    constructor (context: NodeContext, global: GlobalVariableResolver)
    {
        this.context = context;
        this.global = global;
    }

    public getNodeName(): string
    {
        return this.context.name;
    }

    public resolveClass(className: string): Promise<PuppetASTClass>
    {
        return this.context.resolveClass(className, this.global);
    }

    public resolveFunction(name: string): Promise<PuppetASTFunction>
    {
        return this.context.resolveFunction(name, this.global);
    }

    public getGlobalVariable(name: string): string
    {
        return this.global.get(name);
    }

    public hasGlobalVariable(name: string): boolean
    {
        return this.global.has(name);
    }
}

export class NodeContext
{
    public readonly name: string;
    public readonly env: Environment;
    public readonly ast: PuppetASTEnvironment;
    private _facts: any;
    private _trusted_facts: any;
    private _hierarchy: CompiledHierarchy;

    private readonly _compiledClasses: Dictionary<string, PuppetASTClass>;
    private readonly _compiledFunctions: Dictionary<string, PuppetASTFunction>;
    private readonly _compiledResources: Dictionary<string, Dictionary<string, ResolvedResource>>;

    constructor (certname: string, env: Environment)
    {
        this.name = certname;
        this.env = env;

        this._facts = {};
        this._compiledClasses = new Dictionary();
        this._compiledResources = new Dictionary();
        this._compiledFunctions = new Dictionary();

        this.ast = new PuppetASTEnvironment(env.name);

        const d = parseDomain(certname);

        this._trusted_facts = {
            "authenticated": "local",
            "certname": certname,
            "domain": d.domain,
            "hostname": d.host
        };
    }

    public get facts()
    {
        return this._facts;
    }

    public get rootFacts(): any
    {
        return {
            "facts": this._facts,
            "trusted": this._trusted_facts
        }
    }

    public get hierarchy()
    {
        return this._hierarchy;
    }

    public setFacts(facts: any)
    {
        this._facts = facts;
    }
    
    public hasGlobal(key: string): boolean
    {
        switch (key)
        {
            case "facts":
            case "environment":
            case "trusted":
            {
                return true;
            }
        }

        if (this._trusted_facts.hasOwnProperty(key))
            return true;

        if (this._facts.hasOwnProperty(key))
            return true;

        if (this.env.global.has(key) || this.env.workspace.global.has(key))
            return true;

        for (const e of this._hierarchy.hierarhy)
        {
            const f = e.file;

            if (f == null)
                continue;

            if (f.has(key))
                return true;
        }

        return false;
    }

    public getGlobal(key: string): string
    {
        switch (key)
        {
            case "facts":
            {
                return this._facts;
            }
            case "trusted":
            {
                return this._trusted_facts;
            }
            case "environment":
            {
                return this.env.name;
            }
        }

        if (this._trusted_facts.hasOwnProperty(key))
            return this._trusted_facts[key];

        if (this._facts.hasOwnProperty(key))
            return this._facts[key];

        if (this.env.global.has(key))
            return this.env.global.get(key);

        if (this.env.workspace.global.has(key))
            return this.env.workspace.global.get(key);

        for (const e of this._hierarchy.hierarhy)
        {
            const f = e.file;

            if (f == null)
                continue;

            if (f.has(key))
                return f.get(key);
        }

        return null;
    }
    
    public async acquireClass(className: string): Promise<PuppetASTClass>
    {
        const zis = this;

        return await this.resolveClass(className, {
            get: (key: string) => zis.getGlobal(key),
            has: (key: string) => zis.hasGlobal(key)
        });
    }

    public isClassResolved(className: string): boolean
    {
        className = Node.fixClassName(className);
        return this._compiledClasses.has(className);
    }
    
    public async resolveClass(className: string, global: GlobalVariableResolver): Promise<PuppetASTClass>
    {
        className = Node.fixClassName(className);

        if (this._compiledClasses.has(className))
        {
            return this._compiledClasses.get(className);
        }

        console.log("Compiling class " + className + " (for environment " + this.name + ")");

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
            await clazz.resolve(clazz, new NodeContextResolver(this, global));
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

        console.log("Compiling function " + name + " (for environment " + this.name + ")");

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

        console.log("Compiling resource " + definedTypeName + " (with title " + title + " for environment " + this.name + ")");

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
            resource = await definedType.resolveAsResource(title, properties, new NodeContextResolver(this, global));
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
    
    public async resolveManifests(global: GlobalVariableResolver): Promise<void>
    {
        console.log("Compiling manifests (for node " + this.name + " / environment " + this.env.name + ")");

        const modulesInfo = this.env.loadModulesInfo();

        if (modulesInfo == null)
            throw new CompilationError("Cannot compile, no module info");
            
        const files_ = await async.listFiles(this.env.manifestsPath);
        const files = files_.filter((name) => name.endsWith(".pp"));
        files.sort();
        
        for (const file of files)
        {
            const compiledPath = this.env.getCompiledPath(path.join(this.env.manifestsName, file));
            let parsedJSON = null;
    
            try
            {
                parsedJSON = await async.readJSON(compiledPath);
            }
            catch (e)
            {
                throw new CompilationError("Failed to parse manifest " + path.join(this.env.manifestsName, file));
            }
    
            const obj = PuppetASTParser.Parse(parsedJSON);
    
            const resolver = new NodeContextResolver(this, global);
            await obj.resolve(this.ast, resolver);
            await this.ast.resolve(this.ast, resolver);

        }
    }

    public resolver(): NodeContextResolver
    {
        return new NodeContextResolver(this, this.globalResolver());
    }

    public globalResolver(): GlobalVariableResolver
    {
        const zis = this;

        return {
            has: function(key: string): boolean
            {
                return zis.hasGlobal(key);
            },
            get: function(key: string)
            {
                return zis.getGlobal(key)
            }
        }
    }

    public async init(facts?: any): Promise<void>
    {
        if (facts != null)
        {
            this.setFacts(facts);
        }

        this._hierarchy = await this.env.hierarchy.compile(this, this.env);

        await this.resolveManifests(this.globalResolver());
    }
}

export class Node
{
    public static fixClassName(className: string): string
    {
        const path = className.split("::");
    
        if (path.length < 2)
            return className;

        if (path[0] == "")
            path.splice(0, 1);

        return path.join("::");
    }
}