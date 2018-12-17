
// types
import { BrowserWindow, BrowserView } from "electron";

// globals
import { app } from "electron";

import * as path from "path";
import * as url from "url";

const windowStateKeeper = require('electron-window-state');

type OnWindowClosedCallback = () => void;
type BrowserWindowLoaded = (window: BrowserWindow) => void;

export abstract class Window
{
    private _state: any;
    private _window: BrowserWindow;
    private _onClosed: OnWindowClosedCallback;

    constructor()
    {

    }

    protected openWindow(defaultWidth: number, defaultHeight: number, htmlName: string, stateName: string, options: any = {}, 
        onLoaded: BrowserWindowLoaded = null)
    {
        if (stateName != null)
        {
            this._state = windowStateKeeper({
                defaultWidth: defaultWidth,
                defaultHeight: defaultHeight,
                file: "hiera-editor-" + stateName
            });

            options['x'] = this._state.x;
            options['y'] = this._state.y;
            options['width'] = this._state.width;
            options['height'] = this._state.height;

            this._window = new BrowserWindow(options);

            this._state.manage(this._window);
        }
        else
        {
            this._state = null;    

            options['width'] = defaultWidth;
            options['height'] = defaultHeight;

            this._window = new BrowserWindow(options);
        }

        this.load(htmlName);

        this._window.on("closed", () => 
        {
            this.closed();
            
            if (this._onClosed != null)
            {
                this._onClosed();
            }
        });

        if (onLoaded)
        {
            const zis = this;
            this._window.webContents.once("did-finish-load", () => {
                onLoaded.apply(zis, [zis._window]);
            });
        }
    }

    public load(htmlName: string)
    {
        this._window.loadURL(url.format({
            pathname: path.join(app.getAppPath(), "html", htmlName),
            protocol: "file:",
            slashes: true,
        }));
    }

    public close(): void
    {
        if (this._window == null)
            return;

        this._window.destroy();
        this._window = null;
    }

    protected closed(): void
    {
        //
    }

    public get browserWindow(): BrowserWindow
    {
        return this._window;
    }

    public set onClosed(callback: OnWindowClosedCallback)
    {
        this._onClosed = callback;
    }
}