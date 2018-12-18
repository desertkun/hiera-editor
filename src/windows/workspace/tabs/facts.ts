import { IPC } from "../../../ipc/client";
import {WorkspaceTab} from "./tab";
import {WorkspaceRenderer} from "../renderer";

const ipc = IPC();

const JSONEditor = require("jsoneditor");
const $ = require("jquery");

export class FactsTab extends WorkspaceTab 
{
    private nodePath: string;
    private facts: any;

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
        const container = $('<div class="flex-container h-100"></div>').appendTo(this.contentNode);

        const notice = $('<div class="flex-item container-w-padding"></div>').appendTo(container);

        $('<h3><i class="fas fa-bars"></i> Facts for node ' + this.nodePath + '</h3>').appendTo(notice);
        $('<span class="text-muted">This page can configure fake facts for this node, thus allowing to resolve ' +
            'defaults correctly. Addting a variable with name \"hostname\" will implement the ${hostname} variable ' +
            'in Puppet accordingly.</span>').appendTo(notice);

        const factsEditor = $('<div>').appendTo(this.contentNode);
        
        new JSONEditor(factsEditor[0], {
            modes: ['tree', 'code'],
            onChangeJSON: () => 
            {
                //changed(editor.get());
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