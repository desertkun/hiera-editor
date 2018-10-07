System.register(["../ipc/client"], function (exports_1, context_1) {
    "use strict";
    var client_1, $, ellipsis, remote, renderer, ProjectsRenderer;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (client_1_1) {
                client_1 = client_1_1;
            }
        ],
        execute: function () {
            $ = require("jquery");
            ellipsis = require('text-ellipsis');
            remote = require('electron').remote;
            ProjectsRenderer = class ProjectsRenderer {
                constructor() {
                    this.init();
                    this.renderProjectsList();
                }
                init() {
                    const zis = this;
                    $('#btn-open-project').click(async () => {
                        const path = await client_1.ipc.showOpenDirectoryDialog();
                        if (path == null) {
                            alert("Please select a project folder");
                            return;
                        }
                        try {
                            await client_1.ipc.addProject(path);
                        }
                        catch (e) {
                            alert(e.message);
                            return;
                        }
                        zis.openProject(path);
                    });
                }
                openProject(path) {
                    client_1.ipc.openProject(path);
                }
                renderProjectsList() {
                    const zis = this;
                    client_1.ipc.getProjectList().then((projects) => {
                        const projectsListNode = $('#projects-list');
                        const noProjectsNode = $('#no-projects');
                        if (projects.length > 0) {
                            projectsListNode.empty();
                            noProjectsNode.hide();
                            for (let project of projects) {
                                const projectPath = project.path;
                                const shortenedPath = ellipsis(project.path, 40, { side: 'start' });
                                const node = $('<tr><td>' + project.name + '<br><span class="text text-muted"><small>' + shortenedPath + '</small></span></td></tr>').appendTo(projectsListNode);
                                node.click(() => {
                                    zis.openProject(projectPath);
                                });
                            }
                        }
                        else {
                            projectsListNode.empty();
                            noProjectsNode.show();
                        }
                    });
                }
            };
            $(() => {
                renderer = new ProjectsRenderer();
            });
        }
    };
});
//# sourceMappingURL=renderer.js.map