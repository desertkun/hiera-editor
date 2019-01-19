
import * as async from "../async"
import * as path from "path"

import { Dictionary } from "../dictionary"
import { PuppetASTParser, PuppetASTClass, PuppetASTFunction, Resolver,
    PuppetASTResolvedDefinedType, PuppetASTDefinedType,
    PuppetASTEnvironment } from "./ast"

import { ResolvedResource, GlobalVariableResolver, GlobalVariableResolverResults, CompilationError } from "./util"
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

    public resolveClass(className: string, public_: boolean): Promise<PuppetASTClass>
    {
        return this.context.resolveClass(className, this.global, public_);
    }

    public resolveFunction(name: string): Promise<PuppetASTFunction>
    {
        return this.context.resolveFunction(name, this.global);
    }

    public registerHieraSource(kind: string, key: string, hierarchy: number): void
    {
        this.context.registerHieraSource(kind, key, hierarchy);
    }

    public getGlobalVariable(name: string): string
    {
        return this.global.get(name);
    }

    /*
    This method should return:
       GlobalVariableResolverResults.MISSING when global cannot be found
       GlobalVariableResolverResults.EXISTS when it exists but hierarchy is unknown
       0 and above then it exists with hierarchy as value
    */
    public hasGlobalVariable(name: string): number
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
    private readonly _hieraIncludes: Dictionary<string, number>;

    constructor (certname: string, env: Environment)
    {
        this.name = certname;
        this.env = env;

        this._facts = {};
        this._compiledClasses = new Dictionary();
        this._compiledResources = new Dictionary();
        this._compiledFunctions = new Dictionary();
        this._hieraIncludes = new Dictionary();

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

    public compilePropertyPath(className: string, propertyName: string): string
    {
        return className + "::" + propertyName;
    }

    public async hasClassProperty(className: string, propertyName: string): Promise<boolean>
    {
        const classInfo = this.env.findClassInfo(className);
        if (classInfo == null)
            return false;

        const compiled = await this.acquireClass(className, false);
        if (!compiled)
            return false;

        const propertyPath = this.compilePropertyPath(className, propertyName);

        return this.hasGlobal(propertyPath) >= 0;
    }
    
    public async removeClassProperty(className: string, hierarchy: number, propertyName: string): Promise<any>
    {
        const classInfo = this.env.findClassInfo(className);
        if (classInfo == null)
            return;

        const compiled = await this.acquireClass(className);
        if (!compiled)
            return;
            
        const hierarchyEntry = this.hierarchy.get(hierarchy);
        if (hierarchyEntry == null)
            return;

        const propertyPath = this.compilePropertyPath(className, propertyName);

        const file = hierarchyEntry.file;
        if (file == null)
            return;

        delete file.config[propertyPath];
        await file.save();
    }

    public async dumpClass(className: string): Promise<any>
    {
        const classInfo = this.env.findClassInfo(className);

        if (classInfo == null)
            return {};

        const compiled = await this.acquireClass(className, true);

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

            const hierarchy = this.hasGlobal(propertyPath);
            if (hierarchy != GlobalVariableResolverResults.MISSING)
            {
                const configValue: [any, number] = [this.getGlobal(propertyPath), hierarchy];
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
            "requiredFields": requiredFields,
            "hierarchy": this.hierarchy.dump()
        }
    }
    
    /*
    public async dumpResource(definedTypeName: string, title: string): Promise<any>
    {
        const classInfo = this._env.findDefineTypeInfo(definedTypeName);

        if (classInfo == null)
            return {};

        const compiled: ResolvedResource = await this.acquireResource(definedTypeName, title);

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
    */

    public async setClassProperty(className: string, hierarchy: number, propertyName: string, value: any): Promise<any>
    {
        const classInfo = this.env.findClassInfo(className);
        if (classInfo == null)
            return;

        const compiled = await this.acquireClass(className);
        if (!compiled)
            return;

        const hierarchyEntry = this.hierarchy.get(hierarchy);
        if (hierarchyEntry == null)
            return;

        let file = hierarchyEntry.file;
        if (file == null)
        {
            file = await hierarchyEntry.create(this.env, this._hierarchy.source);
        }
        const propertyPath = this.compilePropertyPath(className, propertyName);
        file.config[propertyPath] = value;
        await file.save();
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

    public async dump(): Promise<any>
    {
        const classes: any = {};
        const hierarchy = [];

        for (const clazz of this._compiledClasses.getValues())
        {
            if (!clazz.isPublic())
                continue;
                
            const classInfo = this.env.findClassInfo(clazz.name);

            if (classInfo == null)
                continue;

            const dump = classInfo.dump();
            const options: any = dump["options"];

            for (const key of clazz.options)
            {
                options[key] = clazz.getOption(key);
            }

            classes[clazz.name] = dump;
        }

        for (const entry of this._hierarchy.hierarhy)
        {
            hierarchy.push(entry.dump());
        }

        return {
            "classes": classes,
            "hierarchy": hierarchy,
            "hiera_includes": this._hieraIncludes.dump()
        };
    }

    public async isClassValid(className: string): Promise<boolean>
    {
        return this._compiledClasses.has(className);
    }

    public get hierarchy()
    {
        return this._hierarchy;
    }

    public setFacts(facts: any)
    {
        this._facts = facts;
    }
    
    public async assignClass(key: string, className: string, hierarchy: number): Promise<void>
    {
        const entry = this.hierarchy.get(hierarchy);

        let file = entry.file;

        if (file == null)
        {
            file = await entry.create(this.env, this.hierarchy.source);
        }

        let classes = file.config[key];
        if (classes == null)
        {
            classes = [];
            file.config[key] = classes;
        }

        if (classes.indexOf(className) >= 0)
            return;

        classes.push(className);
        await file.save();
    }

    public async removeClass(key: string, className: string, hierarchy: number): Promise<void>
    {
        const entry = this.hierarchy.get(hierarchy);

        let file = entry.file;

        if (file == null)
        {
            file = await entry.create(this.env, this.hierarchy.source);
        }

        let classes = file.config[key];
        if (classes == null)
        {
            return;
        }

        const index = classes.indexOf(className);
        if (index < 0)
            return;

        classes.splice(index, 1);
        await file.save();
    }

    /*
    This method should return:
       GlobalVariableResolverResults.MISSING when global cannot be found
       GlobalVariableResolverResults.EXISTS when it exists but hierarchy is unknown
       0 and above then it exists with hierarchy as value
    */
    public hasGlobal(key: string): number
    {
        switch (key)
        {
            case "facts":
            case "environment":
            case "trusted":
            {
                return GlobalVariableResolverResults.EXISTS;
            }
        }

        if (this._trusted_facts.hasOwnProperty(key))
            return GlobalVariableResolverResults.EXISTS;

        if (this._facts.hasOwnProperty(key))
            return GlobalVariableResolverResults.EXISTS;

        if (this.env.global.has(key) || this.env.workspace.global.has(key))
            return GlobalVariableResolverResults.EXISTS;

        for (let hierarchyLevel = 0, t = this._hierarchy.hierarhy.length; hierarchyLevel < t; hierarchyLevel++)
        {
            const e = this._hierarchy.hierarhy[hierarchyLevel];
            const f = e.file;

            if (f == null)
                continue;

            if (f.has(key))
                return hierarchyLevel;
        }

        return GlobalVariableResolverResults.MISSING;
    }

    public getGlobal(key: string): any
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
    
    public registerHieraSource(kind: string, key: string, hierarchy: number): void
    {
        switch (kind)
        {
            case "hiera_include":
            {
                this._hieraIncludes.put(key, hierarchy);
                break;
            }
        }
    }
    
    public async acquireClass(className: string, public_: boolean = true): Promise<PuppetASTClass>
    {
        const zis = this;

        return await this.resolveClass(className, {
            get: (key: string) => zis.getGlobal(key),
            has: (key: string) => zis.hasGlobal(key)
        }, public_);
    }

    public isClassResolved(className: string): boolean
    {
        className = Node.fixClassName(className);
        return this._compiledClasses.has(className);
    }
    
    public async resolveClass(className: string, global: GlobalVariableResolver, public_: boolean): Promise<PuppetASTClass>
    {
        className = Node.fixClassName(className);

        if (this._compiledClasses.has(className))
        {
            const compiled = this._compiledClasses.get(className);
            if (public_)
            {
                compiled.markPublic();
            }
            return compiled;
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

        if (public_)
        {
            clazz.markPublic();
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

        if (!await async.fileExists(this.env.manifestsPath))
        {
            console.log("Cannot compile manifests, no such file(s)");
            return;
        }

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
            has: function(key: string): number
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