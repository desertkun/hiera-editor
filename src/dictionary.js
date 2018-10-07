System.register([], function (exports_1, context_1) {
    "use strict";
    var Dictionary;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [],
        execute: function () {
            Dictionary = class Dictionary {
                constructor() {
                    this.internalDict = {};
                }
                getKeys() {
                    let keys = [];
                    for (let key in this.internalDict) {
                        keys.push(key);
                    }
                    return keys;
                }
                getValues() {
                    let vals = [];
                    for (let key in this.internalDict) {
                        vals.push(this.internalDict[key]);
                    }
                    return vals;
                }
                get(key) {
                    return this.internalDict[key];
                }
                has(key) {
                    return this.internalDict[key] != null;
                }
                put(key, val) {
                    this.internalDict[key] = val;
                }
                remove(key) {
                    delete this.internalDict[key];
                }
            };
            exports_1("Dictionary", Dictionary);
        }
    };
});
//# sourceMappingURL=dictionary.js.map