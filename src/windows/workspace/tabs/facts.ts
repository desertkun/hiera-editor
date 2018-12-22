import { IPC } from "../../../ipc/client";
import {WorkspaceTab} from "./tab";
import {WorkspaceRenderer} from "../renderer";

const ipc = IPC();

declare const JSONEditor: any;
const $ = require("jquery");

export class FactsTab extends WorkspaceTab 
{
    private nodePath: string;
    private facts: any;
    private editor: any;

    async init(): Promise<any>
    {
        this.nodePath = this.path[0];
        this.facts = await ipc.acquireNodeFacts(this.nodePath);
    }

    constructor(path: Array<string>, buttonNode: any, contentNode: any, renderer: WorkspaceRenderer)
    {
        super(path, buttonNode, contentNode, renderer);

    }

    async release(): Promise<any>
    {
    }

    render(): any
    {
        const zis = this;

        const factsEditor = $('<div class="container-w-padding w-100 h-100"></div>').appendTo(this.contentNode);
        
        this.editor = new JSONEditor(factsEditor[0], {
            modes: ['code', 'tree'],
            schema: {
                "type": "object",
                "propertyNames": {
                    "pattern": "^[A-Za-z_-][A-Za-z0-9_-]+$"
                }
            },
            onChange: async () => 
            {
                await ipc.updateNodeFacts(zis.nodePath, zis.editor.get());
            }
        }, this.facts);
    }

    public getIcon(): any
    {
        return $('<i class="fas fa-bars"></i>');
    }

    get shortTitle(): string
    {
        return "Facts of " + this.nodePath;
    }

}