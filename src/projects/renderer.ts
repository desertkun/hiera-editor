
import { ipc } from "../ipc/client";

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;

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
        const zis = this;

        $('#btn-open-project').click(async () => 
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
                alert(e.message);
                return;
            }

            zis.openProject(path);
        });
    }

    private openProject(path: string)
    {
        ipc.openProject(path);
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
                    node.click(() => {
                        zis.openProject(projectPath);
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

$(() =>
{
    renderer = new ProjectsRenderer();
});
