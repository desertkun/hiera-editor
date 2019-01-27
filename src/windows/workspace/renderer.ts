import { IPC } from "../../ipc/client";
import {Dictionary} from "../../dictionary";

const ipc = IPC();

const Dialogs = require('dialogs');
const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const electron = require('electron');
const remote = electron.remote;
const {Menu, MenuItem} = remote;
const app = remote.app;
const path = require('path');
const nativeImage = electron.nativeImage;
const storage = require('electron-json-storage');

import {WorkspaceTab, WorkspaceTabConstructor} from "./tabs/tab";
import {DefaultTab} from "./tabs/default";
import {NodeClassTab} from "./tabs/class";
import {NodeResourceTab} from "./tabs/resource";
import { ipcRenderer } from 'electron';

import {TreeView, TreeViewNode} from "./treeview";
import { NodeDump } from "../../ipc/objects";

const dialogs = Dialogs();
let renderer: WorkspaceRenderer;
let selectedNode: any = null;

function confirm(title: string): Promise<boolean>
{
    return new Promise<boolean>((resolve: any) => {
        dialogs.confirm(title, (result: boolean) =>
        {
            resolve(result);
        })
    });
}

function prompt(title: string, value: string): Promise<string>
{
    return new Promise<string>((resolve: any) => {
        dialogs.prompt(title, value, (result: string) =>
        {
            resolve(result);
        })
    });
}

class NodeItemRenderer
{
    private certname: string;
    private env: EnvironmentTreeItemRenderer;
    private info: NodeDump;
    private n_node: TreeViewNode;
    private n_parent: TreeViewNode;

    constructor(n_parent: TreeViewNode, env: EnvironmentTreeItemRenderer, certname: string, info: NodeDump)
    {
        this.certname = certname;
        this.env = env;
        this.info = info;
        this.n_parent = n_parent;
    }

    public async init()
    {
        this.render();
    }

    private renderClasses(node: TreeViewNode, hieraInclude: string, hierarchyLevel: number = -1): boolean
    {
        const zis = this;
        let hadAny: boolean = false;

        const nodeClassNames = Object.keys(this.info.classes);
        nodeClassNames.sort();

        for (const className of nodeClassNames)
        {
            const classInfo = this.info.classes[className];
            const iconData = classInfo != null ? classInfo.options.icon : null;
            const classHieraInclude = classInfo != null ? classInfo.options["hiera_include"] : null;

            if (classInfo != null && hieraInclude != classHieraInclude)
            {
                continue;
            }

            const classNode = node.addChild( 
                (node) => 
            {
                if (iconData != null)
                {
                    node.icon = $('<img class="node-entry-icon treeview-node-offset" src="' + iconData + 
                        '" style="width: 16px; height: 16px;">');
                }
                else
                {
                    node.icon = $('<i class="node-entry-icon fas fa-puzzle-piece treeview-node-offset"></i>');
                }

                node.title = className;
                node.leaf = true;
                node.selectable = true;
                node.onSelect = (node) => 
                {
                    renderer.openTab("class", [zis.env.name, zis.certname, className]);
                };
            }, "class-" + this.env.name + "-" + zis.certname + "-" + className, renderer.openNodes);
            
            if (classHieraInclude != null)
            {
                classNode.contextMenu([
                    {
                        label: "Remove",
                        click: async () => 
                        {
                            await ipc.removeHieraClassFromNode(zis.env.name, zis.certname, classHieraInclude, hierarchyLevel, className);
                            await renderer.refreshWorkspace();
                        }
                    }
                ]);
            }

            hadAny = true;
        }

        return hadAny;
    }
    
