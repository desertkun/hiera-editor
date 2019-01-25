
import { Ruby } from "./ruby"
import * as child_process from "child_process";

export class PuppetRubyBridge
{
    private nextId: number;
    private connected: boolean;
    private requests: any;
    private process: child_process.ChildProcess;

    private stream: string;

    constructor()
    {
        this.nextId = 0;
        this.requests = {};
        this.stream = "";
    }

    public start()
    {
        const zis = this;
        const env = {};

        this.connected = true;
        this.process = Ruby.StreamRuby("puppet-compiler.rb", [], env);

        this.process.on("close", (code: number, signal: string) => 
        {
            console.log("Disconnected from Ruby Bridge: " + code + " " + signal);
            zis.connected = false;
            zis.process = null;
        })

        this.process.stderr.on("error", (e) => 
        {
            console.log(e.toString());
            zis.connected = false;
            zis.process = null;
        });

        this.process.stderr.on("data", (data) => 
        {
            console.log(data.toString());
        });

        this.process.stdout.on("data", (data) => 
        {
            zis.stream += data.toString();

            const lines = zis.stream.split(/\r?\n/g);
            if (lines.length <= 1)
                return;

            zis.stream = lines[lines.length - 1];
            
            for (let i = 0, t = lines.length - 1; i < t; i++)
            {
                zis.received(lines[i]);
            }
        });

        console.log("Connected to Ruby Bridge");
    }
    
    private received(raw: string)
    {
        let data;

        try
        {
            data = JSON.parse(raw);
        }
        catch (e)
        {
            console.log(e);
            return;
        }

        const id = data["id"];

        if (id == null)
            return;

        const r = this.requests[id];
        if (r == null)
            return;

        delete this.requests[id];

        if (data["success"])
        {
            r.resolve(data["result"]);
        }
        else
        {
            r.reject(data["error"]);
        }
    }

    private send(object: any)
    {
        this.process.stdin.write(JSON.stringify(object));
        this.process.stdin.write("\n");
    }

    public load(scripts: string[]): Promise<any>
    {
        if (!this.connected)
        {
            throw Error("Connection to ruby bridge is closed");
        }

        this.nextId++;

        const id = this.nextId.toString();
        const zis = this;

        const promise = new Promise<any>((resolve, reject) => 
        {
            zis.requests[id] = {resolve: resolve, reject: reject};
        });

        this.send({
            "id": id, 
            "action": "load",
            "scripts": scripts
        });

        return promise;
    }

    public call(functionName: string, args: any[]): Promise<any>
    {
        if (!this.connected)
        {
            throw Error("Connection to ruby bridge is closed");
        }

        this.nextId++;

        const id = this.nextId.toString();
        const zis = this;

        const promise = new Promise<any>((resolve, reject) => 
        {
            zis.requests[id] = {resolve: resolve, reject: reject};
        });

        this.send({
            "id": id, 
            "action": "call",
            "function": functionName,
            "args": args
        });

        return promise;
    }
}