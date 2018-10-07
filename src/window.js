System.register(["electron", "path", "url"], function (exports_1, context_1) {
    "use strict";
    var electron_1, path, url, windowStateKeeper, Window;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (electron_1_1) {
                electron_1 = electron_1_1;
            },
            function (path_1) {
                path = path_1;
            },
            function (url_1) {
                url = url_1;
            }
        ],
        execute: function () {
            windowStateKeeper = require('electron-window-state');
            Window = class Window {
                constructor() {
                }
                openWindow(defaultWidth, defaultHeight, htmlName, stateName, options = {}) {
                    if (stateName != null) {
                        this._state = windowStateKeeper({
                            defaultWidth: defaultWidth,
                            defaultHeight: defaultHeight,
                            file: "hiera-editor-" + stateName
                        });
                        options['x'] = this._state.x;
                        options['y'] = this._state.y;
                        options['width'] = this._state.width;
                        options['height'] = this._state.height;
                        this._window = new electron_1.BrowserWindow(options);
                        this._state.manage(this._window);
                    }
                    else {
                        this._state = null;
                        options['width'] = defaultWidth;
                        options['height'] = defaultHeight;
                        this._window = new electron_1.BrowserWindow(options);
                    }
                    this.load(htmlName);
                    this._window.on("closed", () => {
                        this.closed();
                        if (this._onClosed != null) {
                            this._onClosed();
                        }
                    });
                }
                load(htmlName) {
                    this._window.loadURL(url.format({
                        pathname: path.join(__dirname, "../html/" + htmlName),
                        protocol: "file:",
                        slashes: true,
                    }));
                }
                close() {
                    if (this._window == null)
                        return;
                    this._window.close();
                    this._window = null;
                }
                closed() {
                }
                get browserWindow() {
                    return this._window;
                }
                set onClosed(callback) {
                    this._onClosed = callback;
                }
            };
            exports_1("Window", Window);
        }
    };
});
//# sourceMappingURL=window.js.map