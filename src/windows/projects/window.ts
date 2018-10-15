
import { Window } from "../window"

export class ProjectsWindow extends Window
{
    constructor ()
    {
        super();
    }

    public show()
    {
        this.openWindow(600, 400, "projects.html", null, {
            "resizable": false
        });
    }

}