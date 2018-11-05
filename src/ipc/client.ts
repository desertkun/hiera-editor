import IpcClient from "electron-ipc-tunnel/client";

class IpcProxy implements ProxyHandler<IpcClient>
{
    get (target: IpcClient, p: PropertyKey, receiver: any): any
    {
        const methodName = p.toString();

        return function()
        {
            const args = [methodName];
            for (const arg of arguments)
            {
                args.push(arg);
            }
            
            return target.send.apply(target, args);
        };
    }
}

export const ipc: any = new Proxy<IpcClient>(new IpcClient(), new IpcProxy());