    private renderResources(node: TreeViewNode, hieraInclude: string, hierarchyLevel: number)
    {
        const zis = this;

        const nodeResources = this.info.resources;
        const nodeResourcesNames = Object.keys(nodeResources);
        nodeResourcesNames.sort();

        for (const definedTypeName of nodeResourcesNames)
        {
            const resourceType = this.info.resources[definedTypeName];

            const resourceTypeInfo = resourceType.definedType;
            if (resourceTypeInfo == null)
                continue;

            const resourceTitles = resourceType.titles;

            const resourceTitleKeys = Object.keys(resourceTitles);
            resourceTitleKeys.sort();

            let haveAny = false;

            for (const title of resourceTitleKeys)
            {
                const entry = resourceTitles[title];
                const resourceInclude = entry.options != null ? entry.options["hiera_resources"] : null;
                if (resourceInclude == hieraInclude)
                {
                    haveAny = true;
                    break;
                }
            }
                
            if (!haveAny)
                continue;

            const iconData = resourceTypeInfo != null && resourceTypeInfo.options != null ? resourceTypeInfo.options.icon : null;

            const resourceNode = node.addChild( 
                (node) => 
            {
                if (iconData != null)
                {
                    node.icon = $('<img class="node-entry-icon treeview-node-offset" src="' + iconData + 
                        '" style="width: 16px; height: 16px;">');
                }
                else
                {
                    node.icon = $('<i class="node-entry-icon fas fa-puzzle-piece treeview-node-offset"></i>');
                }

                node.title = definedTypeName;
                node.leaf = false;
            }, "resources-" + zis.env.name + "-" + zis.certname + "-" + definedTypeName, renderer.openNodes);
            
            resourceNode.contextMenu([
                {
                    label: "Create New Resource",
                    click: async () => 
                    {
                        const newTitle = await prompt("Enter a title for new resource " + definedTypeName, "");
    
                        if (newTitle == null)
                            return;
    
                        if (!(await ipc.createNewResourceToNode(zis.env.name, zis.certname, 
                            hieraInclude, hierarchyLevel, definedTypeName, newTitle)))
                            return;
    
                        await renderer.refreshWorkspace();
                        await renderer.openTab("resource", 
                            [zis.env.name, zis.certname, definedTypeName, newTitle]);
                        
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Remove All",
                    click: async () => 
                    {
                        await ipc.removeResourcesFromNode(zis.env.name, zis.certname, 
                            hieraInclude, hierarchyLevel, definedTypeName);

                        await renderer.refreshWorkspace();
                    }
                }
            ]);
            
            for (const title of resourceTitleKeys)
            {
                const entry = resourceTitles[title];

                const resourceInclude = entry.options != null ? entry.options["hiera_resources"] : null;
                if (resourceInclude != hieraInclude)
                {
                    continue;
                }
    
                const resourceNameNode = resourceNode.addChild( 
                    (node) => 
                {
                    node.icon = $('<i class="node-entry-icon far fa-clone treeview-node-offset"></i>');
                    node.title = title;
                    node.selectable = true;
                    node.leaf = true;
                    node.onSelect = (node) => 
                    {
                        renderer.openTab("resource", [zis.env.name, zis.certname, definedTypeName, title]);
                    };
                }, "resource-" + zis.env.name + "-" + zis.certname + "-" + definedTypeName + "-" + title, renderer.openNodes);
                
                resourceNameNode.contextMenu([
                    {
                        label: "Rename",
                        click: async () => 
                        {
                            const newTitle = await prompt("Enter new name for resource " + definedTypeName, title);

                            if (newTitle == null || newTitle == title)
                                return;

                            if (!(await ipc.renameNodeResource(zis.env.name, zis.certname, 
                                hieraInclude, hierarchyLevel, definedTypeName, title, newTitle)))
                                return;

                            await renderer.refreshWorkspace();
                        }
                    },
                    {
                        type: "separator"
                    },
                    {
                        label: "Remove",
                        click: async () => 
                        {
                            await ipc.removeResourceFromNode(zis.env.name, zis.certname, 
                                hieraInclude, hierarchyLevel, definedTypeName, title);
                            await renderer.refreshWorkspace();
                        }
                    }
                ]);
            }
        }

    }

    private havePuppetDefinedClasses(): boolean
    {
        const nodeClassNames = Object.keys(this.info.classes);

        for (const className of nodeClassNames)
        {
            const classInfo = this.info.classes[className];

            if (classInfo != null && classInfo.options["hiera_include"] == null)
            {
                return true;
            }
        }

        return false;
    }

    private get hierarchy(): any[]
    {
        return this.info.hierarchy;
    }

    private render()
    {
        const zis = this;

        this.n_node = this.n_parent.addChild( 
            (node) => 
        {
            node.icon = $('<i class="fa fa-server treeview-node-offset"></i>');
            node.title = zis.certname;
            node.selectable = false;
        }, "node-" + zis.env.name + "-" + zis.certname, renderer.openNodes);

        this.n_node.contextMenu([
            {
                label: "Ignore This Node",
                click: async () => 
                {
                    await ipc.ignoreNode(zis.certname);
                    await renderer.refreshWorkspace();
                }
            }
        ])

        const includeNames = Object.keys(this.info.hiera_includes);
        includeNames.sort();

        for (const includeName of includeNames)
        {
            const hierarchyLevel = this.info.hiera_includes[includeName];

            const nodeIcon = hierarchyLevel >= 0 ? '<span class="modified-' + 
                (hierarchyLevel % 12) + '"><i class="fas fa-flask treeview-node-offset"></i></span>' : 
                '<i class="fas fa-flask treeview-node-offset"></i>';
            const nodeTitle = hierarchyLevel >= 0 ? '<span class="modified-' + 
                (hierarchyLevel % 12) + '">Hiera Classes [' + includeName + ']</span>' : 'Hiera Classes [' + includeName + ']';

            const n_classes = this.n_node.addChild( 
                (node) => 
            {
                node.icon = $(nodeIcon);
                node.title = nodeTitle;
                node.emptyText = "This hiera_include has no classes";
                node.leaf = false;
                node.selectable = false;
            }, "node-" + zis.env.name + "-" + zis.certname + "-hiera-" + includeName, renderer.openNodes);

            let hierarcyName_ = "";

            if (hierarchyLevel >= 0)
            {
                const hierarchy = zis.hierarchy[hierarchyLevel];

                hierarcyName_ = hierarchy.path;
            }

            const hierarcyName = hierarcyName_;

            const contextOptions: any = [
                {
                    label: "Assign New Class",
                    click: async () => 
                    {
                        if (hierarchyLevel < 0)
                        {
                            const changed = await ipc.managePropertyHierarchy(zis.env.name, zis.certname, 
                                includeName, "array");
        
                            if (changed)
                            {
                                await renderer.refreshWorkspace();
                            }

                            return;
                        }

                        const className = await ipc.assignNewHieraClass(
                            zis.env.name, zis.certname, includeName, hierarchyLevel);
    
                        if (className)
                        {
                            await renderer.refreshWorkspace();
                        }
                    }
                },
                {
                    label: "Manage Hierarchy",
                    click: async () => 
                    {
                        const changed = await ipc.managePropertyHierarchy(zis.env.name, zis.certname, 
                            includeName, "array");
    
                        if (changed)
                        {
                            await renderer.refreshWorkspace();
                        }
                    }
                },
                {
                    type: "separator"
                },
                {
                    label: "Remove All Classes",
                    click: async () => 
                    {
                        if (!await confirm("This will completely destroy all classes defined in property \"" + includeName + 
                            "\" on hierarchy level \"" + hierarcyName + "\". Are you sure?"))
                            return;

                        await ipc.removeNodeProperty(zis.env.name, zis.certname, hierarchyLevel, includeName);
                        await renderer.refreshWorkspace();
                    }
                }
            ];

            if (hierarchyLevel >= 0)
            {
                contextOptions.splice(0, 0, {
                    label: "Defined at: " + hierarcyName,
                    enabled: false
                });
            }
            n_classes.contextMenu(contextOptions)
    
            this.renderClasses(n_classes, includeName, hierarchyLevel);
        }

        const recourceIncludeNames = Object.keys(this.info.hiera_resources);
        recourceIncludeNames.sort();

        if (recourceIncludeNames.length > 0)
        {
            for (const includeName of recourceIncludeNames)
            {
                const hierarchyLevel = this.info.hiera_resources[includeName];
    
                let hierarcyName_ = "";

                if (hierarchyLevel >= 0)
                {
                    const hierarchy = zis.hierarchy[hierarchyLevel];
                    hierarcyName_ = hierarchy.path;
                }
    
                const hierarcyName = hierarcyName_;
    
                const nodeIcon = hierarchyLevel >= 0 ? '<span class="modified-' + 
                    (hierarchyLevel % 12) + '"><i class="fas fa-clone treeview-node-offset"></i></span>' : 
                    '<i class="fas fa-clone treeview-node-offset"></i>';
                const nodeTitle = hierarchyLevel >= 0 ? '<span class="modified-' + 
                    (hierarchyLevel % 12) + '">Hiera Resources [' + includeName + ']</span>' : 'Hiera Resources [' + includeName + ']';
    
                const n_resources = this.n_node.addChild( 
                    (node) => 
                {
                    node.icon = $(nodeIcon);
                    node.title = nodeTitle;
                    node.emptyText = "Node has no resources";
                    node.leaf = false;
                    node.selectable = false;
                }, "node-" + zis.env.name + "-" + zis.certname + "-resources", renderer.openNodes);
                
                const contextOptions: any[] = [
                    {
                        label: "Create New Resource",
                        click: async () => 
                        {
                            if (hierarchyLevel < 0)
                            {
                                const changed = await ipc.managePropertyHierarchy(zis.env.name, zis.certname, 
                                    includeName, "object");
            
                                if (changed)
                                {
                                    await renderer.refreshWorkspace();
                                }

                                return;
                            }

                            const definedTypeName = await ipc.chooseDefinedType(zis.env.name, zis.certname);
                            if (!definedTypeName)
                                return;
        
                            const newTitle = await prompt("Enter a title for new resource " + definedTypeName, "");
        
                            if (newTitle == null)
                                return;
        
                            if (!(await ipc.createNewResourceToNode(zis.env.name, zis.certname, 
                                includeName, hierarchyLevel, definedTypeName, newTitle)))
                                return;
        
                            await renderer.refreshWorkspace();
                            await renderer.openTab("resource", 
                                [zis.env.name, zis.certname, definedTypeName, newTitle]);
                        }
                    },
                    {
                        label: "Manage Hierarchy",
                        click: async () => 
                        {
                            const changed = await ipc.managePropertyHierarchy(zis.env.name, zis.certname, 
                                includeName, "object");
        
                            if (changed)
                            {
                                await renderer.refreshWorkspace();
                            }
                        }
                    },
                    {
                        type: "separator"
                    },
                    {
                        label: "Remove All Resources",
                        click: async () => 
                        {
                            if (!await confirm("This will completely destroy all resources defined in property \"" + includeName + 
                                "\" on hierarchy level \"" + hierarcyName + "\". Are you sure?"))
                                return;
    
                            await ipc.removeAllResourcesFromNode(zis.env.name, zis.certname, includeName, hierarchyLevel);
                            await renderer.refreshWorkspace();               
                        }
                    }
                ];

                if (hierarchyLevel >= 0)
                {
                    contextOptions.splice(0, 0, {
                        label: "Defined at: " + hierarcyName,
                        enabled: false
                    });
                }

                n_resources.contextMenu(contextOptions);

                this.renderResources(n_resources, includeName, hierarchyLevel);
            }
        }

        if (this.havePuppetDefinedClasses())
        {
            const n_classes = this.n_node.addChild( 
                (node) => 
            {
                node.icon = $('<i class="ic ic-puppet treeview-node-offset"></i>');
                node.title = "Puppet Defined Classes";
                node.emptyText = "Node has no classes";
                node.leaf = false;
                node.selectable = false;
            }, "node-" + zis.env.name + "-" + zis.certname + "-classes", renderer.openNodes);
    
            this.renderClasses(n_classes, null);
        }


        /*
        const n_facts = this.n_node.addChild( 
            (node) => 
        {
            node.icon = $('<i class="fas fa-bars treeview-node-offset"></i>');
            node.title = "Facts";
            node.leaf = true;
            node.selectable = true;
            node.onSelect = (node: TreeViewNode) => 
            {
                renderer.openTab("facts", [zis.localPath]);
            };
        }, "node-" + zis.localPath + "-facts", renderer.openNodes);
        
        n_facts.contextMenu([
            {
                label: "About Facts",
                click: async () => {
                    alert('This page can configure fake facts for this node, thus allowing to resolve ' +
                        'defaults correctly. For example, addting a variable with name \"hostname\" will implement the ${hostname} variable ' +
                        'in Puppet accordingly.');
                }
            }
        ])

        */
    }
}


class EnvironmentTreeItemRenderer
{
    public nodes: Dictionary<string, NodeItemRenderer>;
    public renderer: WorkspaceRenderer;
    public name: string;

