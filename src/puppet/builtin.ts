
import { PuppetASTObject, PuppetASTContainerContext, Resolver, 
    ResolveError, PuppetASTReturn, PuppetASTResourcesDeclaration, PuppetASTVariable,
    OrderedDictionary, 
    PuppetASTValue,
    PuppetASTPrimitive,
    PuppetASTList, 
    PuppetASTKeyedEntry} from "./ast";
import { isArray, isObject } from "util";
import { GlobalVariableResolverResults } from "./util"

type BuiltinFunctionCallback = (caller: PuppetASTObject, 
    context: PuppetASTContainerContext, resolver: Resolver, args: any[]) => Promise<any>;

const BuiltInFunctions: any = {
    "alert": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[]): Promise<any>
    {
        console.log(args[0]);
    },
    "create_resources": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[]): Promise<any>
    {
        // do nothing
    },
    "ensure_packages": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[]): Promise<any>
    {
        // do nothing
    },
    "fail": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        throw new ResolveError(caller, args[0]);
    },
    "defined": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        const obj: PuppetASTObject = args[0];

        if (obj instanceof PuppetASTVariable)
        {
            const var_ = <PuppetASTVariable>obj;
            const def = await var_.defined(context, resolver);
            return def != GlobalVariableResolverResults.MISSING;
        }

        const def = await obj.resolve(context, resolver);
        return <boolean>(def);
    },
    "template": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        // can't do much
        return "";
    },
    "require": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        await resolver.resolveClass(args[0], true);
    },
    "contain": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        await resolver.resolveClass(args[0], true);
    },
    "include": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        const className = args[0];
        await resolver.resolveClass(className, true);
    },
    "hiera_include": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        const key = args[0];

        const resolve = async (): Promise<number> =>
        {
            const hierarchy = resolver.hasGlobalVariable(key);

            if (hierarchy == GlobalVariableResolverResults.MISSING)
            {
                return hierarchy;
            }

            const classes = resolver.getGlobalVariable(key);

            if (isArray(classes))
            {
                for (const className of classes)
                {
                    try
                    {
                        const resolved = await resolver.resolveClass(className, true);
                        resolved.setOption("hiera_include", key);
                    }
                    catch (e)
                    {
                        console.log("Failed to resolve class " + className + " from hiera_include('" + key + "'): " + e.toString());
                    }
                }
            }

            return hierarchy;
        };

        resolver.resolveHieraSource("hiera_include", key, resolve);
    },
    "hiera_resources": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        const key = args[0];

        const resolve = async (): Promise<number> => 
        {
            const hierarchy = resolver.hasGlobalVariable(key);
    
            if (hierarchy == GlobalVariableResolverResults.MISSING)
            {
                return hierarchy;
            }

            const resources = resolver.getGlobalVariable(key);

            if (isObject(resources))
            {
                for (const definedTypeName in resources)
                {
                    const titles = resources[definedTypeName];
                
                    // TODO
                    // we declare resources by simulating valid PuppetASTResourcesEntry
                    // later that sould be fixed by actually evaluating ruby scripts

                    const bodies = new Array<PuppetASTObject>();

                    for (const title in titles)
                    {
                        const entry = new OrderedDictionary();
                        entry.put("title", new PuppetASTValue(title));
                        const ops = new Array<PuppetASTObject>();
                        entry.put("ops", new PuppetASTList(ops));

                        const properties = titles[title];

                        for (const propertyName in properties)
                        {
                            const value = properties[propertyName];

                            ops.push(new PuppetASTKeyedEntry([
                                new PuppetASTValue(propertyName),
                                new PuppetASTValue(value)
                            ]));
                        }

                        bodies.push(entry);
                    }

                    const options = new OrderedDictionary();
                    options.put("type", new PuppetASTPrimitive(definedTypeName));
                    options.put("bodies", new PuppetASTList(bodies));

                    const resourcesEntry = new PuppetASTResourcesDeclaration([options], true)
                    resourcesEntry.hierarchy = hierarchy;
                    
                    try
                    {
                        await resourcesEntry.resolve(context, resolver);
                    }
                    catch (e)
                    {
                        console.log(e.toString());
                        continue;
                    }

                    for (const resource of resourcesEntry.entries.getValues())
                    {
                        resource.setOption("hiera_resources", key);
                    }
                }
            }

            return hierarchy;
        };

        await resolver.resolveHieraSource("hiera_resources", key, resolve);
    },
    "return": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        throw new PuppetASTReturn(args[0]);
    }
};

export function GetBuiltinFunction(name: string): BuiltinFunctionCallback
{
    return BuiltInFunctions[name];
}