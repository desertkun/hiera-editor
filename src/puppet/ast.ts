
import {Dictionary} from "../dictionary";

type ResolverHint = (obj: any) => void;

export abstract class Resolver
{
    public hint: ResolverHint;
    public async abstract resolveClass(className: string): Promise<PuppetASTClass>;
    public async abstract resolveGlobalVariable(name: string): Promise<string>;
}

export class PuppetASTObject
{
    protected _resolved: any;
    private _beingResolved: boolean;

    public toString(): string
    {
        return "" + this._resolved;
    }

    public async resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        if (this._resolved || this._beingResolved)
            return this._resolved;

        this._beingResolved = true;

        try
        {
            this._resolved = await this._resolve(context, resolver);
        }
        finally
        {
            this._beingResolved = false;
        }

        return this._resolved;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        throw "Not implemented";
    }
}

class ResolveError extends Error
{
    public readonly obj: PuppetASTObject;

    constructor (obj: PuppetASTObject, message: string)
    {
        super(message);

        this.obj = obj;
    }
}

type PuppetASTInvokeFunctor = (invoke: PuppetASTInvoke, args: Array<any>,
                               context: PuppetASTClass, resolver: Resolver) => Promise<any>;

export class PuppetASTInvoke extends PuppetASTObject
{
    public readonly functor: PuppetASTQualifiedName;
    public readonly args: PuppetASTList;

    private static readonly InvokeFunctions: any =
    {
        "fail": async function(invoke: PuppetASTInvoke, args: Array<any>,
                               context: PuppetASTClass, resolver: Resolver)
        {
            throw new ResolveError(invoke, args[0]);
        },
        "require": async function(invoke: PuppetASTInvoke, args: Array<any>,
                                  context: PuppetASTClass, resolver: Resolver)
        {
            await resolver.resolveClass(args[0]);
        }
    };

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const obj: any = args[0];
        this.functor = obj["functor"];
        this.args = obj["args"];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const functorName: string = await this.functor.resolve(context, resolver);

        if (!PuppetASTInvoke.InvokeFunctions.hasOwnProperty(functorName))
        {
            throw new ResolveError(this, "Unknown function: " + functorName);
        }

        const f: PuppetASTInvokeFunctor = PuppetASTInvoke.InvokeFunctions[functorName];

        const resolvedArgs = [];
        for (const arg of this.args.entries)
        {
            resolvedArgs.push(await arg.resolve(context, resolver))
        }

        return await f(this, resolvedArgs, context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>)
    {
        return new PuppetASTInvoke(args);
    }
}

export class PuppetASTUnknown extends PuppetASTObject
{
    public readonly kind: string;
    public readonly args: Array<PuppetASTObject>;

    constructor(kind: string, args: Array<PuppetASTObject>)
    {
        super();

        this.kind = kind;
        this.args = args;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        throw new ResolveError(this, "Unknown object of kind " + this.kind);
    }

    public toString(): string
    {
        return this.kind;
    }
}

export class PuppetASTIgnored extends PuppetASTObject
{
    public readonly what: string;

    constructor(what: string, args: Array<PuppetASTObject>)
    {
        super();

        this.what = what;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        throw new ResolveError(this, "Entry ignored: " + this.what);
    }

    public static Create(what: string)
    {
        return function (args: Array<PuppetASTObject>): PuppetASTObject
        {
            return new PuppetASTIgnored(what, args);
        }
    }
}

export class PuppetASTAccess extends PuppetASTObject
{
    public readonly what: PuppetASTObject;
    public readonly values: Array<PuppetASTObject>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.what = args[0];
        args.splice(0, 1);
        this.values = args;
    }

    public toString(): string
    {
        return "Access[" + this.what.toString() + ":" + this.values.join(",") + "]";
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return this;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTAccess(args);
    }
}

