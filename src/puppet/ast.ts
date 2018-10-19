import {WorkspaceRenderer} from "../windows/workspace/renderer";
import {WorkspaceTab} from "../windows/workspace/tabs/tab";
import {Dictionary} from "../dictionary";

export type PuppetASTClassResolveCallback = (className: string) => Promise<PuppetASTClass>;

class PuppetASTObject
{
    protected _resolved: any;
    private _beingResolved: boolean;

    public toString(): string
    {
        return "" + this._resolved;
    }

    public async resolve(classResolver: PuppetASTClassResolveCallback): Promise<any>
    {
        if (this._resolved || this._beingResolved)
            return this._resolved;

        this._beingResolved = true;

        try
        {
            this._resolved = await this._resolve(classResolver);
        }
        finally
        {
            this._beingResolved = false;
        }

        return this._resolved;
    }

    protected async _resolve(classResolver: PuppetASTClassResolveCallback): Promise<any>
    {
        throw "Not implemented";
    }
}

class PuppetASTUnknown extends PuppetASTObject
{
    private readonly _kind: string;
    private readonly _args: Array<PuppetASTObject>;

    constructor(kind: string, args: Array<PuppetASTObject>)
    {
        super();

        this._kind = kind;
        this._args = args;
    }

    protected async _resolve(classResolver: PuppetASTClassResolveCallback): Promise<any>
    {
        throw "Unknown object of kind " + this._kind;
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

class PuppetASTPrimitive extends PuppetASTObject
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

    protected async _resolve(classResolver: PuppetASTClassResolveCallback): Promise<any>
    {
        return this._value;
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTPrimitive(args);
    }
}

class PuppetASTList extends PuppetASTObject
{
    private readonly _entries: Array<PuppetASTObject>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._entries = args;
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

class PuppetASTType extends PuppetASTObject
{
    private readonly _type: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._type = args[0];
    }

    protected async _resolve(classResolver: PuppetASTClassResolveCallback): Promise<any>
    {
        return await this._type.resolve(classResolver)
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

class PuppetASTBlock extends PuppetASTObject
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

class PuppetASTResolvedProperty
{
    private readonly _type: string;
    private readonly _value: any;

    constructor (type: string, value: any)
    {
        this._type = type;
        this._value = value;
    }

    public get type(): string
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
    private readonly _resolvedProperties: Dictionary<string, PuppetASTResolvedProperty>;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const metaData: any = args[0];

        this._name = metaData["name"].value;
        this._body = metaData["body"];
        this._params = metaData["params"] || {};
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

    public getResolvedProperty(name: string): PuppetASTResolvedProperty
    {
        return this._resolvedProperties.get(name);
    }

    public get params(): any
    {
        return this._params;
    }

    protected async _resolve(classResolver: PuppetASTClassResolveCallback): Promise<any>
    {
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
                    await type.resolve(classResolver);
                    type = type.toString();
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
                result = await value.resolve(classResolver);
            }
            catch (e)
            {
                console.log("Failed to resolve param " + paramName + " (" + value.constructor.name + "): " + e);
                continue;
            }

            this._resolvedProperties.put(paramName, new PuppetASTResolvedProperty(type, result));
        }

        if (this._body instanceof PuppetASTList)
        {
            for (const bodyEntry of this._body.entries)
            {
                if (bodyEntry instanceof PuppetASTSetInstruction)
                {
                    const receiver = bodyEntry.receiver;

                    if (!(receiver instanceof PuppetASTVariable))
                    {
                        continue;
                    }

                    if (receiver.className != "")
                    {
                        continue;
                    }

                    const paramName = receiver.name;

                    const provider = bodyEntry.provider;

                    let result: any;

                    try
                    {
                        result = await provider.resolve(classResolver);
                    }
                    catch (e)
                    {
                        continue;
                    }

                    this._resolvedProperties.put(paramName, new PuppetASTResolvedProperty(null, result));
                }
            }
        }
    }

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTClass(args);
    }
}

class PuppetASTSetInstruction extends PuppetASTObject
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

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTSetInstruction(args);
    }
}

class PuppetASTVariable extends PuppetASTObject
{
    private readonly _fullName: string;
    private readonly _name: string;
    private readonly _className: string;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._fullName = (<PuppetASTPrimitive>args[0]).value;

        const split = this._fullName.split("::");
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

    public get className(): string
    {
        return this._className;
    }

    protected async _resolve(classResolver: PuppetASTClassResolveCallback): Promise<any>
    {
        const class_:PuppetASTClass = await classResolver(this._className);
        const resolvedVariable = class_.getResolvedProperty(this._name);
        return resolvedVariable.value;
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
            "qr": PuppetASTType.Create
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