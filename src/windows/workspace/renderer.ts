import {ipc} from "../../ipc/client";

import {Dictionary} from "../../dictionary";

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;
const electron = require('electron');
const storage = require('electron-json-storage');

import {NodeTab} from "./tabs/node"
import {WorkspaceTab, WorkspaceTabConstructor} from "./tabs/tab";
import {puppet} from "../../puppet";
import {DefaultTab} from "./tabs/default";

let renderer: WorkspaceRenderer;
let selectedNode: any = null;

class NodeTreeItemRenderer
{
    private name: string;
    private path: string;
    private localPath: string;

    private readonly n_parent: any;
    private n_node: any;
    private n_header: any;

    constructor(name: string, path: string, localPath: string, parentNode: any)
    {
        this.name = name;
        this.path = path;
        this.localPath = localPath;
        this.n_parent = parentNode;
        this.render();
    }

    private render()
    {
        const zis = this;

        this.n_node = $('<div class="workspace-node"></div>').appendTo(this.n_parent).click(() =>
        {
            if (selectedNode)
            {
                selectedNode.removeClass('workspace-node-selected');
            }

            selectedNode = zis.n_header;
            selectedNode.addClass('workspace-node-selected');

            renderer.openTab("node:" + zis.localPath);
        });

        this.n_header = $('<span class="workspace-node-text"><i class="fa fa-server"></i> ' +
            this.name + '</span>').appendTo(this.n_node);
    }
}

class FolderTreeItemRenderer
{
    private nodes: Dictionary<string, NodeTreeItemRenderer>;
    private folders: Dictionary<string, FolderTreeItemRenderer>;
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

    public addNode(name: string, path: string, localPath: string): NodeTreeItemRenderer
    {
        const node = new NodeTreeItemRenderer(name, path, localPath, this.n_nodes);
        this.nodes.put(name, node);
        return node;
    }

    public addFolder(name: string): FolderTreeItemRenderer
    {
        const folder = new FolderTreeItemRenderer(name, this.n_nodes, false);
        this.folders.put(name, folder);
        return folder;
    }

    public async populate(tree: any)
    {
        for (const folderEntry of tree.folders)
        {
            const name: string = folderEntry.name;
            const folder: FolderTreeItemRenderer = this.addFolder(name);
            await folder.populate(folderEntry);
        }

        for (const nodeEntry of tree.nodes)
        {
            this.addNode(nodeEntry.name, nodeEntry.path, nodeEntry.localPath);
        }
    }
}

class EnvironmentTreeItemRenderer
{
    private root: FolderTreeItemRenderer;
    private name: string;

    private n_environment: any;
    private readonly n_parent: any;
    private n_nodes: any;

    constructor(name: string, parentNode: any)
    {
        this.name = name;

        this.n_parent = parentNode;

        this.render();

        this.root = new FolderTreeItemRenderer("root", this.n_nodes, true);

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
        electron.ipcRenderer.on('refresh-workspace-category', function(event: any, text: number)
        {
            $('#loading-category').text(text);
        });

        electron.ipcRenderer.on('refresh-workspace-progress', function(event: any, progress: number)
        {
            const p = Math.floor(progress * 100);
            $('#loading-progress').css('width', "" + p + "%");
        });

        const tree = await ipc.getEnvironmentTree(this.name);
        await this.root.populate(tree);
    }
}

class WorkspaceRenderer
{
    settingsTimer: NodeJS.Timer;
    environments: Dictionary<string, EnvironmentTreeItemRenderer>;
    tabs: Dictionary<string, WorkspaceTab>;

    private readonly tabClasses: Dictionary<string, WorkspaceTabConstructor>;
    n_editorTabs: any;
    n_editorContent: any;
    n_workspace: any;

    constructor()
    {
        this.init();

        this.environments = new Dictionary();
        this.tabs = new Dictionary();

        this.tabClasses = new Dictionary();
        this.tabClasses.put("node", NodeTab);
        this.tabClasses.put("default", DefaultTab);
    }

    private async init()
    {
        this.initSidebar();

        WorkspaceRenderer.OpenLoading();

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

        await ipc.refreshWorkspace();

        await this.enable();
    }

    public addEnvironment(name: string): EnvironmentTreeItemRenderer
    {
        const environment = new EnvironmentTreeItemRenderer(name, this.n_workspace);
        this.environments.put(name, environment);
        return environment;
    }

    private static OpenLoading()
    {
        $('#workspace-contents').html('<div class="vertical-center h-100"><div><p class="text-center">' +
            '<span class="text text-muted"><i class="fas fa-cog fa-4x fa-spin"></i></span></p>' +
            '<p class="text-center"><span class="text text-muted" id="loading-category">' +
            'Please wait while the workspace is updating cache</span></p>' +
            '<p class="text-center"><div class="progress" style="width: 300px;">' +
            '<div class="progress-bar progress-bar-striped progress-bar-animated" ' +
            'id="loading-progress" role="progressbar" aria-valuenow="0" ' +
            'aria-valuemin="0" aria-valuemax="100" style="width:0">' +
            '</div></div></p></div></div>');
    }

