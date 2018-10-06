"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const puppet_1 = require("./puppet");
const async = require("./async");
class ProjectModel {
    constructor(path, workspace) {
        this._path = path;
        this._workspace = workspace;
    }
    get path() {
        return this._path;
    }
    get workspace() {
        return this._workspace;
    }
    set path(path) {
        this._path = path;
    }
    async load(data) {
        this._path = data["path"];
        if (!this._path) {
            throw new Error("No path registered within workspace.");
        }
        if (!await async.fileExists(this._path)) {
            throw new Error("No such workspace: " + this._path);
        }
        this._workspace = new puppet_1.puppet.Workspace(this._path);
        return await this._workspace.load();
    }
    dump() {
        return {
            "path": this._path
        };
    }
}
exports.ProjectModel = ProjectModel;
class ProjectsModel {
    constructor() {
        this._projects = new Array();
    }
    get list() {
        return this._projects;
    }
    async load() {
        let projects;
        try {
            projects = await async.readJSONLocal("hiera-editor-project-list.json");
        }
        catch (e) {
            return false;
        }
        if (projects && projects.recents) {
            for (let data of projects.recents) {
                const project = new ProjectModel();
                try {
                    await project.load(data);
                }
                catch (e) {
                    console.error("Failed to load workspace: " + e.message);
                    continue;
                }
                this._projects.push(project);
            }
            return true;
        }
        return false;
    }
    async save() {
        const root = [];
        for (let project of this._projects) {
            root.push(project.dump());
        }
        await async.writeJSONLocal("hiera-editor-project-list.json", {
            "recents": root
        });
    }
    getProject(projectPath) {
        for (let project of this._projects) {
            if (project.path == projectPath)
                return project;
        }
        return null;
    }
    hasProject(projectPath) {
        for (let project of this._projects) {
            if (project.path == projectPath)
                return true;
        }
        return false;
    }
    async addProject(projectPath) {
        if (this.hasProject(projectPath))
            return false;
        const workspace = new puppet_1.puppet.Workspace(projectPath);
        await workspace.load();
        const newProject = new ProjectModel(projectPath, workspace);
        this._projects.push(newProject);
        await this.save();
        return true;
    }
    removeProject(project) {
        const index = this._projects.indexOf(project);
        if (index < 0)
            return;
        delete this._projects[index];
    }
}
exports.ProjectsModel = ProjectsModel;
//# sourceMappingURL=projects.js.map