    private n_environment: TreeViewNode;
    private readonly n_treeView: TreeViewNode;

    constructor(renderer: WorkspaceRenderer, name: string, treeView: TreeViewNode)
    {
        this.renderer = renderer;
        this.name = name;

        this.nodes = new Dictionary();
        this.n_treeView = treeView;

        this.render();
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
            node.icon = $('<i class="ic ic-environment treeview-node-offset"/></i>');
        }, "environment-" + this.name, renderer.openNodes);
        
        this.n_environment.contextMenu([
            /*
            {
                label: "New Node",
                click: async () => 
                {
                    const nodeName = await prompt("Enter a cert name for new node", "");

                    if (nodeName == null || nodeName.length == 0)
                        return;
                    
                    if (!await ipc.createNode(zis.name, nodeName))
                    {
                        alert("Failed to create a node");
                        return;
                    }

                    await renderer.refresh();
                }
            },
            {
                type: "separator"
            },
            */
            {
                label: "Delete",
                click: async () => 
                {
                    if (!await confirm("Are you sure you would like to delete this environment?"))
                        return;
                    
                    if (!await ipc.removeEnvironment(zis.name))
                    {
                        return;
                    }

                    await renderer.refresh();
                }
            }
        ]);
    }

    public async init()
    {
        const tree = await ipc.getEnvironmentTree(this.name);
        const nodes = tree.nodes;
        const warnings = tree.warnings;

        for (const certname in nodes)
        {
            const info = nodes[certname];

            const itemRenderer = new NodeItemRenderer(this.n_environment, this, certname, info);
            this.nodes.put(certname, itemRenderer);
            await itemRenderer.init();
        }
        
        if (warnings.length > 0) 
        {
            const warningsNode = this.n_environment.addChild( 
                (node) => 
            {
                node.title = "Warnings (" + warnings.length + ")";
                node.leaf = true;
                node.icon = $('<i class="fas fa-exclamation-triangle text-warning treeview-node-offset"></i>');
            }, "environment-warnings-" + this.name, renderer.openNodes);

            warningsNode.click(() => 
            {
                $('#warnings-modal-label').text("Warnings of " + this.name + " (" + warnings.length + ")");
                const body = $('#warnings-modal-body').html('');

                for (const warning of warnings)
                {
                    const div = $('<div></div>').appendTo(body);
                    $('<p><i class="fas fa-exclamation-triangle text-warning"></i> ' + warning.title + '</p>').appendTo(div);
                    $('<p style="white-space: pre-line; overflow: auto;"></p>').appendTo(div).text(warning.message);
                }

                $('#warnings-modal').modal();
            });
        }
    }
}

