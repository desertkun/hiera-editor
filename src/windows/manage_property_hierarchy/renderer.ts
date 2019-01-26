
import { IPC } from "../../ipc/client";
import { ipcRenderer } from 'electron';
import { HierarchyEntryDump } from "../../ipc/objects"

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;
const Dialogs = require('dialogs');
const ipc = IPC();

let renderer: ManagePropertyHierarchyRenderer;

const dialogs = Dialogs();

function confirm(title: string): Promise<boolean>
{
    return new Promise<boolean>((resolve: any) => {
        dialogs.confirm(title, (result: boolean) =>
        {
            resolve(result);
        })
    });
}

class ManagePropertyHierarchyRenderer
{
    private environment: string;
    private certname: string;
    private property: string;
    private hierarchy: any[];
    private _changed: boolean;
    private _constructor: string;

    constructor(environment: string, certname: string, property: string, hierarchy: any[], _constructor: string)
    {
        this.environment = environment;
        this.certname = certname;
        this.property = property;
        this.hierarchy = hierarchy;
        this._constructor = _constructor;
    }

    protected changed()
    {
        if (this._changed)
            return;
            
        this._changed = true;
        ipcRenderer.send("hierarchy-changed");
    }

    protected constructObject()
    {
        switch (this._constructor)
        {
            case "array":
                return [];
            case "object":
                return {}
        }

        return null;
    }

    public async init()
    {
        $('#property-name').text(this.property);
        const levels = $('#hierarchy-levels');
        const zis = this;

        $('#save').click(() => {
            window.close();
        });

        document.addEventListener('keydown', event => 
        {
            if (event.key === 'Escape' || event.keyCode === 27) 
            {
                window.close();
            }
        });

        for (let level = 0, t = this.hierarchy.length; level < t; level++)
        {
            const hierarchy = this.hierarchy[level];
            const level_ = level;
            const text = hierarchy.path;
            const icon = hierarchy.eyaml ? "lock" : "stop";

            const node = $('<div class="hierarchy-entry"></div>').appendTo(levels);

            $('<span class="modified-' + (level % 12) + '"><i class="fas fa-' + icon + '"></i> ' + text + '</span>').appendTo(node);
            const buttons = $('<span class="float-right"></span>').appendTo(node);

            const remove = $('<span class="btn btn-sm btn-success" title="Click To Undefine" style="display: none;">Defined</span>').appendTo(buttons);
            const use = $('<span class="btn btn-sm btn-secondary" title="Click Define" style="display: none;">Not Defined</span>').appendTo(buttons);

            remove.click(async () => 
            {
                if (!await confirm("This will destroy definition of the property \"" + zis.property + 
                    "\" on hierarchy level " + text))
                    return;

                await ipc.removeNodeProperty(zis.environment, zis.certname, level_, zis.property);

                zis.changed();

                remove.hide();
                use.show();
            })

            use.click(async () => 
            {
                await ipc.setNodeProperty(zis.environment, zis.certname, level_, zis.property, zis.constructObject());
                
                zis.changed();

                use.hide();
                remove.show();
            })

            if (hierarchy.defined)
            {
                remove.show();
            }
            else
            {
                use.show();
            }
        }
    }
    
}

// @ts-ignore
window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
};

ipcRenderer.on('init', function (event: any, environment: string, certname: string, 
    property: string, hierarchy: any[], _constructor: string) 
{
    renderer = new ManagePropertyHierarchyRenderer(environment, certname, property, hierarchy, _constructor);
    renderer.init();
});
