import * as process from "process";
import * as path from "path";

import * as async from "./async";

export module puppet
{
    export class Ruby
    {
        public static Path(): string
        {
            if (process.platform == "darwin")
            {
                return require('traveling-ruby-osx');
            }

            if (process.platform == "win32")
            {
                return require('traveling-ruby-win32');
            }
            
            if (process.platform == "linux")
            {
                return require('traveling-ruby-linux-x86_64');
            }

            return null;
        }

        public static Call(script: string, args: Array<string>, cwd: string): Promise<boolean>
        {
            const rubyScript = require('app-root-path').resolve(path.join("ruby", script));

            const argsTotal = [];

            argsTotal.push(rubyScript);

            for (let arg of args)
            {
                argsTotal.push(arg);
            }
        
            return async.execFile(Ruby.Path(), argsTotal, cwd);
        }
    }

    export class Workspace
    {
        private readonly _path: string;
        private _name: string;

        constructor(path: string)
        {
            this._path = path;
        }

        public get path():string 
        {
            return this._path;
        }

        public get name():string 
        {
            return this._name;
        }

        public async getEnvironment(name: string): Promise<Environment>
        {
            const environmentsPath = path.join(this._path, "environments");

            if (!await async.isDirectory(environmentsPath))
            {
                return null;
            }

            const environmentPath = path.join(environmentsPath, name);

            if (!await async.isDirectory(environmentsPath))
            {
                return null;
            }

            return new Environment(name, environmentPath);
        }

        public async listEnvironments(): Promise<Array<Environment>>
        {
            const environmentsPath = path.join(this._path, "environments");

            if (!await async.fileExists(environmentsPath))
            {
                return [];
            }

            const dirs: string[] = await async.listFiles(environmentsPath);
            const result: Array<Environment> = [];

            for (const directoryName of dirs)
            {
                const dir: string = path.join(environmentsPath, directoryName);

                if (!await async.isDirectory(dir))
                    continue;

                const env: Environment = new Environment(directoryName, dir);
                result.push(env);
            }

            return result;
        }

        public async validate()
        {
            const environmentsPath = path.join(this._path, "environments");

            if (!await async.fileExists(environmentsPath))
            {
                throw new Error("The path does not appear to be a puppet root code folder. " +
                                 "The puppet root code folder should contain the \"environments\" folder inside.");
            }

            const confPath = path.join(this._path, "environment.conf");

            if (!await async.fileExists(confPath))
            {
                throw new Error("The path does not appear to be a puppet root code folder. " +
                                 "The puppet root code folder should contain the \"environment.conf\" file inside.");
            }
        }

        public async load()
        {
            await this.validate();

            const workspaceFilePath = path.join(this._path, "workspace.json");

            const exists: boolean = await async.fileExists(workspaceFilePath);
            if (!exists)
            {
                this._name = path.basename(this._path);
                return true;
            }
            
            let data;

            try
            {
                data = await async.readJSON(workspaceFilePath);
            }
            catch (e)
            {
                return new Error("Failed to load workspace: " + e.message);
            }

            if (!data)
            {
                return new Error("Failed to load workspace: corrupted.");
            }

            this._name = data["name"];

            return (this._name != null);
        }

        public dump(): any
        {
            return {
                "name": this._name
            }
        }
    }

    export class Environment
    {
        private readonly _name: string;
        private readonly _path: string;
        private readonly _root: Folder;
        
        constructor(name: string, path: string)
        {
            this._name = name;
            this._path = path;
            this._root = new Folder("data", this.dataPath);
        }

        public get root(): Folder
        {
            return this._root;
        }

        public get dataPath(): string
        {
            return path.join(this._path, "data");
        }

        public get name():string 
        {
            return this._name;
        }

        public get path():string 
        {
            return this._path;
        }
    }

    export class Folder
    {
        private readonly _name: string;
        private readonly _path: string;

        constructor(name: string, path: string)
        {
            this._name = name;
            this._path = path;
        }

        public async tree(): Promise<any>
        {
            const folders: any = [];

            for (const folder of await this.getFolders())
            {
                folders.push(await folder.tree());
            }

            const nodes: any = [];

            for (const node of await this.getNodes())
            {
                nodes.push(node.name);
            }

            return {
                "name": this._name,
                "folders": folders,
                "nodes": nodes
            };
        }


        public async getFolders(): Promise<Array<Folder>>
        {
            if (!await async.fileExists(this._path))
            {
                return [];
            }

            if (!await async.isDirectory(this._path))
            {
                return [];
            }

            const result:Array<Folder> = [];

            for (const entry of await async.listFiles(this._path))
            {
                const entryPath = path.join(this._path, entry);

                if (await async.isDirectory(entryPath))
                {
                    result.push(new Folder(entry, entryPath));
                }
            }

            return result;
        }

        public async getNodes(): Promise<Array<Node>>
        {
            if (!await async.fileExists(this._path))
            {
                return [];
            }

            if (!await async.isDirectory(this._path))
            {
                return [];
            }

            const result:Array<Node> = [];

            for (const entry of await async.listFiles(this._path))
            {
                const nodeName = Node.ValidatePath(entry);

                if (nodeName == null)
                    continue;

                const entryPath = path.join(this._path, entry);

                if (await async.isFile(entryPath))
                {
                    result.push(new Node(nodeName, entryPath));
                }
            }

            return result;
        }

        public get name():string
        {
            return this._name;
        }

        public get path():string
        {
            return this._path;
        }
    }

    export class Node
    {
        private readonly _name: string;
        private readonly _path: string;
        
        constructor(name: string, path: string)
        {
            this._name = name;
            this._path = path;
        }

        static ValidatePath(pathName: string): string
        {
            if (!pathName.endsWith(".yaml"))
                return null;

            return pathName.substr(0, pathName.length - 5);
        }

        public get name():string 
        {
            return this._name;
        }

        public get path():string
        {
            return this._path;
        }
    }

    export class Class
    {
        private readonly _name: string;

        constructor(name: string)
        {
            this._name = name;
        }

        public get name():string 
        {
            return this._name;
        }
    }

    /*
    enum PropertyType
    {
        string,
        integer,
    }

    class Property
    {

        constructor(name: string)
        {
            this._name = name;
        }

        public get name():string 
        {
            return this._name;
        }
    }
    */
}