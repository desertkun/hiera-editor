System.register(["process", "path", "./async"], function (exports_1, context_1) {
    "use strict";
    var process, path, async, puppet;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (process_1) {
                process = process_1;
            },
            function (path_1) {
                path = path_1;
            },
            function (async_1) {
                async = async_1;
            }
        ],
        execute: function () {
            (function (puppet) {
                class Ruby {
                    static Path() {
                        if (process.platform == "darwin") {
                            return require('traveling-ruby-osx');
                        }
                        if (process.platform == "win32") {
                            return require('traveling-ruby-win32');
                        }
                        if (process.platform == "linux") {
                            return require('traveling-ruby-linux-x86_64');
                        }
                        return null;
                    }
                    static Call(script, args, cwd) {
                        const rubyScript = require('app-root-path').resolve(path.join("ruby", script));
                        const argsTotal = [];
                        argsTotal.push(rubyScript);
                        for (let arg of args) {
                            argsTotal.push(arg);
                        }
                        return async.execFile(Ruby.Path(), argsTotal, cwd);
                    }
                }
                puppet.Ruby = Ruby;
                class Workspace {
                    constructor(path) {
                        this._path = path;
                    }
                    get path() {
                        return this._path;
                    }
                    get name() {
                        return this._name;
                    }
                    async listEnvironments() {
                        const environmentsPath = path.join(this._path, "environments");
                        if (!await async.fileExists(environmentsPath)) {
                            return [];
                        }
                        const dirs = await async.listFiles(environmentsPath);
                        const result = [];
                        for (const dirname of dirs) {
                            const dir = path.join(environmentsPath, dirname);
                            if (!await async.isDirectory(dir))
                                continue;
                            result.push(dirname);
                        }
                        return result;
                    }
                    async validate() {
                        const environmentsPath = path.join(this._path, "environments");
                        if (!await async.fileExists(environmentsPath)) {
                            throw new Error("The path does not appear to be a puppet root code folder. " +
                                "The puppet root code folder should contain the \"environments\" folder inside.");
                        }
                        const confPath = path.join(this._path, "environment.conf");
                        if (!await async.fileExists(confPath)) {
                            throw new Error("The path does not appear to be a puppet root code folder. " +
                                "The puppet root code folder should contain the \"environment.conf\" file inside.");
                        }
                    }
                    async load() {
                        await this.validate();
                        const workspaceFilePath = path.join(this._path, "workspace.json");
                        const exists = await async.fileExists(workspaceFilePath);
                        if (!exists) {
                            this._name = path.basename(this._path);
                            return true;
                        }
                        let data;
                        try {
                            data = await async.readJSON(workspaceFilePath);
                        }
                        catch (e) {
                            return new Error("Failed to load workspace: " + e.message);
                        }
                        if (!data) {
                            return new Error("Failed to load workspace: corrupted.");
                        }
                        this._name = data["name"];
                        return (this._name != null);
                    }
                    dump() {
                        return {
                            "name": this._name
                        };
                    }
                }
                puppet.Workspace = Workspace;
                class Environment {
                    constructor(name, path) {
                        this._name = name;
                        this._path = path;
                    }
                    get name() {
                        return this._name;
                    }
                    get path() {
                        return this._path;
                    }
                }
                puppet.Environment = Environment;
                class Node {
                    constructor(name) {
                        this._name = name;
                    }
                    get name() {
                        return this._name;
                    }
                }
                puppet.Node = Node;
                class Class {
                    constructor(name) {
                        this._name = name;
                    }
                    get name() {
                        return this._name;
                    }
                }
                puppet.Class = Class;
            })(puppet || (puppet = {}));
            exports_1("puppet", puppet);
        }
    };
});
//# sourceMappingURL=puppet.js.map