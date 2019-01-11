
import { PuppetModulesInfo } from "./modules_info"

export class PuppetClassInfo
{
    public readonly name: string;
    private readonly info: any;
    private readonly _options: any;
    private readonly _tags: any;
    private readonly _description: string;
    private readonly _modules: PuppetModulesInfo;

    constructor(name: string, info: any, modules: PuppetModulesInfo)
    {
        this.name = name;
        this.info = info;
        this._modules = modules;
        this._options = {};
        this._tags = {};

        const docstring = info["docstring"];
        if (docstring)
        {
            this._description = docstring["text"];

            const tags = docstring["tags"];
            if (tags)
            {
                for (const tag of tags)
                {
                    const tag_name = tag["tag_name"];
                    const name = tag["name"];

                    if (tag_name == "option" && name == "editor")
                    {
                        this._options[tag["opt_name"]] = tag["opt_text"];
                    }

                    const text = tag["text"];
                    if (text)
                    {
                        if (this._tags[tag_name] == null)
                            this._tags[tag_name] = {};

                        this._tags[tag_name][name] = text;
                    }
                }
            }
        }
        else
        {
            this._description = "";
        }
    }

    public get file(): string
    {
        return this.info["file"];
    }

    public get defaults(): Array<string>
    {
        return Object.keys(this.info["defaults"] || {});
    }

    public get description(): string
    {
        return this._description;
    }

    public get options(): any
    {
        return this._options;
    }

    public get tags(): any
    {
        return this._tags;
    }

    public get source(): string
    {
        return this.info["source"];
    }

    public get modulesInfo(): PuppetModulesInfo
    {
        return this._modules;
    }

    public dump()
    {
        return {
            "name": this.name,
            "file": this.info["file"],
            "defaults": this.defaults,
            "inherits": this.info["inherits"],
            "description": this.description,
            "options": this.options,
            "tags": this.tags
        }
    }
}

export class PuppetDefinedTypeInfo
{
    public readonly name: string;
    private readonly info: any;
    private readonly _tags: any;
    private readonly _options: any;
    private readonly _description: string;
    private readonly _modules: PuppetModulesInfo;

    constructor(name: string, info: any, modules: PuppetModulesInfo)
    {
        this.name = name;
        this.info = info;
        this._modules = modules;
        this._options = {};
        this._tags = {};

        const docstring = info["docstring"];
        if (docstring)
        {
            this._description = docstring["text"];

            const tags = docstring["tags"];
            if (tags)
            {
                for (const tag of tags)
                {
                    const tag_name = tag["tag_name"];
                    const name = tag["name"];

                    if (tag_name == "option" && name == "editor")
                    {
                        this._options[tag["opt_name"]] = tag["opt_text"];
                    }

                    const text = tag["text"];
                    if (text)
                    {
                        if (this._tags[tag_name] == null)
                            this._tags[tag_name] = {};

                        this._tags[tag_name][name] = text;
                    }
                }
            }
        }
        else
        {
            this._description = "";
        }
    }

    public get modulesInfo(): PuppetModulesInfo
    {
        return this._modules;
    }

    public get source(): string
    {
        return this.info["source"];
    }

    public get defaults(): Array<string>
    {
        return Object.keys(this.info["defaults"] || {});
    }

    public get description(): string
    {
        return this._description;
    }

    public get options(): any
    {
        return this._options;
    }

    public get tags(): any
    {
        return this._tags;
    }

    public get file(): string
    {
        return this.info["file"];
    }

    public dump()
    {
        return {
            "name": this.name,
            "file": this.info["file"],
            "defaults": this.defaults,
            "inherits": this.info["inherits"],
            "description": this.description,
            "options": this.options,
            "tags": this.tags
        }
    }
}

export class PuppetFunctionInfo
{
    public readonly name: string;
    private readonly info: any;
    private readonly _tags: any;
    private readonly _options: any;
    private readonly _description: string;
    private readonly _modules: PuppetModulesInfo;

    constructor(name: string, info: any, modules: PuppetModulesInfo)
    {
        this.name = name;
        this.info = info;
        this._modules = modules;
        this._options = {};
        this._tags = {};

        const docstring = info["docstring"];
        if (docstring)
        {
            this._description = docstring["text"];

            const tags = docstring["tags"];
            if (tags)
            {
                for (const tag of tags)
                {
                    const tag_name = tag["tag_name"];
                    const name = tag["name"];

                    if (tag_name == "option" && name == "editor")
                    {
                        this._options[tag["opt_name"]] = tag["opt_text"];
                    }

                    const text = tag["text"];
                    if (text)
                    {
                        if (this._tags[tag_name] == null)
                            this._tags[tag_name] = {};

                        this._tags[tag_name][name] = text;
                    }
                }
            }
        }
        else
        {
            this._description = "";
        }
    }

    public get modulesInfo(): PuppetModulesInfo
    {
        return this._modules;
    }

    public get source(): string
    {
        return this.info["source"];
    }

    public get description(): string
    {
        return this._description;
    }

    public get options(): any
    {
        return this._options;
    }

    public get tags(): any
    {
        return this._tags;
    }

    public get file(): string
    {
        return this.info["file"];
    }

    public dump()
    {
        return {
            "name": this.name,
            "file": this.info["file"],
            "inherits": this.info["inherits"],
            "description": this.description,
            "options": this.options,
            "tags": this.tags
        }
    }
}