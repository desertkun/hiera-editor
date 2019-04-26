
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
    "fact": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        const obj: PuppetASTObject = args[0];
        const factName = await obj.resolve(context, resolver);
        const facts = resolver.getGlobalVariable("facts");
        return facts[factName];
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

        await resolver.resolveHieraSource("hiera_include", key, resolve);
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
    },
    "all": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "annotate": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "any": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "assert_type": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "binary_file": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "break": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "call": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "convert_to": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "crit": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "debug": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "dig": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "digest": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "each": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "emerg": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "empty": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "epp": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "err": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "eyaml_lookup_key": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "file": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "filter": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "find_file": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "flatten": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "fqdn_rand": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "generate": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "hiera": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "hiera_array": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "hiera_hash": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "hocon_data": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "import": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "info": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "inline_epp": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "inline_template": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "join": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "json_data": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "keys": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "length": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "lest": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "lookup": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "map": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "match": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "md5": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "module_directory": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "new": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "next": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "notice": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "realize": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "reduce": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "regsubst": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "reverse_each": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "scanf": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "sha1": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "sha256": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "shellquote": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "slice": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "split": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "sprintf": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "step": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "strftime": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "tag": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "tagged": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "then": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "tree_each": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "type": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "unique": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "unwrap": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "values": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "versioncmp": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "warning": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "with": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    },
    "yaml_data": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        //not implemented
    }
};

export function GetBuiltinFunction(name: string): BuiltinFunctionCallback
{
    return BuiltInFunctions[name];
}