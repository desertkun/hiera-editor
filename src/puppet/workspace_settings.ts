
import * as async from "../async";
import { isObject } from "util";


export class WorkspaceSettings
{
    public puppetServer: string;
    private readonly filePath: string;

    constructor(filePath: string)
    {
        this.filePath = filePath;
    }

    public async read(): Promise<boolean>
    {
        const data = await async.readJSON(this.filePath);

        if (!isObject(data))
        {
            // ignore the contents
            return true;
        }

        return this.load(data);
    }

    public reset(): void
    {
        this.puppetServer = null;
    }

    private load(data: any): boolean
    {
        this.puppetServer = data["puppet-server"];
        return true;
    }

    public async write()
    {
        const data = this.dump();
        await async.writeJSON(this.filePath, data);
    }

    private dump(): any
    {
        return {
            "puppet-server": this.puppetServer
        }
    }
}