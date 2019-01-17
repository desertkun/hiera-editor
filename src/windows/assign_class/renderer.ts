
import { IPC } from "../../ipc/client";
import { ipcRenderer } from 'electron';

const $ = require("jquery");
const ellipsis = require('text-ellipsis');
const remote = require('electron').remote;

const ipc = IPC();

let renderer: AssignClassRenderer;

class AssignClassRenderer
{
    private environment: string;
    private certname: string;
    private searchTimer: any;
    private searchResults: any;
    private searching: boolean;

    constructor(environment: string, certname: string)
    {
        this.environment = environment;
        this.certname = certname;
    }

    private renderNoResults(): void
    {
        this.searchResults.html('<div class="search-result-message"><span><i class="fas fa-question"></i> Search yielded no results</span></div>');
    }

    private selectEntry(classInfo: any)
    {
        if (classInfo.tags["api"] == "private") {
            if (!confirm("The class you are about to add is marked as api private. " +
                "That means it is not meant to be used directly by end user. Are you sure?"))
            {
                return;
            }
        }

        ipcRenderer.send("class-selected", classInfo.name);
    }

    private renderSearchResults(results: Array<any>): void
    {
        const zis = this;

        this.searchResults.html('').scrollTop(0);

        for (const classInfo of results)
        {
            const entry = $('<a class="search-result-entry w-100"></a>').appendTo(this.searchResults).click(() => {
                zis.selectEntry(classInfo);
            })

            // icon
            {
                const icon = $('<span class="search-result-icon"></span>').appendTo(entry);

                if (classInfo.options.icon != null)
                {
                    $('<img src="' + classInfo.options.icon + '">').appendTo(icon);
                }
                else
                {
                    $('<i class="fas fa-2x fa-puzzle-piece"></i>').appendTo(icon);
                }
            }
                
            if (classInfo.tags["api"] == "private")
            {
                entry.addClass("api-private");
                $('<span class="badge badge-secondary">private</span>').appendTo(entry);
            }

            // name
            {
                const name = $('<span class="search-result-name">' + classInfo.name + '</span>').appendTo(entry);
            }

        }
    }

    private renderIntro(): void
    {
        this.searchResults.html('<div class="search-result-message"><span class="text-muted">Start searching classes by typing class name</span></div>');
    }

    private async searchClasses()
    {
        this.searching = true;

        try
        {
            const search = $("#class-name-filter").val();

            if (!search)
            {
                this.renderIntro();
                return;
            }

            const results = await ipc.searchClasses(this.environment, this.certname, search);

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

        $("#class-name-filter").on("change keyup paste", () => 
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
                zis.searchClasses();
            }, 200);

        });

        document.addEventListener('keydown', event => 
        {
            if (event.key === 'Escape' || event.keyCode === 27) 
            {
                window.close();
            }
        });

        $('#cancel').click(() => 
        {
            window.close();
        });

        this.renderIntro();
    }
    
}

// @ts-ignore
window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
};

ipcRenderer.on('init', function (event: any, environment: string, certname: string) 
{
    renderer = new AssignClassRenderer(environment, certname);
    renderer.init();
});
