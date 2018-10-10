import {ipc} from "../ipc/client";
import {Dictionary} from "../dictionary";

const $ = require("jquery");

let renderer: NodeRenderer;

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

    private node: NodeRenderer;
    private parent: ClassGroupRenderer;
    private classes: Array<ClassRenderer>;

    private n_classes: any;
    private n_node: any;

    constructor(name: string, node: NodeRenderer, parent: ClassGroupRenderer = null)
    {
        this.name = name;
        this.child = new Dictionary();
        this.node = node;
        this.parent = parent;
        this.classes = [];
    }

    private acquireGroup(name: string)
    {
        if (this.child.has(name))
        {
            return this.child.get(name);
        }

        const newGroup = new ClassGroupRenderer(name, this.node, this);
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

        const n_classes = $('<table class="table table-borderless table-sm class-group-entries"></table>').appendTo(this.n_node);
        const n_entries = $('<tbody></tbody>').appendTo(n_classes);

        this.classes.sort((a: ClassRenderer, b: ClassRenderer) => {
            return a.name.localeCompare(b.name);
        });

        for (const clazz of this.classes)
        {
            const entry = $('<tr></tr>').appendTo(n_entries);

            {
                const name = $('<td class="node-entry-header"></td>').appendTo(entry);

                const defaultIcon = $('<span class="node-entry-icon">' +
                    '<i class="fas fa-puzzle-piece"></i></span>').appendTo(name);
                const link = $('<a href="#" class="nav-link btn-sm">' + clazz.humanName + '</a>').appendTo(name);
            }

            {
                const className = $('<td class="node-entry-class-name">' +  clazz.fullName + '</td>').appendTo(entry);

            }
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

class NodeRenderer
{
    private readonly nodePath: string;
    private info: any;
    private window: Window;
    private root: ClassGroupRenderer;

    constructor(window: Window, nodePath: string)
    {
        this.nodePath = nodePath;
        this.window = window;
        this.root = new ClassGroupRenderer("", this);

        this.init();
    }

    public get rows(): any
    {
        return $(this.window.document).find('#class-list');
    }

    private clear()
    {
        this.rows.empty();
    }

    private async init()
    {
        this.info = await ipc.findNode(this.nodePath);

        for (const className of this.info["classes"])
        {
            this.root.addClass(new ClassRenderer(className, className));
        }

        this.render();
    }

    private render()
    {
        this.clear();

        this.root.render(this.rows);
    }
}

export async function setup(window: Window, data: any)
{
    renderer = new NodeRenderer(window, data.node);
}
