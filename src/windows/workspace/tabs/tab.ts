
const $ = require("jquery");

export type WorkspaceTabConstructor = new (path: string, button_node: any, content_node: any) => WorkspaceTab;

export abstract class WorkspaceTab
{
    private readonly _path: string;
    private readonly _buttonNode: any;
    private readonly _contentNode: any;

    public constructor(path: string, buttonNode: any, contentNode: any)
    {
        this._path = path;
        this._buttonNode = buttonNode;
        this._contentNode = contentNode;
    }

    public get path(): string
    {
        return this._path;
    }

    public get buttonNode(): any
    {
        return this._buttonNode;
    }

    public get contentNode(): any
    {
        return this._contentNode;
    }

    public get canBeClosed()
    {
        return true;
    }

    public getIcon(): any
    {
        return null;
    }

    public changeTitle(title: string): any
    {
        $(this.buttonNode).find('a span').html(title);
    }

    public abstract async init(): Promise<any>;
    public abstract async release(): Promise<any>;
    public get fullTitle(): string
    {
        return this.shortTitle;
    }
    public abstract get shortTitle(): string;
    public abstract render(): any;
}