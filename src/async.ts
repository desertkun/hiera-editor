
import { app } from "electron";

import * as fs from "fs-extra";
import * as path from "path";
import * as child_process from "child_process";

import * as YAML from "yaml";

const stream = require('stream');

export function fileExists(path: string): Promise<boolean>
{
    return new Promise<boolean>((resolve, reject) =>
    {
        fs.stat(path, (err) =>
        {
            resolve(err == null);
        })
    });
}

export function fileStat(path: string): Promise<any>
{
    return new Promise<any>((resolve, reject) =>
    {
        fs.stat(path, (err, stats) =>
        {
            if (err == null)
            {
                resolve(stats);
            }
            else
            {
                resolve(null);
            }
        })
    });
}

export function readDir(path: string): Promise<any>
{
    return new Promise<any>((resolve, reject) =>
    {
        fs.readdir(path, function (err, files)
        {
            if (err == null)
            {
                resolve(files);
            }
            else
            {
                resolve(null);
            }
        });
    });
}


export async function walk(start: string, callback: any)
{
    const stat = await fileStat(start);

    if (!stat.isDirectory())
    {
        throw new Error("path: " + start + " is not a directory");
    }

    const files = await readDir(start);

    for (const fileName of files)
    {
        const fullFileName = path.join(start, fileName);
        const stat = await fileStat(fullFileName);

        if (stat.isDirectory())
        {
            await walk(fullFileName, callback);
        }
        else
        {
            callback(fullFileName, stat);
        }
    }
}

export async function mostRecentFileTime(start: string): Promise<Number>
{
    let lastModifiedTime: Number = 0;

    const stat = await fileStat(start);

    if (!stat.isDirectory())
    {
        throw new Error("path: " + start + " is not a directory");
    }

    const files = await readDir(start);
    const directories: Array<Promise<Number>> = [];

    for (const fileName of files)
    {
        const fullFileName = path.join(start, fileName);
        const stat = await fileStat(fullFileName);

        if (stat.isDirectory())
        {
            directories.push(mostRecentFileTime(fullFileName));
        }
        else
        {
            if (stat.mtimeMs > lastModifiedTime)
            {
                lastModifiedTime = stat.mtimeMs;
            }
        }
    }

    const resolved: Array<Number> = await Promise.all(directories);
    for (const en of resolved)
    {
        if (en > lastModifiedTime)
        {
            lastModifiedTime = en;
        }
    }

    return lastModifiedTime;
}

export function makeDirectory(path: string): Promise<boolean>
{
    return new Promise<boolean>((resolve, reject) =>
    {
        fs.mkdir(path, (err) =>
        {
            resolve(err == null);
        })
    });
}

export function isDirectory(path: string): Promise<boolean>
{
    return new Promise<boolean>((resolve, reject) =>
    {
        fs.stat(path, (err) =>
        {
            if (err == null)
            {
                fs.lstat(path, (err, stats) =>
                {
                    if (err)
                    {
                        reject(err);
                    }
                    else
                    {
                        resolve(stats.isDirectory());
                    }
                });
            }
            else
            {
                resolve(false);
            }
        });
    });
}

export function PromiseAllObject(object: any)
{

  let promisedProperties: Array<any> = [];
  const objectKeys = Object.keys(object);

  objectKeys.forEach((key) => promisedProperties.push(object[key]));

  return Promise.all(promisedProperties)
    .then((resolvedValues) => {
      return resolvedValues.reduce((resolvedObject, property, index) =>
      {
        resolvedObject[objectKeys[index]] = property;
        return resolvedObject;
      }, object);
    });

}

export function isFile(path: string): Promise<boolean>
{
    return new Promise<boolean>((resolve, reject) =>
    {
        fs.stat(path, (err) =>
        {
            if (err == null)
            {
                fs.lstat(path, (err, stats) =>
                {
                    if (err)
                    {
                        reject(err);
                    }
                    else
                    {
                        resolve(stats.isFile());
                    }
                })
            }
            else
            {
                resolve(false);
            }
        });
    });
}

export function createDirectory(path: string): Promise<boolean>
{
    return new Promise<boolean>((resolve, reject) =>
    {
        fs.mkdir(path, 777, (err) =>
        {
            resolve(err == null);
        });
    });
}

export function remove(path: string): Promise<boolean>
{
    return new Promise<boolean>((resolve, reject) =>
    {
        fs.remove(path, (err) =>
        {
            resolve(err == null);
        });
    });
}

export function listFiles(path: string): Promise<string[]>
{
    return new Promise<string[]>((resolve, reject) =>
    {
        fs.readdir(path, (err, files) => {
            if (err)
            {
                reject(err);
            }
            else
            {
                resolve(files);
            }
        })
    });
}

