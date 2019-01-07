
import {PuppetASTObject, PuppetASTContainerContext, Resolver, ResolveError, PuppetASTReturn} from "./ast";

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
    "require": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        await resolver.resolveClass(args[0]);
    },
    "contain": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        await resolver.resolveClass(args[0]);
    },
    "include": async function(caller: PuppetASTObject, context: PuppetASTContainerContext, resolver: Resolver, args: any[])
    {
        const className = args[0];
        await resolver.resolveClass(className);
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