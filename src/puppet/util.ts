
import { Dictionary } from "../dictionary";

export class CompiledPromisesCallback
{
    public callback: any;
    public done: number;

    constructor()
    {
        this.done = 0;
    }
}

export class PuppetError extends Error {}

export class WorkspaceError extends PuppetError 
{
    public title: string;
    public message: string;

    constructor (title: string, message: string)
    {
        super(message);
        this.message = message;
        this.title = title;
    }
}

export class NoSuchEnvironmentError extends PuppetError {}
export class CompilationError extends PuppetError {}

export class GlobalVariableResolverResults
{
    static MISSING: number = -2;
    static EXISTS: number = -1;
    // 0 and above are hiera hierarchies
}

export interface GlobalVariableResolver
{
    get (key: string): string;
    /*
    This method should return:
       GlobalVariableResolverResults.MISSING when global cannot be found
       GlobalVariableResolverResults.EXISTS when it exists but hierarchy is unknown
       0 and above then it exists with hierarchy as value
    */
    has (key: string): number;
}