class EnvironmentModulesRenderer
{
    private renderer: WorkspaceRenderer;
    private modules: any;
    private name: string;
    private n_modules: TreeViewNode;
    private readonly n_treeView: TreeViewNode;

    constructor(renderer: WorkspaceRenderer, name: string, treeView: TreeViewNode)
    {
        this.renderer = renderer;
        this.name = name;

        this.n_treeView = treeView;

        this.render();
    }

    private render()
    {
        const zis = this;

        this.n_modules = this.n_treeView.addChild( 
            (node) => 
        {
            node.title = zis.global ? "global" : zis.name;
            node.bold = true;
            node.emptyText = "No modules";
            node.icon = $(zis.global ? '<i class="fas text-danger fa-sitemap treeview-node-offset"></i>' : '<i class="fas text-primary fa-sitemap"></i>');
        }, this.global ? "modules" : ("modules-" + this.name), this.renderer.openNodes);
        
        this.n_modules.contextMenu([
            
            {
                label: "Install New Module",
                click: async () => 
                {
                    //
                }
            }
        ]);
    }

    public get global()
    {
        return this.name == "";
    }

    public async init()
    {
        if (this.global)
        {
            this.modules = await ipc.getGlobalModules();
        }
        else
        {
            this.modules = await ipc.getEnvironmentModules(this.name);
        }

        const names = Object.keys(this.modules);
        names.sort();

        for (const moduleName of names)
        {
            const n_module = this.n_modules.addChild( 
                (node) => 
            {
                node.title = moduleName;
                node.bold = false;
                node.leaf = true;
                node.icon = $('<i class="fas fa-folder"></i>');
            }, this.global ? ("module-" + moduleName) : ("module-" + this.name + "-" + moduleName), 
            this.renderer.openNodes);
            
        }
    }
}