export class PuppetASTSwitch extends PuppetASTObject
{
    public readonly variable: PuppetASTObject;
    public readonly over: PuppetASTList;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.variable = args[0];
        this.over = (<PuppetASTList>args[1]);
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const resolvedValue = await this.variable.resolve(context, resolver);

        let default_ = null;

        for (const entry of this.over.entries)
        {
            if (!(entry instanceof PuppetASTKeyedEntry))
                continue;

            const keyed = <PuppetASTKeyedEntry>entry;
            if (keyed.key instanceof PuppetASTDefault)
            {
                default_ = await keyed.value.resolve(context, resolver);
            }
            else
            {
                const key = await keyed.key.resolve(context, resolver);

                if (key == resolvedValue)
                {
                    return await keyed.value.resolve(context, resolver);
                }
            }
        }

        if (default_ == null)
        {
            throw new ResolveError(this, "Failed to resolve switch: default value was hit and not provided")
        }

        return default_;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTSwitch(args);
    }
}

export class PuppetASTParenthesis extends PuppetASTObject
{
    public readonly condition: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.condition = args[0];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return await this.condition.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTParenthesis(args);
    }
}

export class PuppetASTQualifiedName extends PuppetASTObject
{
    public readonly value: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.value = args[0];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return await this.value.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTQualifiedName(args);
    }
}

type PuppetASTConditionTest = (a: any, b: any) => boolean;

export class PuppetASTCondition extends PuppetASTObject
{
    public readonly test: PuppetASTConditionTest;
    public readonly a: PuppetASTObject;
    public readonly b: PuppetASTObject;

    constructor(test: PuppetASTConditionTest, args: Array<PuppetASTObject>)
    {
        super();

        this.test = test;
        this.a = args[0];
        this.b = args[1];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const resolvedA = await this.a.resolve(context, resolver);
        const resolvedB = await this.b.resolve(context, resolver);
        return this.test(resolvedA, resolvedB);
    }

    public static Less(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTCondition((a: any, b: any) => {
            return a < b;
        }, args);
    }

    public static More(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTCondition((a: any, b: any) => {
            return a > b;
        }, args);
    }

    public static MoreOrEqual(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTCondition((a: any, b: any) => {
            return a >= b;
        }, args);
    }

    public static LessOrEqual(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTCondition((a: any, b: any) => {
            return a <= b;
        }, args);
    }

    public static Equal(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTCondition((a: any, b: any) => {
            return a == b;
        }, args);
    }

    public static NotEqual(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTCondition((a: any, b: any) => {
            return a != b;
        }, args);
    }
}

export class PuppetASTAndCondition extends PuppetASTObject
{
    public readonly a: PuppetASTObject;
    public readonly b: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.a = args[0];
        this.b = args[1];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        if (!await this.a.resolve(context, resolver))
            return false;
        if (!await this.b.resolve(context, resolver))
            return false;
        return true;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTAndCondition(args);
    }
}

export class PuppetASTOrCondition extends PuppetASTObject
{
    public readonly a: PuppetASTObject;
    public readonly b: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.a = args[0];
        this.b = args[1];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        if (await this.a.resolve(context, resolver))
            return true;
        if (await this.b.resolve(context, resolver))
            return true;
        return false;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTOrCondition(args);
    }
}

export class PuppetASTNot extends PuppetASTObject
{
    public readonly value: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.value = args[0];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const v = await this.value.resolve(context, resolver);
        return !v;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTNot(args);
    }
}

export class PuppetASTIf extends PuppetASTObject
{
    public readonly test: PuppetASTObject;
    public readonly then: PuppetASTObject;
    public readonly else: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const obj: any = args[0];

        this.test = obj["test"];
        this.then = obj["then"];
        this.else = obj["else"];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const v = await this.test.resolve(context, resolver);

        if (v)
        {
            return await this.then.resolve(context, resolver);
        }

        if (this.else)
            return await this.else.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTIf(args);
    }
}