    private openEditor()
    {
        const root = $('#workspace-contents');
        root.html('');
        const contents = $('<div class="h-100 h-100" style="display: flex; overflow: hidden; ' +
            'flex-direction: column;"></div>').appendTo(root);

        this.n_editorTabs = $('<ul class="nav nav-tabs compact" role="tablist"></ul>').appendTo(contents);
        this.n_editorContent = $('<div class="tab-content w-100 h-100" style="overflow-y: auto;"></div>').appendTo(contents);
    }

    private async checkEmpty()
    {
        const keys = this.tabs.getKeys();
        if (keys.length == 0)
        {
            await this.openTab("default:");
        }
        else if (keys.length > 0)
        {
            const hasDefault = keys.indexOf("default:") >= 0;

            if (hasDefault && keys.length > 1)
            {
                await this.closeTab("default:");
            }
        }
    }

    public async openTab(path: string): Promise<any>
    {
        if (this.tabs.has(path))
        {
            const tab = this.tabs.get(path);

            $(tab.buttonNode).find('a').tab('show');
            return;
        }

        const split = path.split(":");
        if (split.length != 2)
            return;

        const fixedPath = split.join("_");

        const _className = split[0];
        const _path = split[1];

        const _class: WorkspaceTabConstructor = this.tabClasses.get(_className);
        if (!_class)
            return;

        const tabButton = $('<li class="nav-item">' +
            '<a class="nav-link" id="' + fixedPath + '-tab" data-toggle="tab" href="#' + fixedPath + '" ' +
            'role="tab" aria-controls="' + fixedPath + '" aria-selected="false"></a>' +
            '</li>').appendTo(this.n_editorTabs);

        const tabContents = $('<div class="tab-pane h-100" id="' + fixedPath +
            '" role="tabpanel" aria-labelledby="' + fixedPath + '-tab">' +
            '</div>').appendTo(this.n_editorContent);

        const _tab = new _class(_path, tabButton, tabContents);

        await _tab.init();
        _tab.render();
        const _a = $(tabButton).find('a');

        const _icon = _tab.getIcon();
        if (_icon)
        {
            _icon.addClass('tab-icon').appendTo(_a);
        }

        const shortTitle = _tab.shortTitle;
        let foundOtherTabWithSameTitle = false;

        for (const otherTab of this.tabs.getValues())
        {
            if (otherTab.shortTitle == shortTitle)
            {
                otherTab.changeTitle(otherTab.fullTitle);
                foundOtherTabWithSameTitle = true;
                break;
            }
        }

        $('<span>' + (foundOtherTabWithSameTitle ? _tab.fullTitle : _tab.shortTitle) + '</span>').appendTo(_a);

        if (_tab.canBeClosed)
        {
            const _i = $('<i class="fas fa-times close-btn"></i>').appendTo(_a).click(() => {
                this.closeTab(path);
            });
        }

        _a.tab('show');

        this.tabs.put(path, _tab);

        await this.checkEmpty();
    }

    public async closeTab(path: string): Promise<any>
    {
        if (!this.tabs.has(path))
            return;

        const tab = this.tabs.get(path);
        await tab.release();

        const btn = tab.buttonNode;

        if (btn.prev().length)
        {
            btn.prev().find('a').tab('show');
        }
        else if (btn.next().length)
        {
            btn.next().find('a').tab('show');
        }

        btn.remove();
        tab.contentNode.remove();

        const shortTitle = tab.shortTitle;
        let cnt = 0;
        let otherFoundTab = null;

        this.tabs.remove(path);

        for (const otherTab of this.tabs.getValues())
        {
            if (otherTab.shortTitle == shortTitle)
            {
                cnt++;
                otherFoundTab = otherTab;
            }
        }

        if (cnt == 1)
        {
            otherFoundTab.changeTitle(otherFoundTab.shortTitle);
        }

        await this.checkEmpty();
    }

    private async enable()
    {
        $('#workspace').removeClass('disabled');
        this.openEditor();
        await this.checkEmpty();
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
            $('.split-bar').mousedown(function (e: any)
            {
                e.preventDefault();

                $('#workspace-panel').addClass('workspace-frame-dragging');

                const move = function (e: any)
                {
                    e.preventDefault();

                    const x = e.pageX - sideBar.offset().left;
                    if (x > sidebarMin && x < sidebarMax && e.pageX < ($(window).width() - contentsMin))
                    {
                        WorkspaceRenderer.applyWorkspaceSettings(x);
                        zis.saveWorkspaceSettings(x);
                    }
                };

                // noinspection TypeScriptValidateJSTypes
                $(document).on('mousemove', move).mouseup(function (e: any)
                {
                    $('#workspace-panel').removeClass('workspace-frame-dragging');
                    $(document).unbind('mousemove', move);
                });
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
