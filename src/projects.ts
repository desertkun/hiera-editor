
import * as path from "path"
import * as async from "./async"
import { Workspace } from "./puppet/workspace"

export class ProjectModel
{
    private _path: string;
    private _workspace: Workspace;

    constructor(path?: string, workspace?: Workspace)
    {
        this._path = path;
        this._workspace = workspace;
    }

    public get path():string 
    {
        return this._path;
    }

    public get workspace(): Workspace 
    {
        return this._workspace;
    }

    public set path(path: string)
    {
        this._path = path;
    }

    public async load(data: any)
    {
        this._path = data["path"];

        if (!this._path)
        {
            throw new Error("No path registered within workspace.");
        }

        if (!await async.fileExists(this._path))
        {
            throw new Error("No such workspace: " + this._path);
        }
        
        this._workspace = new Workspace(this._path);
        return await this._workspace.load();
    }

    public dump(): any
    {
        return {
            "path": this._path
        }
    }
}

export class ProjectsModel
{
    private readonly _projects: Array<ProjectModel>;

    constructor ()
    {
        this._projects = [];
    }

    public get list(): Array<ProjectModel>
    {
        return this._projects;
    }

    public async load()
    {
        let projects;

        try
        {
            projects = await async.readJSONLocal("hiera-editor-project-list.json");
        }
        catch (e)
        {
            return false;
        }

        if (projects && projects.recents)
        {
            for (let data of projects.recents)
            {
                const project = new ProjectModel();

                try
                {
                    await project.load(data);
                }
                catch (e)
                {
                    console.error("Failed to load workspace: " + e.message);
                    continue;
                }
                
                this._projects.push(project);
            }

            return true;
        }

        return false;
    }

    public async save()
    {
        const root: any = [];

        for (let project of this._projects)
        {
            root.push(project.dump());
        }

        await async.writeJSONLocal("hiera-editor-project-list.json", {
            "recents": root
        });
    }

    public getProject(projectPath: string): ProjectModel
    {
        for (let project of this._projects)
        {
            if (project.path == projectPath)
                return project;
        }

        return null;
    }

    public hasProject(projectPath: string): boolean
    {
        for (let project of this._projects)
        {
            if (project.path == projectPath)
                return true;
        }

        return false;
    }

    public async createProject(projectPath: string, env: string)
    {
        if (this.hasProject(projectPath))
            return false;
            
        if (!await async.isDirectory(projectPath))
            return false;

        if (!await async.writeFile(path.join(projectPath, "environment.conf"), "modulepath = modules"))
            return false;

        if (!await async.createDirectory(path.join(projectPath, "environments")))
            return false;
            
        const envPath = path.join(projectPath, "environments", env);
        if (!await async.createDirectory(envPath))
            return false;

        if (!await async.createDirectory(path.join(envPath, "data")))
            return false;
        
        if (!await async.createDirectory(path.join(envPath, "manifests")))
            return false;
        
        if (!await async.createDirectory(path.join(envPath, "modules")))
            return false;
    
        if (!await async.writeFile(path.join(envPath, "environment.conf"), "modulepath = modules:../../modules"))
            return false;

        if (!await async.writeYAML(path.join(envPath, "hiera.yaml"), {
            "version": 5,
            "hierarchy": [
                {
                    "name": "Nodes",
                    "path": "nodes/%{trusted.certname}.yaml"
                },
                {
                    "name": "common",
                    "path": "common.yaml"
                }
            ],
            "defaults": {
                "data_hash": "yaml_data"
            }
        })) {
            return false;
        }

        if (!await async.writeFile(path.join(envPath, "manifests", "init.pp"), "include hieraresources"))
            return false;

        if (!await async.createDirectory(path.join(projectPath, "modules")))
            return false;

        const workspace = new Workspace(projectPath);

        await workspace.load();

        const newProject: ProjectModel = new ProjectModel(projectPath, workspace);
        this._projects.push(newProject);

        await this.save();

        return true;
    }

    public async addProject(projectPath: string)
    {
        if (this.hasProject(projectPath))
            return false;

        const workspace = new Workspace(projectPath);

        await workspace.load();

        const newProject: ProjectModel = new ProjectModel(projectPath, workspace);
        this._projects.push(newProject);

        await this.save();

        return true;
    }

    public removeProject(project: ProjectModel)
    {
        const index: number = this._projects.indexOf(project);

        if (index < 0)
            return;
        
        delete this._projects[index];
    }
}