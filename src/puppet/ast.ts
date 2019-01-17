
import {Dictionary} from "../dictionary";
import { GetBuiltinFunction } from "./builtin";
import { resolve } from "dns";
import { isString } from "util";

export interface Resolver
{
    resolveClass(className: string, public_: boolean): Promise<PuppetASTClass>;
    resolveFunction(name: string): Promise<PuppetASTFunction>;
    getGlobalVariable(name: string): any;
    hasGlobalVariable(name: string): boolean;
    getNodeName(): String;
}

export interface PuppetASTContainerContext
{
    setProperty(kind: string, name: string, pp: PuppetASTResolvedProperty): void;
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
        if (this._beingResolved)
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

    public async access(args: Array<PuppetASTObject>, context: PuppetASTContainerContext, resolver: Resolver): Promise<PuppetASTObject>
    {
        return await this._access(args, context, resolver);
    }

    protected async _access(args: Array<PuppetASTObject>, context: PuppetASTContainerContext, resolver: Resolver): Promise<PuppetASTObject>
    {
        const resolved = await this.resolve(context, resolver);
        if (resolved == null)
            return new PuppetASTValue(null);

        const key = await args[0].resolve(context, resolver);
        const value = resolved[key];
        return new PuppetASTValue(value);
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

    public get hasHints()
    {
        return this._hints != null && this._hints.length > 0;
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        throw "Not implemented";
    }
}

export class ResolveError extends Error
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

export class PuppetASTReturn extends Error
{
    public value: any;

    constructor(value: any)
    {
        super();

        this.value = value;
    }
}

export class PuppetASTEnvironment extends PuppetASTObject implements PuppetASTContainerContext
{
    public readonly name: string;
    public readonly resolvedLocals: Dictionary<string, PuppetASTResolvedProperty>;
    public readonly nodeDefinitions: Array<PuppetASTNode>;

    constructor (name: string)
    {
        super();
        
        this.name = name;
        this.resolvedLocals = new Dictionary();
        this.nodeDefinitions = [];
    }

    public addNodeDefinition(node: PuppetASTNode)
    {
        this.nodeDefinitions.push(node);
    }

    public setProperty(kind: string, name: string, pp: PuppetASTResolvedProperty): void
    {
        switch (kind)
        {
            case "local":
            {
                this.resolvedLocals.put(name, pp);
                break;
            }
        }
    }

    public getProperty(name: string): PuppetASTResolvedProperty
    {
        return this.resolvedLocals.get(name);
    }

    public getName(): string
    {
        return this.name;
    }

    protected async tryNode(nodeName: string, context: PuppetASTContainerContext, resolver: Resolver): Promise<boolean>
    {
        for (const def of this.nodeDefinitions)
        {
            for (const entry of def.matches.entries)
            {
                if (entry instanceof PuppetASTRegularExpression)
                {
                    const matcher = await entry.matcher(context, resolver);

                    if (matcher.test(nodeName))
                    {
                        await def.body.resolve(context, resolver);
                        return true;
                    }
                }
                else if (entry instanceof PuppetASTPrimitive)
                {
                    const matches = await entry.resolve(context, resolver);
                    if (matches == nodeName)
                    {
                        await def.body.resolve(context, resolver);
                        return true;
                    }
                }
            }
        }

        return false;
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        const nodeName = resolver.getNodeName();
        const split = nodeName.split(".");

        while (true)
        {
            if (await this.tryNode(split.join("."), context, resolver))
            {
                return;
            }

            split.pop();
            
            if (split.length == 0)
                break;
        }

        // try default
        
        for (const def of this.nodeDefinitions)
        {
            for (const entry of def.matches.entries)
            {
                if (entry instanceof PuppetASTDefault)
                {
                    await def.body.resolve(context, resolver);
                    return;
                }
            }
        }

    }
}

export class PuppetASTInvoke extends PuppetASTObject
{
    public readonly functor: PuppetASTQualifiedName;
    public readonly args: PuppetASTList;

