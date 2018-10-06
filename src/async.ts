
import { app } from "electron";

import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";

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

export function isDirectory(path: string): Promise<boolean>
{
    return new Promise<boolean>((resolve, reject) =>
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
        })
    });
}

export function isFile(path: string): Promise<boolean>
{
    return new Promise<boolean>((resolve, reject) =>
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

export function execFile(path: string, args: Array<string>, cwd: string): Promise<boolean>
{
    return new Promise<boolean>((resolve, reject) =>
    {
        const options: child_process.ExecFileOptions = {
            'cwd': cwd,
            'maxBuffer': 1024000
        };

        child_process.execFile(path, args, options, (error: Error, stdout: string, stderr: string) => 
        {
            resolve(error == null);
        });
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

export function readJSONLocal(filePath: string): Promise<any>
{
    return readJSON(path.join(app.getPath("userData"), filePath));
}

export function writeJSONLocal(filePath: string, data: any): Promise<any>
{
    return writeJSON(path.join(app.getPath("userData"), filePath), data);
}