export class PuppetASTDefault extends PuppetASTObject
{
    constructor(args: Array<PuppetASTObject>)
    {
        super();
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return "default";
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTDefault(args);
    }
}

export class PuppetASTKeyedEntry extends PuppetASTObject
{
    public readonly key: PuppetASTObject;
    public readonly value: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.key = args[0];
        this.value = args[1];
    }

    public toString(): string
    {
        return this.key.toString() + "=>" + this.value.toString();
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return this;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTKeyedEntry(args);
    }
}

export class PuppetASTApplyOrder extends PuppetASTObject
{
    public readonly first: PuppetASTObject;
    public readonly second: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.first = args[0];
        this.second = args[1];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        await this.first.resolve(context, resolver);
        await this.second.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTApplyOrder(args);
    }
}

export class PuppetASTNotifyOrder extends PuppetASTObject
{
    public readonly first: PuppetASTObject;
    public readonly second: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.first = args[0];
        this.second = args[1];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        await this.first.resolve(context, resolver);
        await this.second.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTNotifyOrder(args);
    }
}

export class PuppetASTResource extends PuppetASTObject
{
    public readonly properties: any;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.properties = args[0];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        //
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTResource(args);
    }
}

export class PuppetASTPrimitive extends PuppetASTObject
{
    public readonly value: any;

    constructor(value: any)
    {
        super();

        this.value = value;
    }

    public toString(): string
    {
        return "" + this.value;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return this.value;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTPrimitive(args);
    }
}

export class PuppetASTList extends PuppetASTObject
{
    public readonly entries: Array<PuppetASTObject>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.entries = args;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        for (const entry of this.entries)
        {
            try
            {
                await entry.resolve(context, resolver);
            }
            catch (e)
            {
                if (e instanceof ResolveError)
                {
                    console.log("Failed to resolve body entry " + e.obj.toString() + ": " + e.message);
                }
                else
                {
                    console.log(e);
                }
            }
        }
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTList(args);
    }
}

export class PuppetASTArray extends PuppetASTObject
{
    public readonly entries: Array<PuppetASTObject>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.entries = args;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        for (const entry of this.entries)
        {
            try
            {
                await entry.resolve(context, resolver);
            }
            catch (e)
            {
                if (e instanceof ResolveError)
                {
                    console.log("Failed to resolve array entry " + e.obj.toString() + ": " + e.message);
                }
                else
                {
                    console.log(e);
                }

                throw e
            }
        }
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTArray(args);
    }
}

export class PuppetASTType extends PuppetASTObject
{
    public readonly type: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.type = args[0];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return await this.type.resolve(context, resolver)
    }

    public toString(): string
    {
        return "Type[" + this.type.toString() + "]";
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTType(args);
    }
}

export class PuppetASTToString extends PuppetASTObject
{
    public readonly obj: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.obj = args[0];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return "" + await this.obj.resolve(context, resolver)
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTToString(args);
    }
}

export class PuppetASTConcat extends PuppetASTObject
{
    public readonly entries: Array<PuppetASTObject>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.entries = args;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const resolved = [];

        for (const entry of this.entries)
        {
            resolved.push(await entry.resolve(context, resolver));
        }

        return resolved.join("");
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTConcat(args);
    }
}

export class PuppetASTBlock extends PuppetASTObject
{
    constructor(args: Array<PuppetASTObject>)
    {
        super();
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTBlock(args);
    }
}

export class PuppetASTResolvedProperty
{
    public readonly type: any;
    public readonly value: any;
    public readonly error: any;
    public readonly hints: Array<any>;

    constructor (type: any, value: any, error?: any, hints?: Array<any>)
    {
        this.type = type;
        this.value = value;
        this.error = error;
        this.hints = hints;
    }
}

export class PuppetASTClass extends PuppetASTObject
{
    public readonly name: string;
    public readonly params: any;
    public readonly body: PuppetASTObject;
    public readonly parent: PuppetASTPrimitive;

