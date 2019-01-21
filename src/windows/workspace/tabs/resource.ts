import { NodeClassTab } from "./class";
import { IPC } from "../../../ipc/client";
import { ResourceDump, HierarchyEntryDump } from "../../../ipc/objects"
import { WorkspaceRenderer } from "../renderer";

const $ = require("jquery");
const ipc = IPC();

export class NodeResourceTab extends NodeClassTab
{
    private resourceInfo: ResourceDump;
    protected title: string;

    public constructor(path: Array<string>, buttonNode: any, contentNode: any, renderer: WorkspaceRenderer)
    {
        super(path, buttonNode, contentNode, renderer);
    }

    public async init(): Promise<any>
    {
        this.title = this.path[3];
        return await super.init();
    }
    
    public async focusIn(): Promise<void>
    {
        if (!(await ipc.isNodeDefinedTypeValid(this.environment, this.certname, this.className, this.title)))
        {
            await this.refresh();
        }
    }

    private get hierarchyKey()
    {
        return this.resourceInfo.options["hiera_resources"];
    }
    
    protected async acquireInfo()
    {
        this.resourceInfo = await ipc.acquireNodeResource(this.environment, this.certname, this.className, this.title);
    }
    
    protected renderHierarchySelector()
    {
        // resource editing has no resource selecting
    }
    
    protected async setProperty(propertyName: string, value: any)
    {
        await ipc.setNodeResourceProperty(this.environment, this.certname, 
            this.resourceInfo.hierarchyLevel, this.hierarchyKey, this.className, this.title, propertyName, value);
    }

    protected async removeProperty(propertyName: string)
    {
        await ipc.removeNodeResourceProperty(this.environment, this.certname, 
            this.resourceInfo.hierarchyLevel, this.hierarchyKey, this.className, this.title, propertyName);
    }

    public get hierarchy(): HierarchyEntryDump[]
    {
        return this.resourceInfo.hierarchy;
    }
    
    public getProperties(): Array<string>
    {
        return this.resourceInfo.fields;
    }

    protected getDescription(): string
    {
        if (this.resourceInfo.definedTypeInfo == null)
            return null;

        return this.resourceInfo.definedTypeInfo.description;
    }

    protected getTag(tag: string, name: string): string
    {
        if (this.resourceInfo.definedTypeInfo == null)
            return null;
            
        const tags = this.resourceInfo.definedTypeInfo.tags;

        if (tags[tag] == null)
            return null;

        return tags[tag][name];
    }
    
    protected hasHints(): boolean
    {
        return this.resourceInfo.hints != null && this.resourceInfo.hints.length > 0;
    }

    protected getHints(): any[]
    {
        return this.resourceInfo.hints;
    }

    protected getPropertyHints(propertyName: string): any[]
    {
        return this.resourceInfo.propertyHints[propertyName];
    }

    protected getPropertyErrorInfo(propertyName: string): any
    {
        return this.resourceInfo.errors[propertyName];
    }

    public get values(): any
    {
        return this.resourceInfo.values;
    }

    public classInfo(): any
    {
        return this.resourceInfo.definedTypeInfo;
    }

    protected getPropertyTypeInfo(propertyName: string): any
    {
        return this.resourceInfo.types[propertyName];
    }

    protected getPropertyValue(propertyName: string): any
    {
        return this.values[propertyName];
    }

    protected isValueModified(propertyName: string): number
    {
        return this.resourceInfo.modified[propertyName];
    }

    protected isFieldRequired(propertyName: string): boolean
    {
        return this.resourceInfo.requiredFields.indexOf(propertyName) >= 0;
    }
    
    get shortTitle(): string
    {
        return this.title + " of " + this.className;
    }

    get fullTitle(): string
    {
        return this.title + " of " + this.path.join("/");
    }

    public getIcon(): any
    {
        const iconData = this.resourceInfo.icon;

        if (iconData != null)
        {
            return $('<img class="node-entry-icon" src="' + iconData + '" style="width: 16px; height: 16px;">');
        }
        else
        {
            return $('<i class="far fa-clone"></i>');
        }
    }
}