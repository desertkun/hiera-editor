import {ipc} from "../ipc/client";

import {Dictionary} from "../dictionary";

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;
const storage = require('electron-json-storage');

let renderer: WorkspaceRenderer;

class NodeRenderer
{
    private name: string;

    private readonly n_parent: any;
    private n_node: any;

    constructor(name: string, parentNode: any)
    {
        this.name = name;
        this.n_parent = parentNode;
        this.render();
    }

    private headerClick()
    {
        const i = $(this).find('.workspace-node-text');

        i.addClass('workspace-node-selected');
    }


    private render()
    {
        this.n_node = $('<div class="workspace-node"></div>').appendTo(this.n_parent).click(this.headerClick);
        const header = $('<span class="workspace-node-text"><i class="fa fa-server"></i> ' +
            this.name + '</span>').appendTo(this.n_node);
    }
}

class FolderRenderer
{
    private nodes: Dictionary<string, NodeRenderer>;
    private folders: Dictionary<string, FolderRenderer>;
    private name: string;
    private root: boolean;

    private n_folder: any;
    private readonly n_parent: any;
    private n_nodes: any;

    constructor(name: string, parentNode: any, root: boolean)
    {
        this.name = name;
        this.nodes = new Dictionary();
        this.folders = new Dictionary();
        this.root = root;

        this.n_parent = parentNode;

        this.render();
    }

    private headerClick()
    {
        const entry = $(this).parent();
        const i = $(this).children('span.collapse-icon').children('i');

        if (entry.hasClass('workspace-folder-opened'))
        {
            i.removeClass().addClass('fa fa-angle-right');
            entry.removeClass('workspace-folder-opened');
            entry.children('.workspace-nodes').hide();
        }
        else
        {
            i.removeClass().addClass('fa fa-angle-down');
            entry.addClass('workspace-folder-opened');
            entry.children('.workspace-nodes').show();
        }
    }

    private render()
    {
        if (this.root)
        {
            this.n_nodes = this.n_parent;
        }
        else
        {
            this.n_folder = $('<div class="workspace-folder"></div>').appendTo(this.n_parent);

            const header = $('<div class="workspace-folder-header"></div>').
                appendTo(this.n_folder).click(this.headerClick);

            const title = $('<span class="collapse-icon"><i class="fa fa-angle-right"></i></span>' +
                '<span class="workspace-folder-text"><i class="fa fa-folder"></i> ' +
                this.name + '</span>').appendTo(header);

            //$('<span class="workspace-environment-button"><i class="fas fa-plus"></i></span>').appendTo(header);

            this.n_nodes = $('<div class="workspace-nodes" style="display: none;"></div>').appendTo(this.n_folder);

            $('<div class="workspace-nodes-empty">' +
                '<span class="text text-muted">No nodes</span></div>').appendTo(this.n_nodes);
        }

    }

    public addNode(name: string): NodeRenderer
    {
        const node = new NodeRenderer(name, this.n_nodes);
        this.nodes.put(name, node);
        return node;
    }

    public addFolder(name: string): FolderRenderer
    {
        const folder = new FolderRenderer(name, this.n_nodes, false);
        this.folders.put(name, folder);
        return folder;
    }

    public async populate(tree: any)
    {
        for (const folderEntry of tree.folders)
        {
            const name: string = folderEntry.name;
            const folder: FolderRenderer = this.addFolder(name);
            await folder.populate(folderEntry);
        }

        for (const nodeName of tree.nodes)
        {
            this.addNode(nodeName);
        }
    }
}

class EnvironmentRenderer
{
    private root: FolderRenderer;
    private name: string;

    private n_environment: any;
    private readonly n_parent: any;
    private n_nodes: any;

    constructor(name: string, parentNode: any)
    {
        this.name = name;

        this.n_parent = parentNode;

        this.render();

        this.root = new FolderRenderer("root", this.n_nodes, true);

        this.init();
    }

