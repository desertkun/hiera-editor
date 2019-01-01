
import { IPC } from "../../ipc/client";
import { ipcRenderer } from 'electron';

const $ = require("jquery");
const remote = require('electron').remote;

const ipc = IPC();

let renderer: CreateEnvironmentRenderer;

class CreateEnvironmentRenderer
{
    constructor()
    {
    }

    private async createEnvironment()
    {
        const val = $("#envirnonemt-name").val();

        if (val == "")
            return;

        ipcRenderer.send("environment-name-entered", val);
    }

    public async init()
    {
        const zis = this;

        $("#envirnonemt-name").on('keypress', (e: any) => 
        {
            if(e.which == 13) 
            {
                zis.createEnvironment();
            }
        });

        $('#create').click(() => 
        {
            zis.createEnvironment();
        });

        $('#cancel').click(() => 
        {
            window.close();
        });

        document.addEventListener('keydown', event => 
        {
            if (event.key === 'Escape' || event.keyCode === 27) 
            {
                window.close();
            }
        });
    }
}

// @ts-ignore
window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
};

ipcRenderer.on('init', function (event: any)
{
    renderer = new CreateEnvironmentRenderer();
    renderer.init();
});
