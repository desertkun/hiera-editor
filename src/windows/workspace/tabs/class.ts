import {ipc} from "../../../ipc/client";
import {WorkspaceTab} from "./tab";

export class NodeClassTab extends WorkspaceTab
{
    private classInfo: any;

    async init(): Promise<any>
    {
        const nodePath = this.path[0];
        const classPath = this.path[1];

        this.classInfo = await ipc.acquireNodeClass(nodePath, classPath);
    }

    async release(): Promise<any>
    {

    }

    render(): any
    {
    }

    get shortTitle(): string
    {
        return this.path[1];
    }

    get fullTitle(): string
    {
        return this.path.join("/");
    }

}