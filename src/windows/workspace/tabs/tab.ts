import {WorkspaceRenderer} from "../renderer";

const $ = require("jquery");

export type WorkspaceTabConstructor = new (path: Array<string>, button_node: any, content_node: any,
                                           renderer: WorkspaceRenderer) => WorkspaceTab;

export abstract class WorkspaceTab
{
    private readonly _path: Array<string>;
    private readonly _buttonNode: any;
    private readonly _contentNode: any;
    private readonly _renderer: WorkspaceRenderer;

    public constructor(path: Array<string>, buttonNode: any, contentNode: any, renderer: WorkspaceRenderer)
    {
        this._path = path;
        this._buttonNode = buttonNode;
        this._contentNode = contentNode;
        this._renderer = renderer;
    }

    public get path(): Array<string>
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

    public get renderer(): WorkspaceRenderer
    {
        return this._renderer;
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
    
    public async focusIn(): Promise<void>
    {
    }

    public async refresh(): Promise<void>
    {
        const scroll = $(this.contentNode).parent().scrollTop();
        $(this.contentNode).html('');
        await this.release();
        await this.init();
        this.render();
        $(this.contentNode).parent().scrollTop(scroll);
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