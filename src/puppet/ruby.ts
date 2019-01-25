
import * as async from "../async";
import * as path from "path";
import * as child_process from "child_process";

export class RubyPath
{
    public path: string;
    public rubyPath: string;
    public gemPath: string;
}

export class Ruby
{
    private static Path_(): RubyPath
    {
        if (process.platform == "win32")
        {
            return require('rubyjs-win32');
        }
        else if (process.platform == "darwin")
        {
            return require('rubyjs-darwin');
        }
        else if (process.platform == "linux")
        {
            return require('rubyjs-linux');
        }
        
        return null;
    }
    
    public static Path(): RubyPath
    {
        const path_ = Ruby.Path_();

        return {
            path: path_.path.replace('app.asar', 'app.asar.unpacked'),
            rubyPath: path_.rubyPath.replace('app.asar', 'app.asar.unpacked'),
            gemPath: path_.gemPath.replace('app.asar', 'app.asar.unpacked'),
        };
    }

    public static RubyScriptsPath(): string
    {
        const ruby = require('app-root-path').resolve("ruby");
        const fixed = ruby.replace('app.asar', 'app.asar.unpacked');
        console.log("Ruby Scripts Path = " + fixed);
        return fixed;
    }

    public static async CallBin(script: string, args: string[], cwd: string, env_: any, cb?: async.ExecFileLineCallback): Promise<string>
    {
        const ruby = Ruby.Path();

        const argsTotal = [
            '"' + path.join(ruby.path, script) + '"'
        ];

        for (let arg of args)
        {
            argsTotal.push(arg);
        }

        const env = Object.assign({}, process.env);
        Object.assign(env, env_);

        env["SSL_CERT_FILE"] = path.join(Ruby.RubyScriptsPath(), "cacert.pem");
        env["PATH"] = '"' + ruby.path + '"' + path.delimiter + process.env["PATH"];
    
        console.log("calling " + argsTotal.join(" "));
        return await async.execFileReadIn(argsTotal.join(" "), cwd, env, cb);
    }

    public static async CallRubyBin(script: string, args: string[], cwd: string, env_: any, cb?: async.ExecFileLineCallback): Promise<void>
    {
        const ruby = Ruby.Path();

        const argsTotal = [
            '"' + ruby.rubyPath + '"',
            '"' + path.join(ruby.path, script) + '"'
        ];

        for (let arg of args)
        {
            argsTotal.push(arg);
        }

        const env = Object.assign({}, process.env);
        Object.assign(env, env_);

        env["SSL_CERT_FILE"] = path.join(Ruby.RubyScriptsPath(), "cacert.pem");
        env["PATH"] = '"' + ruby.path + '"' + path.delimiter + process.env["PATH"];
    
        console.log("calling " + argsTotal.join(" "));
        await async.execFileReadIn(argsTotal.join(" "), cwd, env, cb);
    }

    
    public static StreamRuby(script: string, args: string[],  env_: any): 
        child_process.ChildProcess
    {
        const ruby = Ruby.Path();

        const argsTotal = [
            '"' + path.join(Ruby.RubyScriptsPath(), script) + '"'
        ];

        for (let arg of args)
        {
            argsTotal.push(arg);
        }

        const env = Object.assign({}, process.env);
        Object.assign(env, env_);

        env["SSL_CERT_FILE"] = path.join(Ruby.RubyScriptsPath(), "cacert.pem");
        env["PATH"] = '"' + ruby.path + '"' + path.delimiter + process.env["PATH"];
    
        console.log("path = " + env["PATH"]);
        console.log("calling " + ruby.rubyPath + " args " + argsTotal.join(" "));
            
        const options: child_process.SpawnOptions = {
            'cwd': Ruby.RubyScriptsPath(),
            'env': env,
            'shell': true
        };

        return child_process.spawn('"' + ruby.rubyPath + '"', argsTotal, options);
    }

    public static async Call(script: string, args: Array<string>, cwd: string): Promise<boolean>
    {
        const ruby = Ruby.Path();
        const rubyScript = path.join(Ruby.RubyScriptsPath(), script);

        const argsTotal = [];

        argsTotal.push(rubyScript);

        for (let arg of args)
        {
            argsTotal.push(arg);
        }
    
        try
        {
            await async.execFile(ruby.rubyPath, argsTotal, cwd);
            return true;
        }
        catch (e)
        {
            console.log("Failed to execute " + script + ": " + e);
            return false;
        }
    }

    public static CallInOut(script: string, args: Array<string>, cwd: string, data: string): Promise<string>
    {
        const rubyScript = path.join(Ruby.RubyScriptsPath(), script);

        const argsTotal = [];

        argsTotal.push(rubyScript);

        for (let arg of args)
        {
            argsTotal.push(arg);
        }

        return async.execFileInOut(Ruby.Path().rubyPath, argsTotal, cwd, data);
    }
}