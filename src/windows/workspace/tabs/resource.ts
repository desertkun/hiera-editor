import { NodeClassTab } from "./class";
import { IPC } from "../../../ipc/client";
import {WorkspaceRenderer} from "../renderer";

const ipc = IPC();

export class NodeResourceTab extends NodeClassTab
{
    protected title: string;

    public constructor(path: Array<string>, buttonNode: any, contentNode: any, renderer: WorkspaceRenderer)
    {
        super(path, buttonNode, contentNode, renderer);
    }

    public async init(): Promise<any>
    {
        this.title = this.path[2];
        return await super.init();
    }
    
    protected async acquireInfo(): Promise<any>
    {
        return await ipc.acquireNodeResource(this.nodePath, this.className, this.title);
    }
    
    protected async setProperty(propertyName: string, value: any)
    {
        await ipc.setNodeResourceProperty(this.nodePath, this.className, this.title, propertyName, value);
    }

    protected async removeProperty(propertyName: string)
    {
        await ipc.removeNodeResourceProperty(this.nodePath, this.className, this.title, propertyName);
    }
    
    public getProperties(): Array<string>
    {
        return this.info.fields;
    }
    
    get shortTitle(): string
    {
        return this.title + " of " + this.className;
    }

    get fullTitle(): string
    {
        return this.title + " of " + this.path.join("/");
    }
}