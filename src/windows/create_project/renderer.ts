
import { IPC } from "../../ipc/client";
import { ipcRenderer } from 'electron';

const $ = require("jquery");
const remote = require('electron').remote;

const ipc = IPC();

let renderer: CreateProjectRenderer;

class CreateProjectRenderer
{
    constructor()
    {
    }

    private async createProject()
    {
        const path = $("#project-directory").val();

        if (path == "")
            return;

        const env = $("#environment-name").val();

        ipcRenderer.send("project-created", path, env);
    }

    public async init()
    {
        const zis = this;

        $("#project-directory").on('keypress', (e: any) => 
        {
            if(e.which == 13) 
            {
                zis.createProject();
            }
        });

        $('#browse-project').click(async () => 
        {
            const path = await ipc.showOpenDirectoryDialog();
            if (path == null)
                return;
            $('#project-directory').val(path);
        });

        $('#create').click(() => 
        {
            zis.createProject();
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
    renderer = new CreateProjectRenderer();
    renderer.init();
});
