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
        private _path: string;
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

        public async listEnvironments(): Promise<Array<string>>
        {
            const environmentsPath = path.join(this._path, "environments");

            if (!await async.fileExists(environmentsPath))
            {
                return [];
            }

            const dirs: string[] = await async.listFiles(environmentsPath);
            const result: Array<string> = [];

            for (const dirname of dirs)
            {
                const dir: string = path.join(environmentsPath, dirname);

                if (!await async.isDirectory(dir))
                    continue;
                
                result.push(dirname);
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
        private _name: string;
        private _path: string;
        
        constructor(name: string, path: string)
        {
            this._name = name;
            this._path = path;
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
        private _name: string;
        
        constructor(name: string)
        {
            this._name = name;
        }

        public get name():string 
        {
            return this._name;
        }
    }

    export class Class
    {
        private _name: string;

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