export function execFile(path: string, args: Array<string>, cwd: string, env?: any): Promise<any>
{
    return new Promise<boolean>((resolve, reject) =>
    {
        const options: child_process.ExecFileOptions = {
            'cwd': cwd,
            'maxBuffer': 1024000,
            'env': env
        };

        child_process.execFile(path, args, options, (error: Error, stdout: string, stderr: string) =>
        {
            if (error != null)
            {
                reject(error);
            }
            else
            {
                resolve();
            }
        });
    });
}

export type ExecFileLineCallback = (line: string) => void;

export function execFileReadIn(command: string, cwd: string, env?: any, cb?: ExecFileLineCallback): Promise<any>
{
    return new Promise<boolean>((resolve, reject) =>
    {
        const options: child_process.ExecFileOptions = {
            'cwd': cwd,
            'maxBuffer': 1024000,
            'env': env
        };

        const process = child_process.exec(command, options, (error: Error, stdout: string, stderr: string) =>
        {
            if (error != null)
            {
                reject(stdout);
            }
            else
            {
                resolve();
            }
        });

        if (cb != null)
        {
            process.stdout.setEncoding('utf8');
            process.stdout.on('data', function(data) 
            {
                var str = data.toString(), lines = str.split(/\r?\n/g);
                
                for (let i = lines.length - 1; i >= 0; i--)
                {
                    const line = lines[i];
                    if (line != "")
                    {
                        cb(line);
                        break;
                    }
                }
                
                return true;
            });
        }
    });
}

export function execFileInOut(path: string, args: Array<string>, cwd: string, data: string): Promise<string>
{
    return new Promise<string>((resolve, reject) =>
    {
        const options: child_process.ExecFileOptions = {
            'cwd': cwd,
            'maxBuffer': 1024000
        };

        const process = child_process.execFile(path, args, options, (error: Error, stdout: string, stderr: string) =>
        {
            if (error != null)
            {
                reject(error);
            }
            else
            {
                resolve(stdout);
            }
        });

        process.stdin.end(data, 'utf-8');
    });
}

export function readYAML(filePath: string): Promise<YAML.ast.Document>
{
    return new Promise<YAML.ast.Document>((resolve, reject) =>
    {
        fs.readFile(filePath, "UTF-8", (error, data) =>
        {
            if (error)
            {
                reject(error)
            }
            else
            {
                try
                {
                    const document = YAML.parseDocument(data);
                    resolve(document);
                }
                catch (e)
                {
                    reject(e);
                }
            }
        })
    });
}

export function readJSON(filePath: string): Promise<any>
{
    return new Promise<any>((resolve, reject) =>
    {
        fs.readFile(filePath, "UTF-8", (error, data) => 
        {
            if (error) 
            {
                reject(error)
            } 
            else 
            {

                let parsed;
                try
                {
                    parsed = JSON.parse(data);
                    resolve(parsed);
                }
                catch (e)
                {
                    reject(e);
                }
            }
        })
    });
}

export function writeFile(filePath: string, data: string): Promise<boolean>
{
    return new Promise<any>((resolve, reject) =>
    {
        fs.writeFile(filePath, data, "UTF-8", (error) => 
        {
            if (error) 
            {
                reject(error)
            } 
            else 
            {
                resolve(true);
            }
        })
    });
}

export function writeJSON(filePath: string, data: any): Promise<any>
{
    return new Promise<any>((resolve, reject) =>
    {
        let dumped;

        try
        {
            dumped = JSON.stringify(data);
        }
        catch (e)
        {
            reject(e);
            return;
        }

        fs.writeFile(filePath, dumped, "UTF-8", (error) => 
        {
            if (error) 
            {
                reject(error)
            } 
            else 
            {
                resolve();
            }
        })
    });
}

export function write(filePath: string, data: any): Promise<any>
{
    return new Promise<any>((resolve, reject) =>
    {
        fs.writeFile(filePath, data, "UTF-8", (error) =>
        {
            if (error)
            {
                reject(error)
            }
            else
            {
                resolve();
            }
        })
    });
}

export function writeYAML(filePath: string, data: any, commentBefore?: string): Promise<boolean>
{
    return new Promise<any>((resolve, reject) =>
    {
        const document = new YAML.Document();

        try
        {
            document.contents = <YAML.ast.AstNode>YAML.createNode(data);
            document.commentBefore = commentBefore;
        }
        catch (e)
        {
            reject(e);
            return;
        }

        fs.writeFile(filePath, document.toString(), "UTF-8", (error) =>
        {
            if (error)
            {
                reject(error)
            }
            else
            {
                resolve(true);
            }
        })
    });
}

export function readJSONLocal(filePath: string): Promise<any>
{
    return readJSON(path.join(app.getPath("userData"), filePath));
}

export function writeJSONLocal(filePath: string, data: any): Promise<any>
{
    return writeJSON(path.join(app.getPath("userData"), filePath), data);
}