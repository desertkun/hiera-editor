
class PuppetASTObject
{
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

class PuppetASTClass extends PuppetASTObject
{
    private readonly _name: string;
    private readonly _body: PuppetASTObject;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        const metaData: any = args[0];

        this._name = metaData["name"].value;
        this._body = metaData["body"];
    }


    public get name(): any
    {
        return this._name;
    }

    public get body(): PuppetASTObject
    {
        return this._body;
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

    public static Create(args: Array<PuppetASTObject>): PuppetASTObject
    {
        return new PuppetASTSetInstruction(args);
    }
}

class PuppetASTVariable extends PuppetASTObject
{
    private readonly _name: string;

    constructor(args: Array<PuppetASTObject>)
    {
        super();

        this._name = (<PuppetASTPrimitive>args[0]).value;
    }

    public get name(): string
    {
        return this._name;
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
            "var": PuppetASTVariable.Create
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
                    console.log("Warning: unsupported kind of call: " + kind);
                    return null;
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