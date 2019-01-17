
import { IPC } from "../../ipc/client";
import { ipcRenderer } from 'electron';

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;

const ipc = IPC();

let renderer: CreateResourceRenderer;

class CreateResourceRenderer
{
    private environment: string;
    private certname: string;
    private definedTypeName: string;
    private searchTimer: any;
    private searchResults: any;
    private searching: boolean;

    constructor(environment: string, certname: string, definedTypeName?: string)
    {
        this.environment = environment;
        this.certname = certname;
        this.definedTypeName = definedTypeName;
    }

    private renderNoResults(): void
    {
        this.searchResults.html('<div class="search-result-message"><span><i class="fas fa-question"></i> Search yielded no results</span></div>');
    }

    private selectEntry(definedTypeInfo: any)
    {
        if (definedTypeInfo.tags["api"] == "private") {
            if (!confirm("The resource you are about to create is marked as api private. " +
                "That means it is not meant to be used directly by end user. Are you sure?"))
            {
                return;
            }
        }

        ipcRenderer.send("resource-selected", definedTypeInfo.name);
    }

    private renderSearchResults(results: Array<any>): void
    {
        const zis = this;

        this.searchResults.html('').scrollTop(0);

        for (const definedTypeInfo of results)
        {
            const entry = $('<a class="search-result-entry w-100"></a>').appendTo(this.searchResults).click(() => {
                zis.selectEntry(definedTypeInfo);
            })

            // icon
            {
                const icon = $('<span class="search-result-icon"></span>').appendTo(entry);

                if (definedTypeInfo.options.icon != null)
                {
                    $('<img src="' + definedTypeInfo.options.icon + '">').appendTo(icon);
                }
                else
                {
                    $('<i class="far fa-2x fa-clone"></i>').appendTo(icon);
                }
            }
                
            if (definedTypeInfo.tags["api"] == "private")
            {
                entry.addClass("api-private");
                $('<span class="badge badge-secondary">private</span>').appendTo(entry);
            }

            // name
            {
                const name = $('<span class="search-result-name">' + definedTypeInfo.name + '</span>').appendTo(entry);
            }

        }
    }

    private renderIntro(): void
    {
        this.searchResults.html('<div class="search-result-message"><span class="text-muted">Start searching defined types by typing type name</span></div>');
    }

    private async searchDefinedTypes()
    {
        this.searching = true;

        try
        {
            const search = $("#resource-name-filter").val();

            if (!search)
            {
                this.renderIntro();
                return;
            }

            const results = await ipc.searchDefinedTypes(this.environment, this.certname, search);

            if (results.length > 0)
            {
                this.renderSearchResults(results);
            }
            else
            {
                this.renderNoResults();
            }
        }
        finally
        {
            this.searching = false;
        }
    }

    public async init()
    {
        this.searchResults = $("#search-results");

        const zis = this;

        $("#resource-name-filter").on("change keyup paste", () => 
        {
            if (zis.searching)
                return;

            if (zis.searchTimer)
            {
                clearTimeout(zis.searchTimer);
            }

            zis.searchTimer = setTimeout(() => 
            {
                zis.searchTimer = null;
                zis.searchDefinedTypes();
            }, 200);

        });

        $('#cancel').click(() => 
        {
            window.close();
        });

        document.addEventListener('keydown', event => 
        {
            if (event.key === 'Escape' || event.keyCode === 27) 
            {
                window.close();
            }
        });

        this.renderIntro();
    }
    
}

// @ts-ignore
window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
};

ipcRenderer.on('init', function (event: any, nodePath: string, definedTypeName: string) 
{
    renderer = new CreateResourceRenderer(nodePath, definedTypeName);
    renderer.init();
});
