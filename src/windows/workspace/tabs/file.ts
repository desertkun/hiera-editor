import { IPC } from "../../../ipc/client";
import {Dictionary} from "../../../dictionary";
import {WorkspaceTab} from "./tab";
import {WorkspaceRenderer} from "../renderer";

const ipc = IPC();

const $ = require("jquery");

class ClassRenderer
{
    private _name: string;
    private _fullName: string;

    constructor(name: string, fullName: string)
    {
        this._name = name;
        this._fullName = fullName;
    }

    public get name()
    {
        return this._name;
    }

    public get humanName()
    {
        return this._name.replace(/_/g, " ").replace(/\w\S*/g, function(txt){
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    }

    public get fullName()
    {
        return this._fullName;
    }
}

class ClassGroupRenderer
{
    private readonly name: string;
    private child: Dictionary<string, ClassGroupRenderer>;

    private tab: FileTab;
    private parent: ClassGroupRenderer;
    private classes: Array<ClassRenderer>;

    private n_classes: any;
    private n_node: any;

    constructor(name: string, tab: FileTab, parent: ClassGroupRenderer = null)
    {
        this.name = name;
        this.child = new Dictionary();
        this.tab = tab;
        this.parent = parent;
        this.classes = [];
    }

    private acquireGroup(name: string)
    {
        if (this.child.has(name))
        {
            return this.child.get(name);
        }

        const newGroup = new ClassGroupRenderer(name, this.tab, this);
        this.child.put(name, newGroup);
        return newGroup;
    }

    public addClass(clazz: ClassRenderer)
    {
        const sp = clazz.name.split("::");

        if (sp.length > 1)
        {
            const groupName = sp[0];
            sp.splice(0, 1);
            const group = this.acquireGroup(groupName);
            group.addClass(new ClassRenderer(sp.join("::"), clazz.fullName));
            return
        }

        this.classes.push(clazz);
    }

    public isRoot(): boolean
    {
        return this.name == "";
    }

    public get humanName(): string
    {
        if (this.parent != null && !this.parent.isRoot())
        {
            return this.parent.humanName + "/" + this.name;
        }

        return this.name;
    }

    public render(rows: any)
    {
        if (this.name == "")
        {
            this.n_node = rows;
        }
        else
        {
            this.n_node = $('<div class="class-group"></div>').appendTo(rows);
            const header = $('<h4><i class="far fa-folder"></i> ' + this.humanName + '</h4>').appendTo(this.n_node);
        }

        const n_entries = $('<div class="class-group-entries"></div>').appendTo(this.n_node);

        this.classes.sort((a: ClassRenderer, b: ClassRenderer) => {
            return a.name.localeCompare(b.name);
        });

        for (const clazz of this.classes)
        {
            const classInfo = this.tab.classInfo.classes[clazz.fullName];

            if (classInfo == null)
                continue;

            const entry = $('<div class="node-entry"></div>').appendTo(n_entries);
            const btn = $('<a href="#" class="node-entry-btn btn btn-sm">' +
                clazz.humanName + '</a>').appendTo(entry).click(async () =>
            {
                const result = await this.tab.renderer.openTab("class", [this.tab.nodePath, clazz.fullName]);
            });

            const iconData = classInfo.options.icon;
            if (iconData != null)
            {
                $('<img class="node-entry-icon" src="' + iconData + '" style="width: 16px; height: 16px;">').prependTo(btn);
            }
            else
            {
                $('<i class="node-entry-icon fas fa-puzzle-piece"></i>').prependTo(btn);
            }

            $('<span class="node-entry-class-name">' + clazz.fullName + '</span>').appendTo(entry);
            $('<span class="node-entry-description">' + classInfo.description + '</span>').appendTo(entry);
        }

        const n_groups = $('<div class="class-group-subgroups"></div>').appendTo(this.n_node);

        const keys = this.child.getKeys();
        keys.sort();
        for (const key of keys)
        {
            const group = this.child.get(key);
            group.render(n_groups);
        }
    }
}

export class FileTab extends WorkspaceTab
{
    private info: any;
    private _classInfo: any;
    private _rows: any;
    private root: ClassGroupRenderer;

    public constructor(path: Array<string>, buttonNode: any, contentNode: any, renderer: WorkspaceRenderer)
    {
        super(path, buttonNode, contentNode, renderer);

        this.root = new ClassGroupRenderer("", this);
    }

    public get rows(): any
    {
        return this._rows;
    }

    public get classInfo()
    {
        return this._classInfo
    }

    public get nodePath()
    {
        return this.path[0];
    }

    public async init(): Promise<any>
    {
        this.info = await ipc.findFile(this.nodePath);
        this._classInfo = await ipc.getClassInfo(this.info.env);

        for (const className of this.info.classes)
        {
            this.root.addClass(new ClassRenderer(className, className));
        }
    }

    public async release(): Promise<any>
    {

    }

    public getIcon(): any
    {
        return $('<i class="fa fa-server"></i>');
    }

    public render(): any
    {
        this._rows = $('<div class="w-100"></div>').appendTo(this.contentNode);

        this.root.render(this.rows);
    }

    public get fullTitle(): string
    {
        return this.nodePath;
    }

    public get shortTitle(): string
    {
        const p = this.nodePath.split("/");
        return p[p.length - 1];
    }
}
