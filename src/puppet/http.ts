
import * as http from "http"
import * as https from "https"
import * as path from "path"
import * as async from "../async"
import { WorkspaceSettings } from "./workspace_settings"

export class PuppetHTTP
{
    public static async GetCertList(environment: string, settings: WorkspaceSettings): Promise<string[]>
    {
        const response = await this.RequestJSON(
            "/puppet-ca/v1/certificate_statuses/statuses?environment=" + environment,
            "GET",
            settings
        );
        
        const result: string[] = [];

        for (const d of response)
        {
            if (d.name == settings.certname)
            {
                // exclude ourselves
                continue;
            }

            if (d.state == "signed")
            {
                result.push(d.name);
            }
        }

        return result;
    }

    public static async GetNodeFacts(environment: string, certname: string, settings: WorkspaceSettings): Promise<any>
    {
        const response = await this.RequestJSON(
            "/puppet/v3/node/" + certname + "?environment=" + environment,
            "GET",
            settings
        );
        const facts = response["parameters"] 
        if (!facts)
            throw new Error("Node " + certname + " has no facts, please deploy them with 'puppet facts upload'")
        return facts;
    }

    private static async RequestJSON(path_: string, method: string, settings: WorkspaceSettings): Promise<any>
    {
        const data = await this.Request(path_, method, settings, {
            "Accept": "application/json"
        });
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
                const options = {
                    hostname: hostname,
                    port: port,
                    path: path_,
                    method: method,
                    key: out[0],
                    cert: out[1],
                    ca: out[2],
                    headers: headers
                }

                const data: string[] = [];

                const req = https.request(options, (res: http.IncomingMessage) => 
                {
                    res.on("data", (data_: Buffer) => 
                    {
                        data.push(data_.toString());
                    })

                    res.on("end", () => 
                    {
                        if (res.statusCode >= 400)
                        {
                            reject(new Error("Response: " + res.statusCode))
                        }
                        else
                        {
                            resolve(data.join(""));
                        }  
                    })
                });


                req.on('error', (e: any) => {
                    reject(e);
                });

                req.end();

            }).catch((error) => {
                reject(error);
            });
        })
    }
}