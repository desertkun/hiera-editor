
import {Dictionary} from "../dictionary";
import { throws } from "assert";
import { TouchBarSlider } from "electron";

export abstract class Resolver
{
    public async abstract resolveClass(className: string): Promise<PuppetASTClass>;
    public async abstract resolveGlobalVariable(name: string): Promise<string>;
}

export interface PuppetASTContainerContext
{
    setProperty(name: string, pp: PuppetASTResolvedProperty): void;
    getProperty(name: string): PuppetASTResolvedProperty;
    getName(): string;
}

export abstract class PuppetHint
{
    public kind: string;
    public message: string;

    constructor(kind: string, message: string)
    {
        this.kind = kind;
        this.message = message;
    }
}

export class PuppetASTObject
{
    protected _resolved: any;
    private _beingResolved: boolean;
    private _hints: PuppetHint[];

    public toString(): string
    {
        return "" + this._resolved;
    }

    public async resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected carryHints(hints: PuppetHint[])
    {
        if (hints == null)
            return;

        for (const hint of hints)
        {
            this.hint(hint);
        }
    }

    protected hint(hint: PuppetHint)
    {
        if (this._hints == null)
        {
            this._hints = [];
        }

        for (const existing of this._hints)
        {
            if (existing.toString() == hint.toString())
                return;
        }

        this._hints.push(hint);
    }

    public get hints()
    {
        return this._hints;
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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
                               context: PuppetASTContainerContext, resolver: Resolver) => Promise<any>;

export class PuppetASTInvoke extends PuppetASTObject
{
    public readonly functor: PuppetASTQualifiedName;
    public readonly args: PuppetASTList;

    private static readonly InvokeFunctions: any =
    {
        "fail": async function(invoke: PuppetASTInvoke, args: Array<any>,
                               context: PuppetASTContainerContext, resolver: Resolver)
        {
            throw new ResolveError(invoke, args[0]);
        },
        "require": async function(invoke: PuppetASTInvoke, args: Array<any>,
                                  context: PuppetASTContainerContext, resolver: Resolver)
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        return await this.value.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTQualifiedName(args);
    }
}

export class PuppetASTHash extends PuppetASTObject
{
    public readonly dict: any;
    public readonly args: Array<PuppetASTKeyedEntry>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();
        
        this.dict = {};
        this.args = <Array<PuppetASTKeyedEntry>>args;
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        for (const arg of this.args)
        {
            await arg.resolve(context, resolver)

            const key = await arg.key.resolve(context, resolver);
            const value = await arg.value.resolve(context, resolver);

            this.dict[key] = value;
        }

        return this.dict;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTHash(args);
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        await this.first.resolve(context, resolver);
        await this.second.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTNotifyOrder(args);
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        return this.value;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTPrimitive(args);
    }
}

export class PuppetASTRegularExpression extends PuppetASTObject
{
    public readonly value: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.value = args[0];
    }

    public toString(): string
    {
        return "" + this.value;
    }

    public async matches(context: PuppetASTContainerContext, resolver: Resolver, object: PuppetASTObject): Promise<boolean>
    {
        const re = new RegExp(await this.resolve(context, resolver));
        const value = await object.resolve(context, resolver);
        return re.test(value);
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        return await this.value.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTRegularExpression(args);
    }
}