    private _resolvedParent: PuppetASTClass;
    public readonly resolvedProperties: Dictionary<string, PuppetASTResolvedProperty>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const metaData: any = args[0];

        this.name = metaData["name"].value;
        this.body = metaData["body"];
        this.params = metaData["params"] || {};
        this.parent = metaData["parent"];
        this._resolvedParent = null;
        this.resolvedProperties = new Dictionary();
    }

    public get resolvedParent(): PuppetASTClass
    {
        return this._resolvedParent;
    }

    public getResolvedProperty(name: string): PuppetASTResolvedProperty
    {
        if (this.resolvedProperties.has(name))
            return this.resolvedProperties.get(name);

        if (this._resolvedParent)
            return this._resolvedParent.getResolvedProperty(name);

        return null;
    }

    public setResolvedProperty(name: string, pp: PuppetASTResolvedProperty)
    {
        this.resolvedProperties.put(name, pp);
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        if (this.parent)
        {
            console.log("Resolving parent for class " + this.name);
            const parentName = await this.parent.resolve(context, resolver);
            this._resolvedParent = await resolver.resolveClass(parentName);
        }

        console.log("Resolving class " + this.name);

        const hints: Array<any> = [];

        resolver.hint = function (obj: any)
        {
            hints.push(obj);
        };

        for (const paramName in this.params)
        {
            hints.length = 0;

            const param = this.params[paramName];

            let type = param.type;
            const value = param.value;

            if (type instanceof PuppetASTObject)
            {
                try
                {
                    type = await type.resolve(this, resolver);
                }
                catch (e)
                {
                    console.log("Failed to resolve type for param " + paramName + " (" + type.constructor.name + "): " + e);
                    type = null;
                }
            }

            if (!(value instanceof PuppetASTObject))
            {
                continue;
            }

            let result: any;

            try
            {
                result = await value.resolve(this, resolver);
            }
            catch (e)
            {
                console.log("Failed to resolve param " + paramName + " (" + value.constructor.name + "): " + e);
                this.resolvedProperties.put(paramName, new PuppetASTResolvedProperty(type, null, e, hints.slice(0)));
                continue;
            }

            this.resolvedProperties.put(paramName, new PuppetASTResolvedProperty(type, result));
        }

        if (this.body)
            await this.body.resolve(this, resolver);

        console.log("Class " + this.name + " has been resolved");
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTClass(args);
    }
}

export class PuppetASTSetInstruction extends PuppetASTObject
{
    public readonly receiver: PuppetASTObject;
    public readonly provider: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.receiver = args[0];
        this.provider = args[1];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        if (!(this.receiver instanceof PuppetASTVariable))
        {
            throw new ResolveError(this.receiver, "Cannot assign to a non-variable");
        }

        if (this.receiver.className != "")
        {
            throw new ResolveError(this.receiver, "Cannot assign to external variables");
        }

        const paramName = this.receiver.name;
        let pp;
        try
        {
            const result = await this.provider.resolve(context, resolver);
            pp = new PuppetASTResolvedProperty(null, result);
        }
        catch (e)
        {
            pp = new PuppetASTResolvedProperty(null, null, e);
        }
        
        context.setResolvedProperty(paramName, pp);
        return pp;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTSetInstruction(args);
    }
}

export class PuppetASTVariable extends PuppetASTObject
{
    public readonly fullName: string;
    public readonly name: string;
    public readonly className: string;
    public readonly root: boolean;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.fullName = (<PuppetASTPrimitive>args[0]).value;

