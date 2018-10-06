"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
function fileExists(path) {
    return new Promise((resolve, reject) => {
        fs.stat(path, (err) => {
            resolve(err == null);
        });
    });
}
exports.fileExists = fileExists;
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
exports.isDirectory = isDirectory;
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
exports.isFile = isFile;
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
exports.listFiles = listFiles;
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
exports.execFile = execFile;
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
exports.readJSON = readJSON;
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
exports.writeJSON = writeJSON;
function readJSONLocal(filePath) {
    return readJSON(path.join(electron_1.app.getPath("userData"), filePath));
}
exports.readJSONLocal = readJSONLocal;
function writeJSONLocal(filePath, data) {
    return writeJSON(path.join(electron_1.app.getPath("userData"), filePath), data);
}
exports.writeJSONLocal = writeJSONLocal;
//# sourceMappingURL=async.js.map