const {remote} = require('electron')
const {Menu, MenuItem} = remote;

const $ = require("jquery");


export type TreeViewSetupNodeCallback = (node: TreeViewNode) => void;
export type TreeViewSelectedCallback = (node: TreeViewNode) => void;

export class TreeViewNode
{
    private element: any;
    private childsElement: any;
    private readonly childs: any;
    private readonly view: TreeView;
    private clickEvent: any;
    private header: any;
    private _contextMenu: any;
    
    private root: boolean;

    private _emptyText: string;
    private _title: string;
    private _icon: any;
    private _bold: boolean;
    private _leaf: boolean;
    private _selectable: boolean;
    private _collapsed: boolean;
    private _onSelect: TreeViewSelectedCallback;

    constructor(view: TreeView)
    {
        this.view = view;

        this.childs = {};
        this._emptyText = "No entries";
        this._title = "???";
        this._bold = false;
        this._leaf = false;
        this._selectable = false;
        this._collapsed = true;
        this._icon = null;
    }

    public set emptyText(value: string)
    {
        this._emptyText = value;
    }

    public set selectable(value: boolean)
    {
        this._selectable = value;
    }
    
    public set collapsed(value: boolean)
    {
        this._collapsed = value;
    }

    public set onSelect(callback: TreeViewSelectedCallback)
    {
        this._onSelect = callback;
    }
    
    public set icon(value: any)
    {
        this._icon = value;
    }

    public set title(value: string)
    {
        this._title = value;
    }

    public set bold(value: boolean)
    {
        this._bold = value;
    }

    public set leaf(value: boolean)
    {
        this._leaf = value;
    }

    private selectableHandler()
    {
        this.view.selectNode(this.header);

        if (this._onSelect)
        {
            this._onSelect(this);
        }
    }

    private collapseHandler()
    {
        const i = this.header.children('span.treeview-collapse-icon').children('i');

        if (this.element.hasClass('treeview-node-opened'))
        {
            i.removeClass().addClass('fa fa-angle-right');
            this.element.removeClass('treeview-node-opened');
            this.element.children('.treeview-node-childs').hide();
        }
        else
        {
            i.removeClass().addClass('fa fa-angle-down');
            this.element.addClass('treeview-node-opened');
            this.element.children('.treeview-node-childs').show();
        }

        // 
    }

    public contextMenu(entries: Array<any>): void
    {
        const zis = this;
        this._contextMenu = new Menu();

        for (const entry of entries)
        {
            const item = new MenuItem(entry);
            this._contextMenu.append(item);
        }

        this.header.on("contextmenu", (event: any) => 
        {
            event.preventDefault();
            zis._contextMenu.popup({window: remote.getCurrentWindow()})
        });
    }

    public click(callback: any): any
    {
        return this.element.click(callback);
    }

    public setParent(parent: TreeViewNode, id?: string)
    {
        this.root = false;
        const zis = this;
        const container = parent.childsElement;

        this.element = $('<div class="treeview-node"></div>').appendTo(container);

        if (id)
        {
            this.element.attr('id', id);
        }
        
        if (!parent.root)
        {
            this.element.addClass("treeview-node-child");
        }
        
        this.header = $('<div class="treeview-node-header"></div>').
            appendTo(this.element);

        if (this._selectable)
        {
            this.header.click(() => 
            {
                zis.selectableHandler.apply(zis, []);
            });
        }

        if (!this._leaf)
        {
            const collapseIcon = $('<span class="treeview-collapse-icon"></span>').appendTo(this.header);

            if (this._collapsed)
            {
                $('<i class="fa fa-angle-right"></i>').appendTo(collapseIcon);
            }
            else
            {
                this.element.addClass("treeview-node-opened");
                $('<i class="fa fa-angle-down"></i>').appendTo(collapseIcon);
            }

            this.header.click(() => 
            {
                zis.collapseHandler.apply(zis, []);
            });
        }

        const text = $('<span class="treeview-node-text"></span>').appendTo(this.header);

        if (this._bold)
        {
            text.addClass('treeview-node-text-bold');
        }
        
        if (this._icon)
        {
            this._icon.appendTo(text);
        }

        text.append(this._title);

        this.childsElement = $('<div class="treeview-node-childs"></div>').appendTo(this.element);

        if (this._collapsed)
        {
            this.childsElement.css("display", "none");
        }

        $('<div class="treeview-node-childs-empty">' +
            '<span class="text text-muted">' + this._emptyText + '</span></div>').appendTo(this.childsElement);
    }

    public setAsRoot(element: any)
    {
        this.root = true;
        this.childsElement = element;
        this.element = null;
    }

    public addChild(setup: TreeViewSetupNodeCallback, id?: string): TreeViewNode
    {
        const child = new TreeViewNode(this.view);
        setup(child);
        child.setParent(this, id);

        if (id)
        {
            this.childs[id] = child;
        }

        return child;
    }
}

export class TreeView
{
    private readonly element: any;
    private readonly _root: TreeViewNode;
    private selectedNode: any;

    constructor(element: any)
    {
        this.element = element;
        this._root = new TreeViewNode(this);
        this._root.setAsRoot(element);
    }

    public clear()
    {
        this.element.html('');
    }

    public get root(): TreeViewNode
    {
        return this._root;
    }

    public selectNode(node: any)
    {
        if (this.selectedNode)
        {
            this.selectedNode.removeClass('treeview-node-selected');
        }

        this.selectedNode = node;
        this.selectedNode.addClass('treeview-node-selected');
    }
}