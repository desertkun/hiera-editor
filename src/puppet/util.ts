
import {PuppetASTDefinedType, PuppetASTResolvedDefinedType} from "./ast";

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

    constructor (title: string, message: string)
    {
        super(message);
        this.title = title;
    }
}

export class NoSuchEnvironmentError extends PuppetError {}
export class CompilationError extends PuppetError {}

export interface GlobalVariableResolver
{
    get (key: string): string;
    has (key: string): boolean;
}

export class ResolvedResource
{
    public definedType: PuppetASTDefinedType;
    public resource: PuppetASTResolvedDefinedType;
}
