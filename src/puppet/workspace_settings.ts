
import * as async from "../async";
import * as path from "path";
import { app } from "electron";
import { isObject } from "util";

const ini = require('ini');
const slash = require('slash');

export interface WorkspacePuppetPaths
{
    confdir: string;
    ssldir: string;
    vardir: string;
    rundir: string;
    logdir: string;
}

export class WorkspaceSettings
{
    public certname: string;
    public server: string;

    private readonly filePath: string;
    private readonly codePath: string;

    constructor(filePath: string, codePath: string)
    {
        this.filePath = filePath;
        this.codePath = codePath;
    }

    public static GetPaths(): WorkspacePuppetPaths
    {
        const home = app.getPath("home");
        const hieraHome = path.join(home, ".hieraeditor");

        return {
            confdir: slash(path.join(hieraHome, "etc", "puppet")),
            ssldir: slash(path.join(hieraHome, "etc", "puppet", "ssl")),
            vardir: slash(path.join(hieraHome, "opt", "puppet")),
            rundir: slash(path.join(hieraHome, "var", "run")),
            logdir: slash(path.join(hieraHome, "var", "log"))
        }
    }

    public async read(): Promise<boolean>
    {
        if (!await async.isFile(this.filePath))
            return false;

        let raw: string;

        try
        {
            raw = await async.readFile(this.filePath);
        }
        catch (e)
        {
            return false;
        }

        let data: any;

        try
        {
            data = ini.parse(raw);
        }
        catch (e)
        {
            return false;
        }

        if (!isObject(data))
        {
            // ignore the contents
            return true;
        }

        return this.load(data);
    }

    public async isValid(offline: boolean): Promise<boolean>
    {
        if (this.certname == null || this.certname == "")
            return false;

        if (this.server == null || this.server == "")
            return false;

        if (!offline)
        {
            const {ssldir} = WorkspaceSettings.GetPaths();
    
            if (!await async.isFile(path.join(ssldir, "certs", "ca.pem")))
                return false;
    
            if (!await async.isFile(path.join(ssldir, "certs", this.certname + ".pem")))
                return false;
    
            if (!await async.isFile(path.join(ssldir, "private_keys", this.certname + ".pem")))
                return false;
        }

        return true;
    }

    public reset(): void
    {
        this.certname = null;
        this.server = null;
    }

    private load(data: any): boolean
    {
        const main = data["main"] || {};
        this.certname = main["certname"];
        this.server = main["server"];
        return true;
    }

    public async write()
    {
        const data = this.dump();
        const raw = ini.stringify(data);
        await async.writeFile(this.filePath, raw);
    }

    private dump(): any
    {
        return {
            "main": {
                "environment": "production",
                "codedir": this.codePath,
                "certname": this.certname,
                "server": this.server
            }
        }
    }
}