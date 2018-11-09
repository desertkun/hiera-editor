import {ipc} from "../../ipc/client";

import {Dictionary} from "../../dictionary";

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;
const electron = require('electron');
const storage = require('electron-json-storage');

import {NodeTab} from "./tabs/node"
import {WorkspaceTab, WorkspaceTabConstructor} from "./tabs/tab";
import {DefaultTab} from "./tabs/default";
import {NodeClassTab} from "./tabs/class";

import {puppet} from "../../puppet";
import {TreeView, TreeViewNode} from "./treeview";

let renderer: WorkspaceRenderer;
let selectedNode: any = null;

class NodeTreeItemRenderer
{
    private renderer: WorkspaceRenderer;
    private name: string;
    private path: string;
    private localPath: string;
    private info: any;
    private classInfo: any;

    private readonly n_parent: TreeViewNode;
    private n_node: TreeViewNode;

    constructor(renderer: WorkspaceRenderer, 
        name: string, path: string, localPath: string, parentNode: TreeViewNode)
    {
        this.renderer = renderer;
        this.name = name;
        this.path = path;
        this.localPath = localPath;
        this.n_parent = parentNode;
    }

    public async init()
    {
        this.info = await ipc.findNode(this.localPath);
        this.classInfo = await renderer.getClassInfo(this.info.env);
        this.render();
    }

    private renderClasses(node: TreeViewNode, parentClassPath: string): boolean
    {
        const zis = this;
        let hadAny: boolean = false;

        for (const className of this.info.classes)
        {
            const classInfo = this.classInfo.classes[className];

            const classPath: Array<string> = className.split("::");
            const name = classPath[classPath.length - 1];
            classPath.splice(classPath.length - 1, 1);
            const parentName = classPath.join("::");

            //if (parentClassPath != null && parentName != parentClassPath)
            //    continue;

            console.log(className);

            const iconData = classInfo.options.icon;

            const classNode = node.addChild( 
                (node) => 
            {
                if (iconData != null)
                {
                    node.icon = $('<img class="node-entry-icon" src="' + iconData + 
                        '" style="width: 16px; height: 16px;">');
                }
                else
                {
                    node.icon = $('<i class="node-entry-icon fas fa-puzzle-piece"></i>');
                }

                node.title = className;
                node.leaf = true;
                node.selectable = (node) => {
                    renderer.openTab("class", [zis.localPath, className]);
                };
            });

            hadAny = true;
        }

        return hadAny;
    }

    private render()
    {
        const zis = this;

        this.n_node = this.n_parent.addChild( 
            (node) => 
        {
            node.icon = $('<i class="fa fa-server"></i>');
            node.title = zis.name;
            node.selectable = (node) => {
                renderer.openTab("node", [zis.localPath]);
            };
        });

        const n_classes = this.n_node.addChild( 
            (node) => 
        {
            node.icon = $('<i class="fas fa-puzzle-piece"></i>');
            node.title = "Classes";
            node.emptyText = "Node has no classes";
            node.leaf = false;
            node.selectable = (node) => {
                //renderer.openTab("class", [this.tab.nodePath, clazz.fullName]);
            };
        });

        this.renderClasses(n_classes, null);

        const n_resources = this.n_node.addChild( 
            (node) => 
        {
            node.icon = $('<i class="far fa-clone"></i>');
            node.title = "Resources";
            node.emptyText = "Node has no resources";
            node.leaf = false;
            node.selectable = (node) => {
                //renderer.openTab("class", [this.tab.nodePath, clazz.fullName]);
            };
        });
    }
}

class FolderTreeItemRenderer
{
    private renderer: WorkspaceRenderer;
    private nodes: Dictionary<string, NodeTreeItemRenderer>;
    private folders: Dictionary<string, FolderTreeItemRenderer>;
    private name: string;
    private root: boolean;

    private readonly n_parent: TreeViewNode;
    private n_nodes: TreeViewNode;

    constructor(renderer: WorkspaceRenderer, name: string, parentNode: TreeViewNode, root: boolean)
    {
        this.renderer = renderer;
        this.name = name;
        this.nodes = new Dictionary();
        this.folders = new Dictionary();
        this.root = root;

        this.n_parent = parentNode;

        this.render();
    }

    private render()
    {
        if (this.root)
        {
            this.n_nodes = this.n_parent;
        }
        else
        {
            const zis = this;

            this.n_nodes = this.n_parent.addChild( 
                (node) => {
                    node.title = zis.name;
                    node.icon = $('<i class="fa fa-folder"></i>');
                });
        }
    }

    public addNode(name: string, path: string, localPath: string): NodeTreeItemRenderer
    {
        const node = new NodeTreeItemRenderer(this.renderer, name, path, localPath, this.n_nodes);
        this.nodes.put(name, node);
        return node;
    }

