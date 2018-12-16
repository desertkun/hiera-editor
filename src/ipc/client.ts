import IpcClient from "electron-ipc-tunnel/client";
import {IpcAPI} from "./api";

class IpcProxy implements ProxyHandler<any>
{
    private readonly client: IpcClient;

    constructor()
    {
        this.client = new IpcClient();
    }

    get (target: any, p: PropertyKey, receiver: any): any
    {
        const zis = this;
        const methodName = p.toString();

        return function()
        {
            const args = [methodName];
            for (const arg of arguments)
            {
                args.push(arg);
            }
            
            return zis.client.send.apply(zis.client, args);
        };
    }
}

export function IPC(): IpcAPI
{
    return new Proxy<any>({}, new IpcProxy()) as IpcAPI;
}