        const split = this.fullName.split("::");
        // cases like "$::operatingsystem"
        this.root = split.length > 1 && split[0] == "";
        this.name = split[split.length - 1];
        split.splice(split.length - 1, 1);
        this.className = split.join("::");
    }

    public isRoot()
    {
        return this.root || this.className == "";
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const isRoot = this.isRoot();

        if (isRoot || context.name == this.className)
        {
            // we're asking the current context, no need to resolve
            const property = context.getResolvedProperty(this.name);

            if (property)
            {
                return property.value;
            }
            else if (isRoot)
            {
                // if we've been asking for a variable without classpath mentioned,
                // try to find a global variable
                const global = await resolver.resolveGlobalVariable(this.name);
                if (global)
                {
                    return global;
                }
            }
        }
        else
        {
            const class_:PuppetASTClass = await resolver.resolveClass(this.className);
            const property = class_.getResolvedProperty(this.name);

            if (property)
            {
                if (property.error)
                {
                    throw property.error;
                }
                
                return property.value;
            }
        }

        if (resolver.hint) resolver.hint("Variable not found: " + this.fullName);
        console.log("Variable not found: " + this.fullName);
        return "";
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTVariable(args);
    }
}


export class PuppetASTParser
{
    private readonly calls: any;

    constructor()
    {
        this.calls = {
            "block": PuppetASTBlock.Create,
            "class": PuppetASTClass.Create,
            "=": PuppetASTSetInstruction.Create,
            "var": PuppetASTVariable.Create,
            "qr": PuppetASTType.Create,
            "qn": PuppetASTQualifiedName.Create,
            "str": PuppetASTToString.Create,
            "concat": PuppetASTConcat.Create,
            "resource": PuppetASTResource.Create,
            "->": PuppetASTApplyOrder.Create,
            "~>": PuppetASTNotifyOrder.Create,
            "access": PuppetASTAccess.Create,
            "=>": PuppetASTKeyedEntry.Create,
            "default": PuppetASTDefault.Create,
            "?": PuppetASTSwitch.Create,
            "!": PuppetASTNot.Create,
            "<": PuppetASTCondition.Less,
            ">": PuppetASTCondition.More,
            "<=": PuppetASTCondition.LessOrEqual,
            ">=": PuppetASTCondition.MoreOrEqual,
            "==": PuppetASTCondition.Equal,
            "!=": PuppetASTCondition.NotEqual,
            "and": PuppetASTAndCondition.Create,
            "or": PuppetASTOrCondition.Create,
            "paren": PuppetASTParenthesis.Create,
            "if": PuppetASTIf.Create,
            "call": PuppetASTIgnored.Create("call"),
            "exported-query": PuppetASTIgnored.Create("exported-query"),
            "collect": PuppetASTIgnored.Create("collect"),
            "invoke": PuppetASTInvoke.Create,
            "array": PuppetASTArray.Create
        };
    }

    public parse(obj: any): PuppetASTObject
    {
        if (obj instanceof Object)
        {
            if (obj.hasOwnProperty("^"))
            {
                const isCall = obj["^"];
                const kind = isCall[0];

                if (kind in this.calls)
                {
                    isCall.splice(0, 1);
                    const args = [];
                    for (const arg of isCall)
                    {
                        args.push(this.parse(arg));
                    }
                    return this.calls[kind](args);
                }
                else
                {
                    isCall.splice(0, 1);
                    const args = [];
                    for (const arg of isCall)
                    {
                        args.push(this.parse(arg));
                    }
                    console.log("Warning: unsupported kind of call: " + kind);
                    return new PuppetASTUnknown(kind, args);
                }
            }
            else if (obj.hasOwnProperty("#"))
            {
                const isHash = obj["#"];

                const result: any = {};
                for (let i = 0; i < isHash.length; i += 2)
                {
                    result[isHash[i]] = this.parse(isHash[i + 1]);
                }

                return result;
            }
            else if (Array.isArray(obj))
            {
                const args = [];
                for (const arg of obj)
                {
                    args.push(this.parse(arg));
                }
                return new PuppetASTList(args);
            }
        }

        return new PuppetASTPrimitive(obj);
    }

    static Parse(obj: any)
    {
        const parser = new PuppetASTParser();
        return parser.parse(obj);
    }
}