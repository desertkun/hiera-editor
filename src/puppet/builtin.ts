
import { PuppetASTObject, PuppetASTContainerContext, Resolver, 
    ResolveError, PuppetASTReturn, PuppetASTAccess, PuppetASTClass, PuppetASTVariable} from "./ast";
import { isArray } from "util";
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

        const hierarchy = resolver.hasGlobalVariable(key);

        if (hierarchy == GlobalVariableResolverResults.MISSING)
        {
            return;
        }

        resolver.registerHieraSource("hiera_include", key, hierarchy);

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
    },
    "hiera_resources": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        // todo
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