
import * as async from "../async";
import * as path from "path";


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

    public static async CallBin(script: string, args: string[], cwd: string, env_: any, cb?: async.ExecFileLineCallback): Promise<void>
    {
        const ruby = Ruby.Path();

        const argsTotal = [
            ruby.rubyPath,
            path.join(ruby.path, script)
        ];

        for (let arg of args)
        {
            argsTotal.push(arg);
        }

        const env = Object.assign({}, process.env);
        Object.assign(env, env_);

        env["SSL_CERT_FILE"] = require('app-root-path').resolve("ruby/cacert.pem");
        env["PATH"] = ruby.path + path.delimiter + process.env["PATH"];
    
        await async.execFileReadIn("\"" + argsTotal.join("\" \"") + "\"", cwd, env, cb);
    }

    public static async Call(script: string, args: Array<string>, cwd: string): Promise<boolean>
    {
        const ruby = Ruby.Path();
        const rubyScript = require('app-root-path').resolve(path.join("ruby", script));

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
        const rubyScript = require('app-root-path').resolve(path.join("ruby", script));

        const argsTotal = [];

        argsTotal.push(rubyScript);

        for (let arg of args)
        {
            argsTotal.push(arg);
        }

        return async.execFileInOut(Ruby.Path().rubyPath, argsTotal, cwd, data);
    }
}