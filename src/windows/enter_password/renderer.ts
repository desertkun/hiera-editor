
import { IPC } from "../../ipc/client";
import { ipcRenderer } from 'electron';

const $ = require("jquery");
const remote = require('electron').remote;
const ipc = IPC();

let renderer: EnterPasswordRenderer;


class EnterPasswordRenderer
{
    private title: string;
    private description: string;

    constructor(title: string, description: string)
    {
        this.title = title;
        this.description = description;
    }

    protected updated(password: string)
    {
        ipcRenderer.send("updated", password);
    }

    public async init()
    {
        document.title = this.title;

        $('#apply').click(() => 
        {
            const password = $('#password').val();
            this.updated(password);
            window.close();
        });

        $("#password").on('keypress', (e: any) => 
        {
            if(e.which == 13) 
            {
                const password = $('#password').val();
                this.updated(password);
                window.close();
            }
        });

        document.addEventListener('keydown', event => 
        {
            if (event.key === 'Escape' || event.keyCode === 27) 
            {
                window.close();
            }
        });

        $('#description').text(this.description)
    }
    
}

// @ts-ignore
window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
};

ipcRenderer.on('init', function (event: any, title: string, description: string) 
{
    renderer = new EnterPasswordRenderer(title, description);
    renderer.init();
});
