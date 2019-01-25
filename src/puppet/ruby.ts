
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
        return fixed;
    }

    public static async CallBin(script: string, args: string[], cwd: string, env_: any, cb?: async.ExecFileLineCallback): Promise<string>
    {
        const gemPath = path.join(Ruby.RubyScriptsPath(), "gems", "ruby", "2.3.0");
        const gemBundlerPath = path.join(Ruby.RubyScriptsPath(), "bundler");
        const binPath = path.join(Ruby.RubyScriptsPath(), "bin");

        const ruby = Ruby.Path();

        const argsTotal = [
            '"' + path.join(binPath, script) + '"'
        ];

        for (let arg of args)
        {
            argsTotal.push(arg);
        }

        const env = Object.assign({}, process.env);
        Object.assign(env, env_);

        env["SSL_CERT_FILE"] = path.join(Ruby.RubyScriptsPath(), "cacert.pem");
        env["GEM_PATH"] = gemPath + path.delimiter + gemBundlerPath;
        env["GEM_HOME"] = gemPath;
        env["PATH"] = ruby.path + path.delimiter + process.env["PATH"];
    
        console.log("calling " + ruby.rubyPath + " " + argsTotal.join(" "));
        return await async.execFileReadIn('"' + ruby.rubyPath + '"', argsTotal, cwd, env, cb);
    }

    public static async CallScript(script: string, args: string[], cwd: string, env_?: any, cb?: async.ExecFileLineCallback): Promise<string>
    {
        const gemPath = path.join(Ruby.RubyScriptsPath(), "gems", "ruby", "2.3.0");
        const gemBundlerPath = path.join(Ruby.RubyScriptsPath(), "bundler");
        const binPath = Ruby.RubyScriptsPath();

        const ruby = Ruby.Path();

        const argsTotal = [
            '"' + path.join(binPath, script) + '"'
        ];

        for (let arg of args)
        {
            argsTotal.push(arg);
        }

        const env = Object.assign({}, process.env);
        if (env_ != null)
            Object.assign(env, env_);

        env["SSL_CERT_FILE"] = path.join(Ruby.RubyScriptsPath(), "cacert.pem");
        env["GEM_PATH"] = gemPath + path.delimiter + gemBundlerPath;
        env["GEM_HOME"] = gemPath;
        env["PATH"] = ruby.path + path.delimiter + process.env["PATH"];
    
        console.log("calling " + ruby.rubyPath + " " + argsTotal.join(" "));
        const result = await async.execFileReadIn('"' + ruby.rubyPath + '"', argsTotal, cwd, env, cb);
        console.log("success!");
        return result;
    }
    
    public static Stream(script: string, args: string[], env_?: any): 
        child_process.ChildProcess
    {
        const gemPath = path.join(Ruby.RubyScriptsPath(), "gems", "ruby", "2.3.0");
        const gemBundlerPath = path.join(Ruby.RubyScriptsPath(), "bundler");

        const ruby = Ruby.Path();

        const argsTotal = [
            '"' + path.join(Ruby.RubyScriptsPath(), script) + '"'
        ];

        for (let arg of args)
        {
            argsTotal.push(arg);
        }

        const env = Object.assign({}, process.env);
        if (env_ != null)
            Object.assign(env, env_);

        env["SSL_CERT_FILE"] = path.join(Ruby.RubyScriptsPath(), "cacert.pem");
        env["GEM_PATH"] = gemPath + path.delimiter + gemBundlerPath + '"';
        env["GEM_HOME"] = gemPath;
        env["PATH"] = ruby.path + path.delimiter + process.env["PATH"];
    
        console.log("path = " + env["PATH"]);
        console.log("getm path = " + gemPath);
        console.log("calling " + ruby.rubyPath + " args " + argsTotal.join(" "));
            
        const options: child_process.SpawnOptions = {
            'cwd': Ruby.RubyScriptsPath(),
            'env': env,
            'shell': true,
        };

        return child_process.spawn('"' + ruby.rubyPath + '"', argsTotal, options);
    }

    public static CallAndSendStdIn(script: string, args: Array<string>, cwd: string, data: string): Promise<void>
    {
        const ruby = Ruby.Path();
        const rubyScript = path.join(Ruby.RubyScriptsPath(), script);
        const argsTotal = [];

        argsTotal.push(rubyScript);

        for (let arg of args)
        {
            argsTotal.push(arg);
        }

        return async.execAndSendStdIn(ruby.rubyPath, argsTotal, cwd, data);
    }
}