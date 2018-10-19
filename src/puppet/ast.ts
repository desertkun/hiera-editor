
import {Dictionary} from "../dictionary";

export abstract class Resolver
{
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
    private readonly _obj: PuppetASTObject;

    constructor (obj: PuppetASTObject, message: string)
    {
        super(message);

        this._obj = obj;
    }

    public get obj(): PuppetASTObject
    {
        return this._obj;
    }
}

export class PuppetASTUnknown extends PuppetASTObject
{
    private readonly _kind: string;
    private readonly _args: Array<PuppetASTObject>;

    constructor(kind: string, args: Array<PuppetASTObject>)
    {
        super();

        this._kind = kind;
        this._args = args;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        throw new ResolveError(this, "Unknown object of kind " + this._kind);
    }

    public toString(): string
    {
        return this._kind;
    }

    public get kind(): string
    {
        return this._kind;
    }

    public get args(): Array<PuppetASTObject>
    {
        return this._args;
    }
}

export class PuppetASTAccess extends PuppetASTObject
{
    private readonly _what: PuppetASTObject;
    private readonly _values: Array<PuppetASTObject>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._what = args[0];
        args.splice(0, 1);
        this._values = args;
    }

    public get what(): PuppetASTObject
    {
        return this._what;
    }

    public get values(): Array<PuppetASTObject>
    {
        return this._values;
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
    private readonly _variable: PuppetASTObject;
    private readonly _over: PuppetASTList;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._variable = args[0];
        this._over = (<PuppetASTList>args[1]);
    }

    public get variable(): PuppetASTObject
    {
        return this._variable;
    }

    public get over(): PuppetASTList
    {
        return this._over;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const resolvedValue = await this._variable.resolve(context, resolver);

        let default_ = null;

        for (const entry of this._over.entries)
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
    private readonly _condition: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._condition = args[0];
    }

    public get value(): any
    {
        return this._condition;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return await this._condition.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTParenthesis(args);
    }
}

export class PuppetASTQualifiedName extends PuppetASTObject
{
    private readonly _value: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._value = args[0];
    }

    public get value(): any
    {
        return this._value;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return await this._value.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTQualifiedName(args);
    }
}

type PuppetASTConditionTest = (a: any, b: any) => boolean;

export class PuppetASTCondition extends PuppetASTObject
{
    private readonly _test: PuppetASTConditionTest;
    private readonly _a: PuppetASTObject;
    private readonly _b: PuppetASTObject;

    constructor(test: PuppetASTConditionTest, args: Array<PuppetASTObject>)
    {
        super();

        this._test = test;
        this._a = args[0];
        this._b = args[1];
    }

    public get a(): any
    {
        return this._a;
    }

    public get b(): any
    {
        return this._b;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const resolvedA = await this._a.resolve(context, resolver);
        const resolvedB = await this._b.resolve(context, resolver);
        return this._test(resolvedA, resolvedB);
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
    private readonly _a: PuppetASTObject;
    private readonly _b: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._a = args[0];
        this._b = args[1];
    }

    public get a(): any
    {
        return this._a;
    }

    public get b(): any
    {
        return this._b;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        if (!await this._a.resolve(context, resolver))
            return false;
        if (!await this._b.resolve(context, resolver))
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
    private readonly _a: PuppetASTObject;
    private readonly _b: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._a = args[0];
        this._b = args[1];
    }

    public get a(): any
    {
        return this._a;
    }

    public get b(): any
    {
        return this._b;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        if (await this._a.resolve(context, resolver))
            return true;
        if (await this._b.resolve(context, resolver))
            return true;
        return false;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTOrCondition(args);
    }
}

export class PuppetASTIf extends PuppetASTObject
{
    private readonly _test: PuppetASTObject;
    private readonly _then: PuppetASTObject;
    private readonly _else: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const obj: any = args[0];

        this._test = obj["test"];
        this._then = obj["then"];
        this._else = obj["else"];
    }

    public get test(): any
    {
        return this._test;
    }

    public get then(): any
    {
        return this._then;
    }

    public get else(): any
    {
        return this._else;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const v = await this._test.resolve(context, resolver);

        if (v)
        {
            return await this._then.resolve(context, resolver);
        }

        if (this._else)
            return await this._else.resolve(context, resolver);
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
    private readonly _key: PuppetASTObject;
    private readonly _value: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._key = args[0];
        this._value = args[1];
    }

    public get key(): PuppetASTObject
    {
        return this._key;
    }

    public get value(): PuppetASTObject
    {
        return this._value;
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
    private readonly _first: PuppetASTObject;
    private readonly _second: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._first = args[0];
        this._second = args[1];
    }

    public get first(): PuppetASTObject
    {
        return this._first;
    }

    public get second(): PuppetASTObject
    {
        return this._second;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        await this._first.resolve(context, resolver);
        await this._second.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTApplyOrder(args);
    }
}

export class PuppetASTNotifyOrder extends PuppetASTObject
{
    private readonly _first: PuppetASTObject;
    private readonly _second: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._first = args[0];
        this._second = args[1];
    }

    public get first(): PuppetASTObject
    {
        return this._first;
    }

    public get second(): PuppetASTObject
    {
        return this._second;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        await this._first.resolve(context, resolver);
        await this._second.resolve(context, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTNotifyOrder(args);
    }
}

export class PuppetASTResource extends PuppetASTObject
{
    private readonly _properties: any;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._properties = args[0];
    }

    public get properties(): any
    {
        return this._properties;
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
    private readonly _value: any;

    constructor(value: any)
    {
        super();

        this._value = value;
    }

    public get value(): any
    {
        return this._value;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return this._value;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTPrimitive(args);
    }
}

