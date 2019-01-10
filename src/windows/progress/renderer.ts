
import { IPC } from "../../ipc/client";
import { ipcRenderer } from 'electron';

const $ = require("jquery");
const electron = require('electron');

const ipc = IPC();

let renderer: ProgressRenderer;

class ProgressRenderer
{
    constructor()
    {
    }

    public async init()
    {
        electron.ipcRenderer.removeAllListeners('progressUpdate');
        electron.ipcRenderer.removeAllListeners('progressError');

        electron.ipcRenderer.on('progressUpdate', function(event: any, text: string)
        {
            $('#loading-progress').text(text);
        });

        electron.ipcRenderer.on('progressError', function(event: any, title: string, text: string)
        {
            $('#progress-root').html('<p class="text-center">' +
            '<span class="text text-danger"><i class="fas fa-2x fa-exclamation-triangle"></i></span></p>' +
            '<p class="text-center text-danger">' +
            '<span class="text text-muted" style="white-space: pre-line;" id="loading-error-title"></span></p>' +
            '<p class="text-center" style="height: 200px; overflow-y: auto;">' +
            '<span class="text text-muted" style="white-space: pre-line;" id="loading-error-contents"></span></p>');

            $('#loading-error-title').text(title);
            $('#loading-error-contents').text(text);
            $('#close').show();
        });

        $('#close').click(() => 
        {
            window.close();
        });
    }
}

// @ts-ignore
window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
};

ipcRenderer.on('init', function (event: any)
{
    renderer = new ProgressRenderer();
    renderer.init();
});
