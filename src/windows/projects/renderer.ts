
import { IPC } from "../../ipc/client";

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;
const {dialog} = require('electron').remote

const ipc = IPC();

let renderer: ProjectsRenderer;

class ProjectsRenderer
{
    constructor()
    {
        this.init();
        this.renderProjectsList();
    }

    private init()
    {
        $('[data-toggle="tooltip"]').tooltip();

        const zis = this;

        $('#btn-open-project').click(async (e: any) => 
        {
            const path: string = await ipc.showOpenDirectoryDialog();

            if (path == null)
            {
                alert("Please select a project folder");
                return;
            }

            try
            {
                await ipc.addProject(path)
            }
            catch (e)
            {
                const dialogOptions = {type: 'error', buttons: ['OK'], message: e.message}
                dialog.showMessageBox(dialogOptions, i => console.log(i))
                return;
            }

            zis.openProject(path, e.shiftKey);
        });
        
        $('#btn-new-project').click(async () => 
        {
            try
            {
                await ipc.createProject();
            }
            catch (e)
            {
                const dialogOptions = {type: 'error', buttons: ['OK'], message: e.message}
                dialog.showMessageBox(dialogOptions, i => console.log(i))
                return;
            }
        });
    }

    private openProject(path: string, offline: boolean)
    {
        ipc.openProject(path, offline);
    }

    private renderProjectsList()
    {
        const zis = this;

        ipc.getProjectList().then((projects: Array<any>) => 
        {
            const projectsListNode = $('#projects-list');
            const noProjectsNode = $('#no-projects');

            if (projects.length > 0)
            {
                projectsListNode.empty();
                noProjectsNode.hide();

                for (let project of projects)
                {
                    const projectPath = project.path;
                    const shortenedPath = ellipsis(project.path, 40, { side: 'start'});
                    const node = $('<tr><td>' + project.name + '<br><span class="text text-muted"><small>' + shortenedPath + '</small></span></td></tr>').appendTo(projectsListNode);
                    node.click((e: any) => {
                        zis.openProject(projectPath, e.shiftKey);
                    });
                }
            }
            else
            {
                projectsListNode.empty();
                noProjectsNode.show();
            }
        });
    }

    
}

// @ts-ignore
window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
};

$(() =>
{
    renderer = new ProjectsRenderer();
});