    private headerClick()
    {
        const entry = $(this).parent();
        const i = $(this).children('span.collapse-icon').children('i');

        if (entry.hasClass('workspace-environment-opened'))
        {
            i.removeClass().addClass('fa fa-angle-right');
            entry.removeClass('workspace-environment-opened');
            entry.children('.workspace-nodes').hide();
        }
        else
        {
            i.removeClass().addClass('fa fa-angle-down');
            entry.addClass('workspace-environment-opened');
            entry.children('.workspace-nodes').show();
        }
    }

    private render()
    {
        this.n_environment = $('<div class="workspace-environment" id="environment-' + this.name +
            '"></div>').appendTo(this.n_parent);

        const header = $('<div class="workspace-environment-header"></div>').
            appendTo(this.n_environment).click(this.headerClick);
        const title = $('<span class="collapse-icon"><i class="fa fa-angle-right"></i></span>' +
            '<span class="workspace-environment-text"><i class="ic ic-environment"></i> ' +
            this.name + '</span>').appendTo(header);
        $('<span class="workspace-environment-button"><i class="fas fa-plus"></i></span>').appendTo(header);

        this.n_nodes = $('<div class="workspace-nodes" style="display: none;"></div>').appendTo(this.n_environment);

        $('<div class="workspace-nodes-empty">' +
            '<span class="text text-muted">No nodes</span></div>').appendTo(this.n_nodes);
    }

    private async init()
    {
        const tree = await ipc.getEnvironmentTree(this.name);
        await this.root.populate(tree);
    }
}

class WorkspaceRenderer
{
    settingsTimer: NodeJS.Timer;
    environments: Dictionary<string, EnvironmentRenderer>;

    n_workspace: any;

    constructor()
    {
        this.init();

        this.environments = new Dictionary();
    }

    private async init()
    {
        this.initSidebar();

        const path: string = await ipc.getCurrentWorkspacePath();

        if (path != null)
        {
            document.title = ellipsis(path, 80, {side: 'start'});
        }

        this.n_workspace = $('#workspace');

        const environments: string[] = await ipc.getEnvironmentList();

        for (const environment of environments)
        {
            this.addEnvironment(environment);
        }
    }

    public addEnvironment(name: string): EnvironmentRenderer
    {
        const environment = new EnvironmentRenderer(name, this.n_workspace);
        this.environments.put(name, environment);
        return environment;
    }

    private initSidebar()
    {
        const sidebarMin = 200;
        const sidebarMax = 3600;
        const contentsMin = 200;

        const sideBar = $('.workspace-sidebar');
        const zis = this;

        storage.get('workspace-window-settings', function(error: any, data: any)
        {
            if (!error)
            {
                const x: any = data["x"];
                WorkspaceRenderer.applyWorkspaceSettings(x);
            }

            // noinspection TypeScriptValidateJSTypes
            $('.split-bar').mousedown(function (e: MouseEvent)
            {
                e.preventDefault();

                // noinspection TypeScriptValidateJSTypes
                $(document).mousemove(function (e: MouseEvent)
                {
                    e.preventDefault();

                    const x = e.pageX - sideBar.offset().left;
                    if (x > sidebarMin && x < sidebarMax && e.pageX < ($(window).width() - contentsMin))
                    {
                        WorkspaceRenderer.applyWorkspaceSettings(x);
                        zis.saveWorkspaceSettings(x);
                    }
                })
            });

            // noinspection TypeScriptValidateJSTypes
            $(document).mouseup(function (e: MouseEvent) {
                $(document).unbind('mousemove');
            });
        });
    }

    private static applyWorkspaceSettings(x: any)
    {
        $('.workspace-sidebar').css("width", x);
        $('.workspace-contents').css("margin-left", x);
    }

    private saveWorkspaceSettings(x: any)
    {
        if (this.settingsTimer)
        {
            clearTimeout(this.settingsTimer);
        }

        this.settingsTimer = setTimeout(() =>
        {
            storage.set('workspace-window-settings', {
                "x": x
            });
        }, 1000);
    }
}

// @ts-ignore
window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
};

$(() =>
{
    renderer = new WorkspaceRenderer();
});
