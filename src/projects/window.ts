
import { Window } from "../window"

export class ProjectsWindow extends Window
{
    constructor ()
    {
        super();

        this.init();
    }

    public show()
    {
        this.openWindow(600, 400, "projects.html", null, {
            "resizable": false
        });
    }

    private init()
    {
        //const a = JSON.stringify(["*/manifests/**/*.pp", "*/functions/**/*.pp", "*/types/**/*.pp", "*/lib/**/*.rb"])
        //const b = "out.json"
        //puppet.Ruby.Call("puppet-strings.rb", [a, b], "/Users/desertkun/Documents/Work/anthill-puppet-dev/modules")
    }
}