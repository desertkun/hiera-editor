
import {WorkspaceTab} from "./tab";

const $ = require("jquery");

export class DefaultTab extends WorkspaceTab {
    async init(): Promise<any>
    {
    }

    async release(): Promise<any>
    {
    }

    render(): any
    {
        $('<div class="vertical-center h-100"><div class="justify-content-center"><p class="text-center">' +
            '<img src="../images/editor.png" width="128" height="128"></p>' +
            '<p class="text-center"><span class="text text-muted">' +
            'Please select an item to display its properties\n' +
            '</span></p></div></div>').appendTo(this.contentNode);
    }

    public get canBeClosed()
    {
        return false;
    }

    public getIcon(): any
    {
        return $('<i class="ic ic-environment"></i>');
    }

    get shortTitle(): string
    {
        return "Welcome";
    }

}