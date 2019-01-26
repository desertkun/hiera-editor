
import { IPC } from "../../ipc/client";
import { ipcRenderer } from 'electron';
import { HierarchyEntryDump } from "../../ipc/objects"

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;
const Dialogs = require('dialogs');
const ipc = IPC();

let renderer: ManageEYamlRenderer;

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

class ManageEYamlRenderer
{
    private publicKey: string;
    private havePublicKey: boolean;
    private _changed: boolean;

    constructor(publicKey: string, havePublicKey: boolean)
    {
        this.publicKey = publicKey;
        this.havePublicKey = havePublicKey;
    }

    protected updated(publicKey: string)
    {
        if (this._changed)
            return;
            
        this._changed = true;
        ipcRenderer.send("updated", publicKey);
    }


    public async init()
    {
        $('#apply').click(() => 
        {
            const publicKey = $('#public-key-value').val();
            this.updated(publicKey);
            window.close();
        });

        document.addEventListener('keydown', event => 
        {
            if (event.key === 'Escape' || event.keyCode === 27) 
            {
                window.close();
            }
        });

        if (this.havePublicKey)
        {
            $('#public-key-value').val(this.publicKey);
        }
    }
    
}

// @ts-ignore
window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
};

ipcRenderer.on('init', function (event: any, publicKey: string, havePublicKey: boolean)
{
    renderer = new ManageEYamlRenderer(publicKey, havePublicKey);
    renderer.init();
});