export class PuppetASTRegularExpressionCheck extends PuppetASTObject
{
    public readonly variable: PuppetASTObject;
    public readonly regexp: PuppetASTRegularExpression;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.variable = args[0];
        this.regexp = <PuppetASTRegularExpression>(args[1]);
    }

    public toString(): string
    {
        return "" + this.regexp.toString();
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        return await this.regexp.matches(context, resolver, this.variable);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTRegularExpressionCheck(args);
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        for (const entry of this.entries)
        {
            await entry.resolve(context, resolver);
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        for (const entry of this.entries)
        {
            await entry.resolve(context, resolver);
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        const result = "" + await this.obj.resolve(context, resolver)
        this.carryHints(this.obj.hints);
        return result;
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        const resolved = [];

        for (const entry of this.entries)
        {
            resolved.push(await entry.resolve(context, resolver));
            this.carryHints(entry.hints);
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
    private _hasType: boolean;
    private _type: any;

    private _hasValue: boolean;
    private _value: any;

    private _hasError: boolean;
    private _error: any;

    private _hints: Array<PuppetHint>;

    constructor()
    {
        this._hints = [];
        this._hasType = false;
        this._hasValue = false;
        this._hasError = false;
    }

    public set type(value: any)
    {
        this._type = value;
        this._hasType = true;
    }

    public set value(value: any)
    {
        this._value = value;
        this._hasValue = true;
    }

    public set error(value: any)
    {
        this._error = value;
        this._hasError = true;
    }

    public hasHint(hint: PuppetHint): boolean
    {
        for (const existing of this._hints)
        {
            if (existing.toString() == hint.toString())
                return true;
        }   

        return false;
    }

    public addHints(value: Array<PuppetHint>)
    {
        if (value == null)
            return;

        for (const hint of value)
        {
            if (this.hasHint(hint))
                continue;

            this._hints.push(hint);
        }
    }

    public get type(): any
    {
        return this._type;
    }

    public get value(): any
    {
        return this._value;
    }

    public get error(): any
    {
        return this._error;
    }

    public get hints(): Array<any>
    {
        return this._hints;
    }

    public get hasType(): boolean
    {
        return this._hasType;
    }

    public get hasValue(): boolean
    {
        return this._hasValue;
    }

    public get hasError(): boolean
    {
        return this._hasError;
    }

    public get hasHints(): boolean
    {
        return this._hints.length > 0;
    }
}

export class PuppetASTClass extends PuppetASTObject implements PuppetASTContainerContext
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
    
    public getProperty(name: string): PuppetASTResolvedProperty
    {
        return this.getResolvedProperty(name);
    }

    public getName(): string
    {
        return this.name;
    }

    public setResolvedProperty(name: string, pp: PuppetASTResolvedProperty)
    {
        this.resolvedProperties.put(name, pp);
    }
    
    public setProperty(name: string, pp: PuppetASTResolvedProperty)
    {
        this.setResolvedProperty(name, pp);
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        if (this.parent)
        {
            console.log("Resolving parent for class " + this.name);
            const parentName = await this.parent.resolve(context, resolver);
            this._resolvedParent = await resolver.resolveClass(parentName);
        }

        console.log("Resolving class " + this.name);

        for (const paramName in this.params)
        {
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
                const pp = new PuppetASTResolvedProperty();
                if (type != null)
                    pp.type = type;
                pp.error = e;
                pp.addHints(value.hints);
                this.resolvedProperties.put(paramName, pp);
                continue;
            }

            const pp = new PuppetASTResolvedProperty();

            pp.value = result;

            if (type != null)
                pp.type = type;

            pp.addHints(value.hints);

            this.resolvedProperties.put(paramName, pp);
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

export class PuppetASTResource extends PuppetASTObject
{
    private readonly ops: any;
    private readonly title: PuppetASTObject;
    private _resolvedTitle: string;
    private readonly _resolvedProperties: Dictionary<string, PuppetASTResolvedProperty>;

    constructor(args: any)
    {
        super();

        this.ops = args.ops;
        this.title = args.title;
        this._resolvedProperties = new Dictionary();
    }

    public get resolvedProperties(): Dictionary<string, PuppetASTResolvedProperty>
    {
        return this._resolvedProperties;
    }

    public getTitle(): string
    {
        return this._resolvedTitle;
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        await this.title.resolve(context, resolver);
        this._resolvedTitle = this.title.toString();

        if (this.ops instanceof PuppetASTList)
        {
            for (const entry of this.ops.entries)
            {
                if (!(entry instanceof PuppetASTKeyedEntry))
                    continue;

                const keyed = <PuppetASTKeyedEntry>entry;

                const key = await keyed.key.resolve(context, resolver);
                const value = await keyed.value.resolve(context, resolver);

                const pp = new PuppetASTResolvedProperty();
                pp.value = value;

                this._resolvedProperties.put(key, pp);
            }
        }
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTResource(args);
    }
}

export class PuppetASTResourcesEntry extends PuppetASTObject
{
    private readonly bodies: PuppetASTList;
    private readonly type: PuppetASTQualifiedName;
    private readonly entries: Dictionary<string, PuppetASTResource>;
    private _resolvedType: string;

    constructor(args: Array<PuppetASTObject>, name?: string)
    {
        super();

        const values: any = args[0];

        this.bodies = values.bodies;
        this.type = values.type;
        this.entries = new Dictionary();
    }

    public get resolvedType(): string
    {
        return this._resolvedType;
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        this._resolvedType = await this.type.resolve(context, resolver);

        for (const body of this.bodies.entries)
        {
            const resource = new PuppetASTResource(<any>(body));
            await resource.resolve(context, resolver);
            this.entries.put(resource.getTitle(), resource);
        }
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTResourcesEntry(args);
    }
}

export class PuppetASTResolvedDefinedType implements PuppetASTContainerContext
{
    private readonly _resolvedProperties: Dictionary<string, PuppetASTResolvedProperty>;
    private _title: string;
    private _name: string;

    constructor(title: string, name: string)
    {
        this._title = title;
        this._name = name;
        this._resolvedProperties = new Dictionary();
    }

    public setProperty(name: string, pp: PuppetASTResolvedProperty): void
    {
        this._resolvedProperties.put(name, pp);
    }

    public getProperty(name: string): PuppetASTResolvedProperty
    {
        return this._resolvedProperties.get(name);
    }
    
    public get resolvedProperties(): Dictionary<string, PuppetASTResolvedProperty>
    {
        return this._resolvedProperties;
    }

    public getName(): string
    {
        return this._name;
    }
}

export class PuppetASTDefinedType extends PuppetASTObject
{
    public readonly name: string;
    public readonly params: any;
    public readonly body: PuppetASTObject;

    public getName(): string
    {
        return this.name;
    }

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const metaData: any = args[0];

        this.name = metaData["name"].value;
        this.body = metaData["body"];
        this.params = metaData["params"] || {};
    }
    
    public async resolveAsResource(title: string, properties: any, resolver: Resolver): Promise<PuppetASTResolvedDefinedType>
    {
        const r = new PuppetASTResolvedDefinedType(this.name, title);
        for (const name in properties)
        {
            const pp = new PuppetASTResolvedProperty();
            pp.value = properties[name];
            r.resolvedProperties.put(name, pp);
        }
        
        try
        {
            await this.resolve(r, resolver);
        }
        catch (e)
        {
            console.log(e.toString());
        }

        return r;
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        console.log("Resolving defined type " + this.name);

        for (const paramName in this.params)
        {
            const param = this.params[paramName];

            let type = param.type;
            const value = param.value;

            if (type instanceof PuppetASTObject)
            {
                try
                {
                    type = await type.resolve(context, resolver);
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
                result = await value.resolve(context, resolver);
            }
            catch (e)
            {
                console.log("Failed to resolve param " + paramName + " (" + value.constructor.name + "): " + e);
                const pp = new PuppetASTResolvedProperty();
                if (type != null)
                    pp.type = type;
                pp.error = e;
                pp.addHints(value.hints);
                context.setProperty(paramName, pp);
                continue;
            }

            const pp = new PuppetASTResolvedProperty();

            pp.addHints(value.hints);
            pp.value = result;

            if (type != null)
                pp.type = type;

            context.setProperty(paramName, pp);
        }

        if (this.body)
            await this.body.resolve(context, resolver);

        console.log("Defined type has been resolved");
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTDefinedType(args);
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
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
        const pp = new PuppetASTResolvedProperty();

        try
        {
            pp.value = await this.provider.resolve(context, resolver);
        }
        catch (e)
        {
            pp.error = e;
        }

        pp.addHints(this.provider.hints);
        
        context.setProperty(paramName, pp);
        return pp;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTSetInstruction(args);
    }
}

export class PuppetHintVariableNotFound extends PuppetHint
{
    public variable: string;

    constructor(variable: string)
    {
        super("VariableNotFound", "Variable not found: " + variable);
        this.variable = variable;
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

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        const isRoot = this.isRoot();

        if (isRoot || context.getName() == this.className)
        {
            // we're asking the current context, no need to resolve
            const property = context.getProperty(this.name);

            if (property)
            {
                this.carryHints(property.hints);
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
                this.carryHints(property.hints);

                if (property.error)
                {
                    throw property.error;
                }
                
                return property.value;
            }
        }

        this.hint(new PuppetHintVariableNotFound(this.fullName));

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
            "define": PuppetASTDefinedType.Create,
            "=": PuppetASTSetInstruction.Create,
            "var": PuppetASTVariable.Create,
            "qr": PuppetASTType.Create,
            "qn": PuppetASTQualifiedName.Create,
            "str": PuppetASTToString.Create,
            "concat": PuppetASTConcat.Create,
            "resource": PuppetASTResourcesEntry.Create,
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
            "array": PuppetASTArray.Create,
            "regexp": PuppetASTRegularExpression.Create,
            "=~": PuppetASTRegularExpressionCheck.Create,
            "hash": PuppetASTHash.Create
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