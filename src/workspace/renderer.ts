
import { ipc } from "../ipc/client";

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;
const storage = require('electron-json-storage');

let renderer: WorkspaceRenderer;

class WorkspaceRenderer
{
    settingsTimer: NodeJS.Timer = null;

    constructor()
    {
        this.init();
        this.initWorkspace();
    }

    private async init()
    {
        const path: string = await ipc.getCurrentWorkspacePath();

        if (path != null)
        {
            const shortenedPath = ellipsis(path, 80, { side: 'start'});

            document.title = shortenedPath;
        }

        const environments: string[] = await ipc.getEnvironmentList();

    }

    private initWorkspace()
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
            $('.split-bar').mousedown(function (e: MouseEvent)
            {
                e.preventDefault();

                // noinspection TypeScriptValidateJSTypes
                $(document).mousemove(function (e: MouseEvent)
                {
                    e.preventDefault();

                    const x = e.pageX - sideBar.offset().left;
                    if (x > sidebarMin && x < sidebarMax && e.pageX < ($(window).width() - contentsMin))
                    {
                        WorkspaceRenderer.applyWorkspaceSettings(x);
                        zis.saveWorkspaceSettings(x);
                    }
                })
            });

            // noinspection TypeScriptValidateJSTypes
            $(document).mouseup(function (e: MouseEvent) {
                $(document).unbind('mousemove');
            });
        });

        $('.workspace-environment-header').click(function()
        {
            const entry = $(this).parent();

            if (entry.hasClass('workspace-environment-opened'))
            {
                entry.find('span.collapse-icon > i').removeClass().addClass('fa fa-angle-right');
                entry.removeClass('workspace-environment-opened');
                entry.find('.workspace-nodes').hide();
            }
            else
            {
                entry.find('span.collapse-icon > i').removeClass().addClass('fa fa-angle-down');
                entry.addClass('workspace-environment-opened');
                entry.find('.workspace-nodes').show();
            }
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
