const electron = require('electron');
const $ = require("jquery");

let window_: Window;

electron.ipcRenderer.on('refresh-workspace-category', function(event: any, text: number)
{
    $(window_.document).find('#loading-category').text(text);
});

electron.ipcRenderer.on('refresh-workspace-progress', function(event: any, progress: number)
{
    const p = Math.floor(progress * 100);
    $(window_.document).find('#loading-progress').css('width', "" + p + "%");
});

export function setup(window: Window, data: any)
{
    window_ = window;
}