    public addFolder(name: string): FolderTreeItemRenderer
    {
        const folder = new FolderTreeItemRenderer(this.renderer, name, this.n_nodes, false);
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
            const node = this.addNode(nodeEntry.name, nodeEntry.path, nodeEntry.localPath);
            await node.init();
        }
    }
}

class EnvironmentTreeItemRenderer
{
    private renderer: WorkspaceRenderer;
    private root: FolderTreeItemRenderer;
    private name: string;

    private n_environment: TreeViewNode;
    private readonly n_treeView: TreeViewNode;

    constructor(renderer: WorkspaceRenderer, name: string, treeView: TreeViewNode)
    {
        this.renderer = renderer;
        this.name = name;

        this.n_treeView = treeView;

        this.render();
        this.root = new FolderTreeItemRenderer(renderer, "root", this.n_environment, true);
    }

    private render()
    {
        const zis = this;

        this.n_environment = this.n_treeView.addChild( 
            (node) => 
        {
            node.title = zis.name;
            node.bold = true;
            node.emptyText = "No nodes";
            node.icon = $('<i class="ic ic-environment"/>');
        }, "environment-" + this.name);
        
    }

    public async init()
    {
        electron.ipcRenderer.on('refreshWorkspaceCategory', function(event: any, text: number)
        {
            $('#loading-category').text(text);
        });

        electron.ipcRenderer.on('refreshWorkspaceProgress', function(event: any, progress: number)
        {
            const p = Math.floor(progress * 100);
            $('#loading-progress').css('width', "" + p + "%");
        });

        const tree = await ipc.getEnvironmentTree(this.name);
        await this.root.populate(tree);
    }
}

export class WorkspaceRenderer
{
    settingsTimer: NodeJS.Timer;
    environments: Dictionary<string, EnvironmentTreeItemRenderer>;
    tabs: Dictionary<string, WorkspaceTab>;
    private workspaceTree: TreeView;
    private cachedClassInfo: any;

    private readonly tabClasses: Dictionary<string, WorkspaceTabConstructor>;
    n_editorTabs: any;
    n_editorContent: any;

    constructor()
    {
        this.cachedClassInfo = {};

        this.environments = new Dictionary();
        this.tabs = new Dictionary();

        this.tabClasses = new Dictionary();
        this.tabClasses.put("node", NodeTab);
        this.tabClasses.put("default", DefaultTab);
        this.tabClasses.put("class", NodeClassTab);

        this.init();
    }

    public async getClassInfo(env: string): Promise<any>
    {
        if (this.cachedClassInfo.hasOwnProperty(env))
        {
            return this.cachedClassInfo[env];
        }

        const classInfo = await ipc.getClassInfo(env);
        this.cachedClassInfo[env] = classInfo;
        return classInfo;
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

        this.workspaceTree = new TreeView($('#workspace'));

        const environments: string[] = await ipc.getEnvironmentList();

        await ipc.refreshWorkspace();

        for (const environment of environments)
        {
            const env = this.addEnvironment(environment);
            await env.init();
        }

        await this.enable();
    }

    public addEnvironment(name: string): EnvironmentTreeItemRenderer
    {
        const environment = new EnvironmentTreeItemRenderer(this, name, this.workspaceTree.root);
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
            await this.openTab("default", []);
        }
        else if (keys.length > 0)
        {
            const hasDefault = keys.indexOf("default") >= 0;

            if (hasDefault && keys.length > 1)
            {
                await this.closeTab("default");
            }
        }
    }

    public async openTab(kind: string, path: Array<string>): Promise<any>
    {
        const key = path.length > 0 ? kind + "_" + path.join("_") : kind;

        if (this.tabs.has(key))
        {
            const tab = this.tabs.get(key);

            $(tab.buttonNode).find('a').tab('show');
            return;
        }

        const fixedPath = key.replace(/:/g, '_');

        const _class: WorkspaceTabConstructor = this.tabClasses.get(kind);
        if (!_class)
            return;

        const tabButton = $('<li class="nav-item">' +
            '<a class="nav-link" id="' + fixedPath + '-tab" data-toggle="tab" href="#' + fixedPath + '" ' +
            'role="tab" aria-controls="' + fixedPath + '" aria-selected="false"></a>' +
            '</li>').appendTo(this.n_editorTabs);

        const tabContents = $('<div class="tab-pane h-100" id="' + fixedPath +
            '" role="tabpanel" aria-labelledby="' + fixedPath + '-tab">' +
            '</div>').appendTo(this.n_editorContent);

        const _tab = new _class(path, tabButton, tabContents, this);

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
                this.closeTab(key);
            });
        }

        _a.tab('show');

        this.tabs.put(key, _tab);

        await this.checkEmpty();
    }

    public async closeTab(key: string): Promise<any>
    {
        if (!this.tabs.has(key))
            return;

        const tab = this.tabs.get(key);
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

        this.tabs.remove(key);

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