    private static readonly InvokeFunctions: any =
    {
        
    };

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const obj: OrderedDictionary = <OrderedDictionary>args[0];
        this.functor = obj.get("functor");
        this.args = obj.get("args");
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        const functorName: string = await this.functor.resolve(context, resolver);
        const builtin = GetBuiltinFunction(functorName);
    
        if (builtin == null)
        {
            console.log("Warning: Unknown function: " + functorName);
            return null;
        }

        const resolvedArgs: any = [];
        for (const arg of this.args.entries)
        {
            resolvedArgs.push(await arg.resolve(context, resolver))
        }

        return await builtin(this, context, resolver, resolvedArgs);
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
        console.log("Entry ignored: " + this.what);
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
    private accessOf: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.what = args[0];
        args.splice(0, 1);
        this.values = args;
    }

    public toString(): string
    {
        return this.accessOf.toString();
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        this.accessOf = await this.what.access(this.values, context, resolver);
        if (this.accessOf == null)
            return null;
        return await this.accessOf.resolve(context, resolver);
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

export class PuppetASTCase extends PuppetASTObject
{
    public readonly variable: PuppetASTObject;
    public readonly cases: PuppetASTList;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this.variable = args[0];
        this.cases = (<PuppetASTList>args[1]);
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        const resolvedValue = await this.variable.resolve(context, resolver);

        let default_: PuppetASTObject = null;

        for (const entry of this.cases.entries)
        {
            const obj: OrderedDictionary = <OrderedDictionary>entry;

            const when: PuppetASTList = obj.get("when");
            const then: PuppetASTObject = obj.get("then");

            let matches = false;

            for (const val of when.entries)
            {
                if (val instanceof PuppetASTDefault)
                {
                    default_ = then;
                    continue;
                }

                const possibleValue = await val.resolve(context, resolver);

                if (possibleValue == resolvedValue)
                {
                    matches = true;
                    break;
                }
            }

            if (matches)
            {
                return await then.resolve(context, resolver);
            }
        }

        if (default_ == null)
        {
            throw new ResolveError(this, "Failed to resolve switch: default value was hit and not provided")
        }

        return await default_.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTCase(args);
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

    protected async _access(args: Array<PuppetASTObject>, context: PuppetASTContainerContext, resolver: Resolver): Promise<PuppetASTObject>
    {
        const key = await args[0].resolve(context, resolver);
        const value = this.dict[key];
        return new PuppetASTValue(value);
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

    public static In(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTCondition((a: any, b: any) => 
        {
            if (b == null)
                return false;

            return a in b;
        }, args);
    }
}

type PuppetASTMathTest = (a: number, b: number) => number;

export class PuppetASTMath extends PuppetASTObject
{
    public readonly test: PuppetASTMathTest;
    public readonly a: PuppetASTObject;
    public readonly b: PuppetASTObject;

    constructor(test: PuppetASTMathTest, args: Array<PuppetASTObject>)
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

    public static Plus(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTMath((a: any, b: any) => {
            return a + b;
        }, args);
    }

    public static Minus(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTMath((a: any, b: any) => {
            return a - b;
        }, args);
    }

    public static Multiply(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTMath((a: any, b: any) => {
            return a * b;
        }, args);
    }

    public static Divide(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTMath((a: any, b: any) => {
            return a / b;
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

        const obj: OrderedDictionary = <OrderedDictionary>args[0];

        this.test = obj.get("test");
        this.then = obj.get("then");
        this.else = obj.get("else");
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

export class PuppetASTNOP extends PuppetASTObject
{
    constructor(args: Array<PuppetASTObject>)
    {
        super();
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        // do nothing
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTNOP(args);
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

    public async matcher(context: PuppetASTContainerContext, resolver: Resolver): Promise<RegExp>
    {
        return new RegExp(await this.resolve(context, resolver));
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
        const result: any[] = [];
        for (const entry of this.entries)
        {
            const value = await entry.resolve(context, resolver);
            result.push(value);
        }
        return result;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTArray(args);
    }
}

export class PuppetASTTypeOf extends PuppetASTObject
{
    public readonly type: PuppetASTObject;
    public readonly args: Array<PuppetASTObject>;

    constructor(type: PuppetASTType, args: Array<PuppetASTObject>)
    {
        super();

        this.type = type;
        this.args = args;
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        return this;
    }
}

export class PuppetASTClassOf extends PuppetASTObject
{
    public readonly className: string;

    constructor(className: string)
    {
        super();

        this.className = className;
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        try
        {
            return await resolver.resolveClass(this.className, false) != null;
        }
        catch (e)
        {
            return false;
        }
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

    protected async _access(args: Array<PuppetASTObject>, context: PuppetASTContainerContext, resolver: Resolver): Promise<PuppetASTObject>
    {
        const type = await this.type.resolve(context, resolver);

        switch (type)
        {
            case "Class":
            {
                const className = await args[0].resolve(context, resolver);
                return new PuppetASTClassOf(className);
            }
            default: 
            {
                return new PuppetASTTypeOf(this, args);
            }
        }
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

export class PuppetASTNode extends PuppetASTObject
{
    public matches: PuppetASTList;
    public body: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const arg = <OrderedDictionary>args[0];

        this.matches = arg.get("matches");
        this.body = arg.get("body");
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        if (context instanceof PuppetASTEnvironment)
        {
            context.addNodeDefinition(this);
        }
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTNode(args);
    }
}


export class PuppetASTBlock extends PuppetASTObject
{
    public entries: Array<PuppetASTObject>;

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
        return new PuppetASTBlock(args);
    }
}

export class PuppetASTFunctionCall implements PuppetASTContainerContext
{
    private readonly name: string;
    private readonly body: PuppetASTList;
    private readonly params: OrderedDictionary;

    public readonly args: Array<PuppetASTObject>;
    public readonly resolvedLocals: Dictionary<string, PuppetASTResolvedProperty>;

    constructor(name: string, body: PuppetASTList, params: OrderedDictionary, args: PuppetASTObject[])
    {        
        this.name = name;
        this.body = body;
        this.params = params || new OrderedDictionary();
        this.args = args;

        this.resolvedLocals = new Dictionary();
    }

    public async apply(caller: PuppetASTObject, resolver: Resolver): Promise<any>
    {
        const passedArgs = this.args.length;
        const haveArgs = this.params.length;

        if (passedArgs > haveArgs)
        {
            throw new ResolveError(caller, "Passed way too many arguments");
        }

        for (let i = 0; i < passedArgs; i++)
        {
            const arg = this.args[i];
            const name = this.params.keys[i];
            const param: OrderedDictionary = this.params.get(name);

            const pp = new PuppetASTResolvedProperty();

            if (param.get("type") != null)
                pp.type = param.get("type");

            pp.value = await arg.resolve(this, resolver);

            this.setProperty("local", name, pp)
        }

        for (let i = passedArgs; i < haveArgs; i++)
        {
            const name = this.params.keys[i];
            const param: OrderedDictionary = this.params.get(name);

            if (!param.has("value"))
                throw new ResolveError(caller, "Param " + name + " is has no default value and was not provided");
                            
            const pp = new PuppetASTResolvedProperty();

            if (param.get("type") != null)
                pp.type = param.get("type");

            const value: PuppetASTObject = param.get("value");

            pp.value = await value.resolve(this, resolver);

            this.setProperty("local", name, pp)
        }

        try
        {
            await this.body.resolve(this, resolver);
        }
        catch (e)
        {
            if (e instanceof PuppetASTReturn)
            {
                return e.value;
            }
            else
            {
                throw e;
            }
        }

        return null;
    }

    public setProperty(kind: string, name: string, pp: PuppetASTResolvedProperty): void
    {
        switch (kind)
        {
            case "local":
            {
                this.resolvedLocals.put(name, pp);

                break;
            }
        }
    }

    public getProperty(name: string): PuppetASTResolvedProperty
    {
        return this.resolvedLocals.get(name);
    }

    public getName(): string
    {
        return this.name;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTFunction(args);
    }
}

export class PuppetASTFunction extends PuppetASTObject
{
    private readonly name: PuppetASTObject;
    private readonly body: PuppetASTList;
    private readonly params: OrderedDictionary;

    public readonly args: Array<PuppetASTObject>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const _args: OrderedDictionary = <OrderedDictionary>args[0];
        this.name = _args.get("name");
        this.body = _args.get("body");
        this.params = _args.get("params");
    }

    public async apply(context: PuppetASTContainerContext, resolver: Resolver, args: PuppetASTObject[]): Promise<any>
    {
        const name = await this.name.resolve(context, resolver);
        const call = new PuppetASTFunctionCall(name, this.body, this.params, args);
        return await call.apply(this, resolver);
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTFunction(args);
    }
}

export class PuppetASTCall extends PuppetASTObject
{
    public readonly args: Array<PuppetASTObject>;
    public readonly functor: PuppetASTObject;
    public readonly functorArgs: PuppetASTList;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const args_: OrderedDictionary = <OrderedDictionary>args[0];

        this.functor = args_.get("functor");
        this.functorArgs = args_.get("args");
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        const functorName = await this.functor.resolve(context, resolver);
        let function_ = null;

        try
        {
            function_ = await resolver.resolveFunction(functorName);
        }
        catch (e)
        {
            this.hint(new PuppetHintFunctionNotFound(functorName));
        }

        if (function_ == null)
        {
            const builtin = GetBuiltinFunction(functorName);

            if (builtin == null)
            {
                this.hint(new PuppetHintFunctionNotFound(functorName));
                return null;
            }

            return await builtin(this, context, resolver, this.functorArgs.entries);
        }
        return await function_.apply(context, resolver, this.functorArgs.entries);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTCall(args);
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
        return this._hints != null && this._hints.length > 0;
    }
}

export class PuppetASTClass extends PuppetASTObject implements PuppetASTContainerContext
{
    public readonly name: string;
    public parentName: string;
    public readonly params: OrderedDictionary;
    public readonly body: PuppetASTObject;
    public readonly parent: PuppetASTPrimitive;

    private _public: boolean;
    private _resolvedParent: PuppetASTClass;
    public readonly resolvedLocals: Dictionary<string, PuppetASTResolvedProperty>;
    public readonly resolvedFields: Dictionary<string, PuppetASTResolvedProperty>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const metaData: OrderedDictionary = <OrderedDictionary>args[0];

        this._public = false;
        this.name = metaData.get("name").value;
        this.body = metaData.get("body");
        this.params = metaData.get("params") || new OrderedDictionary();
        this.parent = metaData.get("parent");
        this._resolvedParent = null;
        this.resolvedLocals = new Dictionary();
        this.resolvedFields = new Dictionary();
    }

    public markPublic()
    {
        this._public = true;
    }

    public isPublic()
    {
        return this._public;
    }

    public get resolvedParent(): PuppetASTClass
    {
        return this._resolvedParent;
    }

    public getResolvedProperty(name: string): PuppetASTResolvedProperty
    {
        if (this.resolvedLocals.has(name))
            return this.resolvedLocals.get(name);

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
        this.resolvedLocals.put(name, pp);
    }
    
    public setProperty(kind: string, name: string, pp: PuppetASTResolvedProperty)
    {
        switch (kind)
        {
            case "local":
            {
                this.setResolvedProperty(name, pp);
                break;
            }
            case "field":
            {
                this.resolvedFields.put(name, pp);
                break;
            }
        }
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        if (this.parent)
        {
            console.log("Resolving parent for class " + this.name);
            this.parentName = await this.parent.resolve(context, resolver);
            this._resolvedParent = await resolver.resolveClass(this.parentName, false);
            if (this._resolvedParent && this._resolvedParent.hasHints)
            {
                this.carryHints(this._resolvedParent.hints);
            }
        }

        console.log("Resolving class " + this.name);

        for (const paramName of this.params.keys)
        {
            const param: OrderedDictionary = this.params.get(paramName);

            let type = param.get("type");

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

            const globalParamName = this.name + "::" + paramName;

            if (resolver.hasGlobalVariable(globalParamName))
            {
                const globalParamValue = resolver.getGlobalVariable(globalParamName);

                const pp = new PuppetASTResolvedProperty();
                pp.value = globalParamValue;
                
                if (type != null)
                    pp.type = type;

                this.resolvedLocals.put(paramName, pp);
                this.resolvedFields.put(paramName, pp);
            }
            else
            {
                const value = param.get("value");

                const pp = new PuppetASTResolvedProperty();

                let result: any;
                let hasValue: boolean = false;

                if (value instanceof PuppetASTObject)
                {
                    try
                    {
                        result = await value.resolve(this, resolver);
                        hasValue = true;
                    }
                    catch (e)
                    {
                        console.log("Failed to resolve param " + paramName + " (" + value.constructor.name + "): " + e);
                        const pp = new PuppetASTResolvedProperty();
                        if (type != null)
                            pp.type = type;
                        pp.error = e;
                        pp.addHints(value.hints);
                        this.resolvedLocals.put(paramName, pp);
                        this.resolvedFields.put(paramName, pp);
                        continue;
                    }
                }

                if (hasValue)
                {
                    pp.addHints(value.hints);
                    pp.value = result;
                }
                
                if (type != null)
                    pp.type = type;

                this.resolvedLocals.put(paramName, pp);
                this.resolvedFields.put(paramName, pp);
            }

            
        }

        if (this.body)
        {
            try
            {
                await this.body.resolve(this, resolver);
            }
            catch (e)
            {
                if (e instanceof ResolveError)
                {
                    this.hint(new PuppetHintBodyCompilationError("Failed to resolve class body: " + e.message));
                    console.log("Failed to resolve class body: " + e.message);
                }
                else
                {
                    throw e;
                }
            }
        }

        console.log("Class " + this.name + " has been resolved");
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTClass(args);
    }
}

export class PuppetASTResource extends PuppetASTObject
{
    private readonly ops: OrderedDictionary;
    private readonly title: PuppetASTObject;
    private _resolvedTitle: string;
    private readonly _resolvedProperties: Dictionary<string, PuppetASTResolvedProperty>;

    constructor(args: OrderedDictionary)
    {
        super();

        this.ops = args.get("ops");
        this.title = args.get("title");
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

        const values: OrderedDictionary = <OrderedDictionary>args[0];

        this.bodies = values.get("bodies");
        this.type = values.get("type");
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
            const resource = new PuppetASTResource(<OrderedDictionary>(body));
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
    private readonly _resolvedFields: Dictionary<string, PuppetASTResolvedProperty>;
    private readonly _resolvedLocals: Dictionary<string, PuppetASTResolvedProperty>;
    private _title: string;
    private _name: string;

    constructor(title: string, name: string)
    {
        this._title = title;
        this._name = name;
        this._resolvedLocals = new Dictionary();
        this._resolvedFields = new Dictionary();
    }

    public setProperty(kind: string, name: string, pp: PuppetASTResolvedProperty): void
    {
        switch (kind)
        {
            case "local":
            {
                this._resolvedLocals.put(name, pp);
                break;
            }
            case "field":
            {
                this._resolvedFields.put(name, pp);
                break;
            }
        }
    }

    public getProperty(name: string): PuppetASTResolvedProperty
    {
        return this._resolvedLocals.get(name);
    }
    
    public get resolvedProperties(): Dictionary<string, PuppetASTResolvedProperty>
    {
        return this._resolvedLocals;
    }

    public getField(name: string): PuppetASTResolvedProperty
    {
        return this._resolvedFields.get(name);
    }
    
    public get resolvedFields(): Dictionary<string, PuppetASTResolvedProperty>
    {
        return this._resolvedFields;
    }

    public getName(): string
    {
        return this._name;
    }
}

export class PuppetASTDefinedType extends PuppetASTObject
{
    public readonly name: string;
    public readonly params: OrderedDictionary;
    public readonly body: PuppetASTObject;

    public getName(): string
    {
        return this.name;
    }

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const metaData: OrderedDictionary = <OrderedDictionary>args[0];

        this.name = metaData.get("name").value;
        this.body = metaData.get("body");
        this.params = metaData.get("params") || new OrderedDictionary();
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

        for (const paramName of this.params.keys)
        {
            const param: OrderedDictionary = this.params.get(paramName);

            let type = param.get("type");
            const value = param.get("value");

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

            const pp = new PuppetASTResolvedProperty();

            let result: any = null;
            let hasValue: boolean = false;

            if (value instanceof PuppetASTObject)
            {
                try
                {
                    result = await value.resolve(context, resolver);
                    hasValue = true;
                }
                catch (e)
                {
                    console.log("Failed to resolve param " + paramName + " (" + value.constructor.name + "): " + e);
                    const pp = new PuppetASTResolvedProperty();
                    if (type != null)
                        pp.type = type;
                    pp.error = e;
                    pp.addHints(value.hints);
                    context.setProperty("local", paramName, pp);
                    context.setProperty("field", paramName, pp);    
                    continue;
                }
            }

            if (hasValue)
            {
                pp.addHints(value.hints);
                pp.value = result;
            }

            if (type != null)
                pp.type = type;

            context.setProperty("local", paramName, pp);
            context.setProperty("field", paramName, pp);
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
        
        context.setProperty("local", paramName, pp);
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

export class PuppetHintFunctionNotFound extends PuppetHint
{
    public function_: string;

    constructor(function_: string)
    {
        super("FunctionNotFound", "Function not found: " + function_);
        this.function_ = function_;
    }
}

export class PuppetHintBodyCompilationError extends PuppetHint
{
    constructor(message: string)
    {
        super("BodyCompilationError", message);
    }
}

export class PuppetASTValue extends PuppetASTObject
{
    private value: any;

    constructor(value: any)
    {
        super();

        this.value = value;
    }

    protected async _resolve(context: PuppetASTContainerContext, resolver: Resolver): Promise<any>
    {
        return this.value;
    }
}

export class PuppetASTVariable extends PuppetASTObject
{
    public readonly fullName: string;
    public readonly name: string;
    public readonly className: string;
    public readonly root: boolean;

    constructor(args: Array<PuppetASTObject> | string)
    {
        super();

        if (isString(args))
        {
            this.fullName = args;
        }
        else
        {
            this.fullName = (<PuppetASTPrimitive>args[0]).value;
        }

        const split = this.fullName.split("::");
        // cases like "$::operatingsystem"
        this.root = split.length > 1 && split[0] == "";
        this.name = split[split.length - 1];
        split.splice(split.length - 1, 1);
        this.className = split.join("::");
    }

    protected async _access(args: Array<PuppetASTObject>, context: PuppetASTContainerContext, resolver: Resolver): Promise<PuppetASTObject>
    {
        const resolved = await this.resolve(context, resolver);
        if (resolved == null)
            return null;
        const key = await args[0].resolve(context, resolver);
        const value = resolved[key];
        return new PuppetASTValue(value);
    }

    public isRoot()
    {
        return this.root || this.className == "";
    }

    public async defined(context: PuppetASTContainerContext, resolver: Resolver): Promise<boolean>
    {
        const isRoot = this.isRoot();

        if (isRoot || context.getName() == this.className)
        {
            // we're asking the current context, no need to resolve
            const property = context.getProperty(this.name);

            if (property && property.hasValue)
            {
                return true;
            }
            else if (isRoot)
            {
                if (resolver.hasGlobalVariable(this.name))
                {
                    return true;
                }
            }
        }
        else
        {
            const class_:PuppetASTClass = await resolver.resolveClass(this.className, false);
            const property = class_.getResolvedProperty(this.name);

            if (property && property.hasValue)
            {
                return true;
            }
        }

        return false;
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
                if (resolver.hasGlobalVariable(this.name))
                {
                    return resolver.getGlobalVariable(this.name);
                }
            }
        }
        else
        {
            const class_:PuppetASTClass = await resolver.resolveClass(this.className, false);
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

export class OrderedDictionary extends PuppetASTObject
{
    private _value: any;
    private _keys: string[];

    constructor()
    {
        super();

        this._value = {};
        this._keys = [];
    }

    public get length(): number
    {
        return this._keys.length;
    }

    public has(key: string): boolean
    {
        return this._value.hasOwnProperty(key);
    }

    public get(key: string): any
    {
        return this._value[key];
    }

    public delete(key: string)
    {
        const i = this._keys.indexOf(key);
        if (i < 0)
            return;
        this._keys.splice(i, 1);
        delete this._value[key];
    }

    public put(key: string, value: any)
    {
        if (this._keys.indexOf(key) < 0)
        {
            this._keys.push(key);
        }

        this._value[key] = value;
    }

    public get keys(): string[]
    {
        return this._keys;
    }
    
    *[Symbol.iterator]()
    {
        for (const key of this._keys)
        {
            yield this._value[key];
        }
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
            "resource-override": PuppetASTIgnored.Create("resource-override"),
            "resource-defaults": PuppetASTIgnored.Create("resource-defaults"),
            "->": PuppetASTApplyOrder.Create,
            "~>": PuppetASTNotifyOrder.Create,
            "access": PuppetASTAccess.Create,
            "=>": PuppetASTKeyedEntry.Create,
            "default": PuppetASTDefault.Create,
            "?": PuppetASTSwitch.Create,
            "case": PuppetASTCase.Create,
            "!": PuppetASTNot.Create,
            "<": PuppetASTCondition.Less,
            ">": PuppetASTCondition.More,
            "<=": PuppetASTCondition.LessOrEqual,
            ">=": PuppetASTCondition.MoreOrEqual,
            "==": PuppetASTCondition.Equal,
            "!=": PuppetASTCondition.NotEqual,
            "in": PuppetASTCondition.In,
            "+": PuppetASTMath.Plus,
            "-": PuppetASTMath.Minus,
            "*": PuppetASTMath.Multiply,
            "/": PuppetASTMath.Divide,
            "and": PuppetASTAndCondition.Create,
            "or": PuppetASTOrCondition.Create,
            "paren": PuppetASTParenthesis.Create,
            "if": PuppetASTIf.Create,
            "function": PuppetASTFunction.Create,
            "call": PuppetASTCall.Create,
            "exported-query": PuppetASTIgnored.Create("exported-query"),
            "collect": PuppetASTIgnored.Create("collect"),
            "invoke": PuppetASTInvoke.Create,
            "array": PuppetASTArray.Create,
            "regexp": PuppetASTRegularExpression.Create,
            "=~": PuppetASTRegularExpressionCheck.Create,
            "hash": PuppetASTHash.Create,
            "nop": PuppetASTNOP.Create,
            "node": PuppetASTNode.Create
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

                const result = new OrderedDictionary();
                for (let i = 0; i < isHash.length; i += 2)
                {
                    result.put(isHash[i], this.parse(isHash[i + 1]));
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