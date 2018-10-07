System.register(["electron", "fs", "path", "child_process"], function (exports_1, context_1) {
    "use strict";
    var electron_1, fs, path, child_process;
    var __moduleName = context_1 && context_1.id;
    function fileExists(path) {
        return new Promise((resolve, reject) => {
            fs.stat(path, (err) => {
                resolve(err == null);
            });
        });
    }
    exports_1("fileExists", fileExists);
    function isDirectory(path) {
        return new Promise((resolve, reject) => {
            fs.lstat(path, (err, stats) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(stats.isDirectory());
                }
            });
        });
    }
    exports_1("isDirectory", isDirectory);
    function isFile(path) {
        return new Promise((resolve, reject) => {
            fs.lstat(path, (err, stats) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(stats.isFile());
                }
            });
        });
    }
    exports_1("isFile", isFile);
    function listFiles(path) {
        return new Promise((resolve, reject) => {
            fs.readdir(path, (err, files) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(files);
                }
            });
        });
    }
    exports_1("listFiles", listFiles);
    function execFile(path, args, cwd) {
        return new Promise((resolve, reject) => {
            const options = {
                'cwd': cwd,
                'maxBuffer': 1024000
            };
            child_process.execFile(path, args, options, (error, stdout, stderr) => {
                resolve(error == null);
            });
        });
    }
    exports_1("execFile", execFile);
    function readJSON(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, "UTF-8", (error, data) => {
                if (error) {
                    reject(error);
                }
                else {
                    let parsed;
                    try {
                        parsed = JSON.parse(data);
                        resolve(parsed);
                    }
                    catch (e) {
                        reject(e);
                    }
                }
            });
        });
    }
    exports_1("readJSON", readJSON);
    function writeJSON(filePath, data) {
        return new Promise((resolve, reject) => {
            let dumped;
            try {
                dumped = JSON.stringify(data);
            }
            catch (e) {
                reject(e);
                return;
            }
            fs.writeFile(filePath, dumped, "UTF-8", (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    exports_1("writeJSON", writeJSON);
    function readJSONLocal(filePath) {
        return readJSON(path.join(electron_1.app.getPath("userData"), filePath));
    }
    exports_1("readJSONLocal", readJSONLocal);
    function writeJSONLocal(filePath, data) {
        return writeJSON(path.join(electron_1.app.getPath("userData"), filePath), data);
    }
    exports_1("writeJSONLocal", writeJSONLocal);
    return {
        setters: [
            function (electron_1_1) {
                electron_1 = electron_1_1;
            },
            function (fs_1) {
                fs = fs_1;
            },
            function (path_1) {
                path = path_1;
            },
            function (child_process_1) {
                child_process = child_process_1;
            }
        ],
        execute: function () {
        }
    };
});
//# sourceMappingURL=async.js.map