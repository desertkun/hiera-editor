
import * as http from "http"
import * as request from "request"
import * as path from "path"
import * as async from "../async"
import * as net from "net"
import { WorkspaceSettings } from "./workspace_settings"

export class PuppetHTTP
{
    public static async GetCertList(environment: string, settings: WorkspaceSettings): Promise<string[]>
    {
        const response = await this.RequestJSON(
            "/puppet-ca/v1/certificate_statuses/statuses?environment=" + environment,
            "GET",
            settings,
            {
                "Accept": "application/json, text/pson"
            }
        );
        
        const result: string[] = [];

        for (const d of response)
        {
            if (d.state == "signed")
            {
                result.push(d.name);
            }
        }

        return result;
    }
    
    public static async GetCertificate(certname: string, environment: string, settings: WorkspaceSettings): Promise<any>
    {
        const response = await this.Request(
            "/puppet-ca/v1/certificate/" + certname + "?environment=" + environment,
            "GET",
            settings,
            {
                "Accept": "text/plain"
            }
        );
        
        return response;
    }

    public static async GetNodeFacts(environment: string, certname: string, settings: WorkspaceSettings): Promise<any>
    {
        const response = await this.RequestJSON(
            "/puppet/v3/node/" + certname + "?environment=" + environment,
            "GET",
            settings,
            {
                "Accept": "application/json, text/pson"
            }
        );
        const facts = response["parameters"] 
        if (!facts)
            throw new Error("Node " + certname + " has no facts, please deploy them with 'puppet facts upload'")
        return facts;
    }

    private static async RequestJSON(path_: string, method: string, settings: WorkspaceSettings, headers: any): Promise<any>
    {
        const data = await this.Request(path_, method, settings, headers);
        return JSON.parse(data);
    }

    private static Request(path_: string, method: string, settings: WorkspaceSettings, headers: any): Promise<string>
    {
        return new Promise<string>((resolve, reject) => 
        {
            const server = settings.server.split(":")
            let hostname: string, port: number;
            if (server.length == 2)
            {
                hostname = server[0];
                port = parseInt(server[1]);
            }
            else
            {
                hostname = settings.server;
                port = 8140;
            }

            const paths = WorkspaceSettings.GetPaths();
            const ssldir = paths.ssldir;

            const key_ = async.readFile(path.join(ssldir, "private_keys", settings.certname + ".pem"))
            const cert_ = async.readFile(path.join(ssldir, "certs", settings.certname + ".pem"))
            const ca_ = async.readFile(path.join(ssldir, "certs", "ca.pem"))

            Promise.all([key_, cert_, ca_]).then((out: string[]) => 
            {
                const requestPath = "https://" + hostname + ":" + port + path_;

                const options = {
                    method: method,
                    key: Buffer.alloc(out[0].length, out[0]),
                    cert:Buffer.alloc(out[1].length, out[1]),
                    ca: Buffer.alloc(out[2].length, out[2]),
                    headers: headers
                }

                const req = request(requestPath, options, (error: any, response: request.Response, body: any) => 
                {
                    if (error)
                    {
                        reject(error);
                    }
                    else
                    {
                        resolve(body);
                    }
                });

            }).catch((error) => {
                reject(error);
            });
        })
    }
}