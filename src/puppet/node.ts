
import * as async from "../async"
import * as path from "path"

import { Dictionary } from "../dictionary"
import { PuppetASTParser, PuppetASTClass, PuppetASTFunction, Resolver,
    PuppetASTDefinedType, PuppetASTEnvironment, PuppetASTResource, HieraSourceResolveCallback,
    ResolvedFunction, PuppetASTContainerContext,
    PuppetASTObject} from "./ast"

import { GlobalVariableResolver, GlobalVariableResolverResults, CompilationError } from "./util"
import { Environment } from "./environment"
import { CompiledHierarchy } from "./hiera"
import { ClassDump, ResourceDump, NodeDump, ClassInfoDump, DefiledTypeInfoDump, NodeDefinedTypeDump } from "../ipc/objects"
import { rubyBridge } from "../global"

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

    public resolveDefinedType(definedTypeName: string, public_: boolean): Promise<PuppetASTDefinedType>
    {
        return this.context.resolveDefinedType(definedTypeName, this.global, public_);
    }

    public resolveClass(className: string, public_: boolean): Promise<PuppetASTClass>
    {
        return this.context.resolveClass(className, this.global, public_);
    }

    public resolveFunction(context: PuppetASTContainerContext, resolver: Resolver, name: string): Promise<ResolvedFunction>
    {
        return this.context.resolveFunction(context, resolver, name, this.global);
    }

    public async resolveHieraSource(kind: string, key: string, resolve: HieraSourceResolveCallback): Promise<void>
    {
        await this.context.registerHieraSource(kind, key, resolve);
    }
    
    public registerResource(resource: PuppetASTResource): void
    {
        this.context.registerResource(resource);
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
    private readonly _compiledFunctions: Dictionary<string, ResolvedFunction>;
    private readonly _compiledDefinedTypes: Dictionary<string, PuppetASTDefinedType>;
    private readonly _registeredResources: Dictionary<string, Dictionary<string, PuppetASTResource>>;
    private readonly _hieraIncludes: Dictionary<string, [number, HieraSourceResolveCallback]>;
    private readonly _hieraResources: Dictionary<string, [number, HieraSourceResolveCallback]>;

    constructor (certname: string, env: Environment)
    {
        this.name = certname;
        this.env = env;

        this._facts = {};
        this._compiledClasses = new Dictionary();
        this._compiledDefinedTypes = new Dictionary();
        this._registeredResources = new Dictionary();
        this._compiledFunctions = new Dictionary();
        this._hieraIncludes = new Dictionary();
        this._hieraResources = new Dictionary();

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
    
    public async removeProperty(hierarchy: number, property: string): Promise<any>
    {
        const hierarchyEntry = this.hierarchy.get(hierarchy);
        if (hierarchyEntry == null)
            return;

        const file = hierarchyEntry.file;
        if (file == null)
            return;

        delete file.config[property];
        await file.save();
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

    public async dumpClass(className: string): Promise<ClassDump>
    {
        const classInfo = this.env.findClassInfo(className);

        if (classInfo == null)
            return null;

        const compiled = await this.acquireClass(className, true);

        const types: any = {};
        const errors: any = {};
        const hints: any = {};
        const fields: string[] = [];
        const requiredFields: string[] = [];
        const values: any = {};
        const modified: any = {};
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
                values[name] = property.value;
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

            modified[name] = property.hierarchy;
        }

        return {
            "icon": classInfo.options.icon,
            "values": values,
            "classInfo": classInfo.dump(),
            "modified": modified,
            "types": types,
            "errors": errors,
            "propertyHints": hints,
            "hints": classHints,
            "fields": fields,
            "requiredFields": requiredFields,
            "hierarchy": this.hierarchy.dump()
        }
    }
    
    public registerResource(resource: PuppetASTResource): void
    {
        const definedTypeName = resource.definedType.name;

        let titles = this._registeredResources.get(definedTypeName);
        if (titles == null)
        {
            titles = new Dictionary();
            this._registeredResources.put(definedTypeName, titles);
        }

        titles.put(resource.getTitle(), resource);
    }
    
    public async dumpResource(definedTypeName: string, title: string): Promise<ResourceDump>
    {
        const definedTypeInfo = this.env.findDefineTypeInfo(definedTypeName);

        if (definedTypeInfo == null)
            return null;
            
        if (!this._registeredResources.has(definedTypeName))
            return null;
           
        const titles = this._registeredResources.get(definedTypeName);

        if (!titles.has(title))
            return null;
        
        const compiled = titles.get(title);

        const defaultValues: any = {};
        const types: any = {};
        const fields: string[] = [];
        const modified: any = {};
        const requiredFields: string[] = [];
        const errors: any = {};
        const hints: any = {};
        const values: any = {};
        const options: any = {};

        for (const name of compiled.resolvedFields.getKeys())
        {
            const property = compiled.resolvedFields.get(name);

            if (definedTypeInfo.defaults.indexOf(name) < 0)
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

            if (property.hasValue)
            {
                values[name] = property.value;
            };

            if (property.hasHints)
            {
                hints[name] = property.hints;
            }

            if (property.hasValue)
            {
                defaultValues[name] = property.value;
            }

            modified[name] = property.hierarchy;
            fields.push(name);
        }

        for (const option of compiled.options)
        {
            options[option] = compiled.getOption(option);
        }
        
        return {
            "icon": definedTypeInfo.options.icon,
            "values": values,
            "definedTypeInfo": definedTypeInfo.dump(),
            "types": types,
            "errors": errors,
            "options": options,
            "hierarchyLevel": compiled.hierarchy,
            "propertyHints": hints,
            "fields": fields,
            "modified": modified,
            "hints": hints,
            "requiredFields": requiredFields,
            "hierarchy": this.hierarchy.dump()
        }
    }

    public async setResourceProperty(definedTypeName: string, title: string, 
        hierarchy: number, key: string, propertyName: string, value: any): Promise<any>
    {
        if (propertyName == "title")
            return;

        const hierarchyEntry = this.hierarchy.get(hierarchy);
        if (hierarchyEntry == null)
            return;

        let file = hierarchyEntry.file;
        if (file == null)
        {
            file = await hierarchyEntry.create(this.env, this._hierarchy.source);
        }

        let config = file.config[key];
        if (config == null)
        {
            config = {};
            file.config[key] = config;
        }

        const d = config[definedTypeName];

        if (d[title] == null)
            d[title] = {};

        const t = d[title];

        t[propertyName] = value;

        await file.save();
        await this.invalidateResources(key);
    }
    
    public async removeResourceProperty(definedTypeName: string, title: string, 
        hierarchy: number, key: string, propertyName: string): Promise<any>
    {
        const hierarchyEntry = this.hierarchy.get(hierarchy);
        if (hierarchyEntry == null)
            return;

        const file = hierarchyEntry.file;
        if (file == null)
            return;

        const config = file.config[key];
        if (config == null)
            return;
        
        const d = config[definedTypeName];
        if (d == null)
            return;

        const t = d[title];
        if (t == null)
            return;

        delete t[propertyName];

        await file.save();
        await this.invalidateResources(key);
    }

    public async setProperty(hierarchy: number, property: string, value: any): Promise<any>
    {
        const hierarchyEntry = this.hierarchy.get(hierarchy);
        if (hierarchyEntry == null)
            return;

        let file = hierarchyEntry.file;
        if (file == null)
        {
            file = await hierarchyEntry.create(this.env, this._hierarchy.source);
        }
        file.config[property] = value;
        await file.save();
    }
    
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
    
    public async invalidateResources(hieraResourceName: string): Promise<void>
    {
        const resouces = this._hieraResources.get(hieraResourceName);

        if (resouces == null)
            return;

        const [hierarchy, resolve] = resouces;

        // resolve again
        resouces[0] = await resolve();
    }
    
    public async isResourceValid(definedTypeName: string, title: string): Promise<boolean>
    {
        if (this._registeredResources.has(definedTypeName))
        {
            const titles = this._registeredResources.get(definedTypeName);
            return titles.has(title);
        }

        return false;
    }

    public async invalidate(): Promise<void>
    {
        this._compiledClasses.clear();
        this._compiledDefinedTypes.clear();
    }

    public async dump(): Promise<NodeDump>
    {
        const classes: { [key:string]: ClassInfoDump } = {};
        const resources: { [key:string]: NodeDefinedTypeDump } = {};
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

        for (const definedTypeName of this._registeredResources.getKeys())
        {
            const definedTypeInfo = this.env.findDefineTypeInfo(definedTypeName);

            if (definedTypeInfo == null)
                continue;

            const dump = definedTypeInfo.dump();
            const titles: any = {};

            const res: NodeDefinedTypeDump = {
                definedType: dump,
                titles: titles
            };

            resources[definedTypeName] = res;

            const titles_ = this._registeredResources.get(definedTypeName);
            for (const title of titles_.getKeys())
            {
                const resource = titles_.get(title);

                const options: any = {};

                for (const key of resource.options)
                {
                    options[key] = resource.getOption(key);
                }

                titles[title] = {
                    "options": options
                };
            }
        }

        for (const entry of this._hierarchy.hierarhy)
        {
            hierarchy.push(entry.dump());
        }

        const hiera_includes: {[key: string]: number} = {};
        const hiera_resources: {[key: string]: number} = {};

        for (const key of this._hieraIncludes.getKeys())
        {
            const [hierarchy, resolve] = this._hieraIncludes.get(key);
            hiera_includes[key] = hierarchy;
        }

        for (const key of this._hieraResources.getKeys())
        {
            const [hierarchy, resolve] = this._hieraResources.get(key);
            hiera_resources[key] = hierarchy;
        }

        return {
            classes: classes,
            resources: resources,
            hierarchy: hierarchy,
            hiera_includes: hiera_includes,
            hiera_resources: hiera_resources
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
    
    public async createResource(key: string, hierarchy: number, definedTypeName: string, title: string): Promise<boolean>
    {
        const entry = this.hierarchy.get(hierarchy);

        let file = entry.file;

        if (file == null)
        {
            file = await entry.create(this.env, this.hierarchy.source);
        }

        let resources = file.config[key];
        if (resources == null)
        {
            resources = {};
            file.config[key] = resources;
        }

        let definedType = resources[definedTypeName];
        if (definedType == null)
        {
            definedType = {}
            resources[definedTypeName] = definedType;
        }

        definedType[title] = {};

        await file.save();

        return true;
    }

    public async removeClass(key: string, className: string, hierarchy: number): Promise<void>
    {
        const entry = this.hierarchy.get(hierarchy);

        let file = entry.file;
        if (file == null)
            return;

        let classes = file.config[key];
        if (classes == null)
            return;

        const index = classes.indexOf(className);
        if (index < 0)
            return;

        classes.splice(index, 1);
        await file.save();
    }

    public async removeResource(key: string, hierarchy: number, definedTypeName: string, title: string): Promise<boolean>
    {
        const entry = this.hierarchy.get(hierarchy);

        let file = entry.file;
        if (file == null)
            return false;

        const resources = file.config[key];
        if (resources == null)
            return false;

        const definedType = resources[definedTypeName];
        if (definedType == null)
            return false;

        if (!definedType.hasOwnProperty(title))
            return false;

        delete definedType[title];

        await file.save();
        return true;
    }

    public async removeResources(key: string, hierarchy: number, definedTypeName: string): Promise<boolean>
    {
        const entry = this.hierarchy.get(hierarchy);

        let file = entry.file;
        if (file == null)
            return false;

        const resources = file.config[key];
        if (resources == null)
            return false;

        if (!resources.hasOwnProperty(definedTypeName))
            return false;
            
        delete resources[definedTypeName];

        await file.save();
        return true;
    }

    public async removeAllResources(key: string, hierarchy: number)
    {
        const entry = this.hierarchy.get(hierarchy);

        let file = entry.file;
        if (file == null)
            return false;

        const resources = file.config[key];
        if (resources == null)
            return false;

        delete file.config[key];

        await file.save();
        return true;
    }

    public async renameResource(key: string, hierarchy: number, definedTypeName: string, title: string, newTitle: string)
    {
        const entry = this.hierarchy.get(hierarchy);

        let file = entry.file;
        if (file == null)
            return false;

        const resources = file.config[key];
        if (resources == null)
            return false;

        const definedType = resources[definedTypeName];
        if (definedType == null)
            return false;

        if (!definedType.hasOwnProperty(title))
            return false;

        const moveTo = definedType[title];
        delete definedType[title];
        definedType[newTitle] = moveTo;

        await file.save();
        return true;
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
    
    public async registerHieraSource(kind: string, key: string, resolve: HieraSourceResolveCallback): Promise<void>
    {
        const hierarchy = await resolve();

        switch (kind)
        {
            case "hiera_include":
            {
                this._hieraIncludes.put(key, [hierarchy, resolve]);
                break;
            }
            case "hiera_resources":
            {
                this._hieraResources.put(key, [hierarchy, resolve]);
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

    public async resolveFunction(context: PuppetASTContainerContext, resolver: Resolver, 
        name: string, global: GlobalVariableResolver): Promise<ResolvedFunction>
    {
        name = Node.fixClassName(name);

        if (this._compiledFunctions.has(name))
        {
            return this._compiledFunctions.get(name);
        }

        const functionInfo = this.env.findFunctionInfo(name);
        if (functionInfo == null)
            return null;

        let resolved: ResolvedFunction;

        if (functionInfo.isPuppet())
        {
            
            console.log("Compiling function " + name + " (for environment " + this.name + ")");

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

            resolved = async (args: PuppetASTObject[]) => 
            {
                return await function_.apply(context, resolver, args);
            }
        }
        else
        {
            
            resolved = async (args: PuppetASTObject[]) => 
            {
                const resolvedArgs: any[] = [];

                for (const arg of args)
                {
                    const a = await arg.resolve(context, resolver);
                    resolvedArgs.push(a);
                }

                return await rubyBridge.call(name, resolvedArgs);
            }
        }

        this._compiledFunctions.put(name, resolved);
        return resolved;
    }

    public async resolveDefinedType(definedTypeName: string, global: GlobalVariableResolver, public_: boolean): Promise<PuppetASTDefinedType>
    {
        if (this._compiledDefinedTypes.has(definedTypeName))
        {
            const compiled = this._compiledDefinedTypes.get(definedTypeName);

            if (public_)
            {
                compiled.markPublic();
            }

            return compiled;
        }

        console.log("Compiling resource " + definedTypeName + " (for environment " + this.name + ")");

        const definedTypeInfo = this.env.findDefineTypeInfo(definedTypeName);

        if (definedTypeInfo == null)
        {
            console.log("Cannot resolve defined type: " + definedTypeName + " (not exists)")
            return;
        }

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

        if (public_)
        {
            definedType.markPublic();
        }

        this._compiledDefinedTypes.put(definedTypeName, definedType);

        return definedType;
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