export class WorkspaceRenderer
{
    settingsTimer: NodeJS.Timer;
    environments: Dictionary<string, EnvironmentTreeItemRenderer>;
    modules: Dictionary<string, EnvironmentModulesRenderer>;
    tabs: Dictionary<string, WorkspaceTab>;
    private workspaceTree: TreeView;
    private modulesTree: TreeView;
    private cachedClassInfo: any;

    private readonly tabClasses: Dictionary<string, WorkspaceTabConstructor>;
    n_editorTabs: any;
    n_editorContent: any;

    private _openNodes: Set<string>;

    constructor()
    {
        this._openNodes = new Set<string>();
        this.cachedClassInfo = {};

        this.environments = new Dictionary();
        this.modules = new Dictionary();
        this.tabs = new Dictionary();

        this.tabClasses = new Dictionary();
        
        this.tabClasses.put("default", DefaultTab);
        this.tabClasses.put("class", NodeClassTab);
        this.tabClasses.put("resource", NodeResourceTab);

        this.init();
    }

    public get openNodes(): Set<string>
    {
        return this._openNodes;
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

    public async refreshModules()
    {
        this.modulesTree.clear();

    }

    public async refresh()
    {
        this.workspaceTree.clear();

        const environments: string[] = await ipc.getEnvironmentList();

        this.environments = new Dictionary();

        for (const environment of environments)
        {
            const env = this.addEnvironment(environment);
            await env.init();
        }
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

        await this.initUI();
        
        try
        {
            await ipc.initWorkspace();
        }
        catch (e)
        {
            if (e.hasOwnProperty("title"))
            {
                WorkspaceRenderer.OpenError(e.title, e.message);
            }
            else
            {
                WorkspaceRenderer.OpenError("Failed to process the workspace", e.message);
            }
            return;
        }

        await this.initWorkspace();
        await this.initModules();

        await this.enable();
        await this.registerCallbacks();
    }

    private async registerCallbacks()
    {
        const zis = this;

        $('#workspace-menu').click(function (event: any)
        {
            event.preventDefault();

            const contextMenu = new Menu();
            const menuEntries: any[] = [
                {
                    label: 'New Environment',
                    async click () 
                    { 
                        const success = await ipc.createEnvironment();
                        if (!success)
                            return;
    
                        await renderer.refresh();
                    }
                },
                {
                    label: 'Install/Update Puppetfile modules',
                    async click () 
                    { 
                        await ipc.installModules();
                    }
                },
                {
                    label: 'Refresh',
                    async click () 
                    { 
                        await zis.refreshWorkspace();
                    }
                },
                {
                    label: 'Clear Node Ignore List',
                    async click () 
                    { 
                        if (await ipc.clearIgnoreNodeList())
                            await zis.refreshWorkspace();
                    }
                }
            ];

            for (const entry of menuEntries)
            {
                contextMenu.append(new MenuItem(entry));
            }

            contextMenu.popup({window: remote.getCurrentWindow()})
        });

        ipcRenderer.on('refresh', async function (event: any)
        {
            await renderer.refresh();
        });
    }

    private async initUI()
    {
        electron.ipcRenderer.on('refreshWorkspaceCategory', function(event: any, text: number, showProgress: boolean)
        {
            $('#loading-category').text(text);

            if (showProgress)
            {
                $('#loading-progress-p').show();
            }
            else
            {
                $('#loading-progress-p').hide();
            }
        });

        electron.ipcRenderer.on('refreshWorkspaceProgress', function(event: any, progress: number)
        {
            const p = Math.floor(progress * 100);
            $('#loading-progress').css('width', "" + p + "%");
        });
    }

    private async initWorkspace()
    {
        if (this.workspaceTree == null)
        {
            this.workspaceTree = new TreeView($('#workspace-tree'));
        }
        else
        {
            this.workspaceTree.clear();
        }

        this.environments.clear();

        const environments: string[] = await ipc.getEnvironmentList();

        for (const environment of environments)
        {
            const env = this.addEnvironment(environment);
            await env.init();
        }
    }

    private async initModules()
    {
        if (this.modulesTree == null)
        {
            this.modulesTree = new TreeView($('#workspace-modules'));
        }
        else
        {
            this.modulesTree.clear();
        }

        this.modules.clear();

        {
            // global modules
            const modules = this.addModules("");
            await modules.init();
        }

        const environments: string[] = await ipc.getEnvironmentList();

        for (const environment of environments)
        {
            const modules = this.addModules(environment);
            await modules.init();
        }
    }

    public addModules(env: string): EnvironmentModulesRenderer
    {
        const modules = new EnvironmentModulesRenderer(this, env, this.modulesTree.root);
        this.modules.put(env, modules);
        return modules;
    }

    public addEnvironment(name: string): EnvironmentTreeItemRenderer
    {
        const environment = new EnvironmentTreeItemRenderer(this, name, this.workspaceTree.root);
        this.environments.put(name, environment);
        return environment;
    }

    private static OpenError(title: string, text: string)
    {
        $('#workspace-contents').html('<div class="vertical-center h-100"><div><p class="text-center">' +
            '<span class="text text-danger"><i class="fas fa-2x fa-exclamation-triangle"></i></span></p>' +
            '<p class="text-center text-danger">' +
            '<span class="text text-muted" style="white-space: pre-line;" id="loading-error-title"></span></p>' +
            '<p class="text-center" style="max-height: 250px; overflow-y: scroll;">' +
            '<span class="text text-muted" style="white-space: pre-line;" id="loading-error-contents"></span></p></div></div>');

        $('#loading-error-title').text(title);
        $('#loading-error-contents').text(text);
    }

    private static OpenLoading()
    {
        $('#workspace-contents').html('<div class="vertical-center h-100"><div><p class="text-center">' +
            '<span class="text text-muted"><i class="fas fa-cog fa-4x fa-spin"></i></span></p>' +
            '<p class="text-center"><span class="text text-muted" style="white-space: pre-line;" id="loading-category">' +
            'Please wait while the workspace is updating cache</span></p>' +
            '<p class="text-center"><div class="progress" id="loading-progress-p" style="width: 400px;">' +
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
            const _i = $('<i class="fas fa-times close-btn"></i>').appendTo(_a).click(async () => {
                await this.closeTab(key);
            });
        }

        _a.tab('show').on('shown.bs.tab', async () => {
            await _tab.focusIn();
        });

        this.tabs.put(key, _tab);

        await this.checkEmpty();
    }

    public async closeTabKind(kind: string, path: Array<string>): Promise<boolean>
    {
        const key = path.length > 0 ? kind + "_" + path.join("_") : kind;
        return await this.closeTab(key);
    }

    public async refreshTabKind(kind: string, path: Array<string>): Promise<any>
    {
        const key = path.length > 0 ? kind + "_" + path.join("_") : kind;
        await this.refreshTab(key);
    }

    public async refreshTab(key: string): Promise<void>
    {
        if (!this.tabs.has(key))
            return;

        const tab = this.tabs.get(key);
        await tab.refresh();
    }

    public async closeTab(key: string): Promise<boolean>
    {
        if (!this.tabs.has(key))
            return false;

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
        return true;
    }

    public async refreshWorkspace()
    {
        await this.disable();
        
        WorkspaceRenderer.OpenLoading();

        try
        {
            await ipc.initWorkspace();
        }
        catch (e)
        {
            if (e.hasOwnProperty("title"))
            {
                WorkspaceRenderer.OpenError(e.title, e.message);
            }
            else
            {
                WorkspaceRenderer.OpenError("Failed to process the workspace", e.message);
            }
            return;
        }

        await this.initWorkspace();
        await this.initModules();

        await this.enable();
    }

    private async disable()
    {
        $('#workspace').addClass('disabled');
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