export class PuppetASTList extends PuppetASTObject
{
    private readonly _entries: Array<PuppetASTObject>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._entries = args;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        for (const entry of this._entries)
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

                throw e
            }
        }
    }

    public get entries(): Array<PuppetASTObject>
    {
        return this._entries;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTList(args);
    }
}

export class PuppetASTType extends PuppetASTObject
{
    private readonly _type: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._type = args[0];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return await this._type.resolve(context, resolver)
    }

    public get type(): PuppetASTObject
    {
        return this._type;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTType(args);
    }
}

export class PuppetASTToString extends PuppetASTObject
{
    private readonly _obj: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._obj = args[0];
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        return "" + await this._obj.resolve(context, resolver)
    }

    public get obj(): PuppetASTObject
    {
        return this._obj;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTToString(args);
    }
}

export class PuppetASTConcat extends PuppetASTObject
{
    private readonly _entries: Array<PuppetASTObject>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._entries = args;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        const resolved = [];

        for (const entry of this._entries)
        {
            resolved.push(await entry.resolve(context, resolver));
        }

        return resolved.join("");
    }

    public get entries(): Array<PuppetASTObject>
    {
        return this._entries;
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
    private readonly _type: any;
    private readonly _value: any;

    constructor (type: any, value: any)
    {
        this._type = type;
        this._value = value;
    }

    public get type(): any
    {
        return this._type;
    }

    public get value(): any
    {
        return this._value;
    }
}

export class PuppetASTClass extends PuppetASTObject
{
    private readonly _name: string;
    private readonly _params: any;
    private readonly _body: PuppetASTObject;
    private readonly _parent: PuppetASTPrimitive;

    private _resolvedParent: PuppetASTClass;
    private readonly _resolvedProperties: Dictionary<string, PuppetASTResolvedProperty>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const metaData: any = args[0];

        this._name = metaData["name"].value;
        this._body = metaData["body"];
        this._params = metaData["params"] || {};
        this._parent = metaData["parent"];
        this._resolvedParent = null;
        this._resolvedProperties = new Dictionary();
    }

    public get name(): any
    {
        return this._name;
    }

    public get body(): PuppetASTObject
    {
        return this._body;
    }

    public get resolvedProperties(): Dictionary<string, PuppetASTResolvedProperty>
    {
        return this._resolvedProperties;
    }

    public get resolvedParent(): PuppetASTClass
    {
        return this._resolvedParent;
    }

    public getResolvedProperty(name: string): PuppetASTResolvedProperty
    {
        if (this._resolvedProperties.has(name))
            return this._resolvedProperties.get(name);

        if (this._resolvedParent)
            return this._resolvedParent.getResolvedProperty(name);

        return null;
    }

    public setResolvedProperty(name: string, pp: PuppetASTResolvedProperty)
    {
        this._resolvedProperties.put(name, pp);
    }

    public get params(): any
    {
        return this._params;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        if (this._parent)
        {
            console.log("Resolving parent for class " + this._name);
            const parentName = await this._parent.resolve(context, resolver);
            this._resolvedParent = await resolver.resolveClass(parentName);
        }

        console.log("Resolving class " + this._name);

        for (const paramName in this._params)
        {
            const param = this._params[paramName];
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
                continue;
            }

            this._resolvedProperties.put(paramName, new PuppetASTResolvedProperty(type, result));
        }

        if (this._body)
            await this._body.resolve(this, resolver);
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTClass(args);
    }
}

export class PuppetASTSetInstruction extends PuppetASTObject
{
    private readonly _receiver: PuppetASTObject;
    private readonly _provider: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._receiver = args[0];
        this._provider = args[1];
    }

    public get receiver(): PuppetASTObject
    {
        return this._receiver;
    }

    public get provider(): PuppetASTObject
    {
        return this._provider;
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
        const result = await this.provider.resolve(context, resolver);
        const pp = new PuppetASTResolvedProperty(null, result);
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
    private readonly _fullName: string;
    private readonly _name: string;
    private readonly _className: string;
    private readonly _root: boolean;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._fullName = (<PuppetASTPrimitive>args[0]).value;

        const split = this._fullName.split("::");
        // cases like "$::operatingsystem"
        this._root = split.length > 1 && split[0] == "";
        this._name = split[split.length - 1];
        split.splice(split.length - 1, 1);
        this._className = split.join("::");
    }

    public get fullName(): string
    {
        return this._fullName;
    }

    public get name(): string
    {
        return this._name;
    }

    public isRoot()
    {
        return this._root || this._className == "";
    }

    public get className(): string
    {
        return this._className;
    }

    protected async _resolve(context: PuppetASTClass, resolver: Resolver): Promise<any>
    {
        let resolvedVariable = null;
        const isRoot = this.isRoot();

        if (isRoot || context.name == this._className)
        {
            // we're asking the current context, no need to resolve
            const property = context.getResolvedProperty(this._name);

            if (property)
            {
                resolvedVariable = property.value;
            }
            else if (isRoot)
            {
                // if we've been asking for a variable without classpath mentioned,
                // try to find a global variable
                resolvedVariable = await resolver.resolveGlobalVariable(this._name);
            }
        }
        else
        {
            const class_:PuppetASTClass = await resolver.resolveClass(this._className);
            const property = class_.getResolvedProperty(this._name);

            if (property)
            {
                resolvedVariable = property.value;
            }
        }

        if (!resolvedVariable)
        {
            throw new ResolveError(this, "Variable not found: " + this.fullName);
        }

        return resolvedVariable;
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