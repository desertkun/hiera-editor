
import { IPC } from "../../ipc/client";
import { ipcRenderer, ipcMain } from 'electron';

const $ = require("jquery");
const electron = require('electron');

const ipc = IPC();

let renderer: SetupWorkspaceRenderer;

abstract class SetupStep
{
    private name: string;
    private timer: number;
    private timerId: NodeJS.Timer;
    private elementId: string;
    private first: boolean;

    public async abstract next(): Promise<SetupStep>;

    public async init(): Promise<void>
    {
        $('#setup-step-title').text(this.name);
        $('#' + this.elementId + "-content").show();

        this.progress();
    }
    
    public release()
    {
        $('#' + this.elementId + "-content").hide();
    }

    protected progress()
    {
        this.enableNext(false);
        $('#' + this.elementId).removeClass("text-muted").addClass("text-warning");

        if (!this.first)
        {
            $('#' + this.elementId + "-line").addClass("step-iteration-progress");
        }
    }

    public fail(text: string)
    {
        $('#setup-step-title').text(this.name + ": Failed").addClass("text-danger");
        $('#' + this.elementId).removeClass("text-warning").addClass("text-danger");

        if (!this.first)
        {
            $('#' + this.elementId + "-line").removeClass("step-iteration-progress").addClass("step-iteration-fail");
        }

        this.release();

        $('#setup-error-text').html(text);
        $('#setup-error').show();

        $('#btn-configuration-next').hide();
        $('#btn-configuration-retry').show();
        $('#btn-configuration-close').show();
    }

    public async retry(): Promise<SetupStep>
    {
        $('#setup-step-title').text(this.name).removeClass("text-danger");
        $('#' + this.elementId).removeClass("text-danger");

        if (!this.first)
        {
            $('#' + this.elementId + "-line").removeClass("step-iteration-fail");
        }

        $('#btn-configuration-retry').hide();
        $('#btn-configuration-close').hide();
        $('#btn-configuration-next').show();
        $('#setup-error').hide();

        await this.init();
        return await this.next();
    }

    protected nextTimer()
    {
        this.timer = 15;
        
        $('#btn-configuration-next').attr("disabled", "disabled");

        const zis = this;

        this.timerId = setInterval(() => 
        {
            zis.timer--;
            if (zis.timer <= 0)
            {
                clearInterval(zis.timerId);
                $('#btn-configuration-next').text("Next");
                $('#btn-configuration-next').attr("disabled", null);
            }
            else
            {
                
                $('#btn-configuration-next').text("Next (" + zis.timer + ")");
            }
        }, 1000);
        
    }

    protected complete()
    {
        $('#btn-configuration-next').hide();
        $('#btn-configuration-complete').show();
    }

    protected enableNext(next: boolean)
    {
        if (next)
        {
            $('#btn-configuration-next').attr("disabled", null);
        }
        else
        {
            $('#btn-configuration-next').attr("disabled", "disabled");
        }
    }

    public success()
    {
        $('#' + this.elementId).removeClass("text-warning").addClass("text-success");

        if (!this.first)
        {
            $('#' + this.elementId + "-line").removeClass("step-iteration-progress").addClass("step-iteration-success");
        }
    }

    constructor(name: string, elementId: string, first: boolean)
    {
        this.name = name;
        this.elementId = elementId;
        this.first = first;
    }
}

class ConfigurationStep extends SetupStep
{
    private server: string;
    private certname: string;

    constructor(server: string, certname: string)
    {
        super("Step 1. Configuration", "setup-step-1", true);

        this.server = server;
        this.certname = certname;
    }

    public async next(): Promise<SetupStep>
    {
        return new CSRStep(this.server, this.certname);
    }

    private checkNext()
    {
        this.certname = $('#puppet-certname').val();
        this.server = $('#puppet-server').val();
        
        this.enableNext(this.server != "" && this.certname != "");
    }
    
    public async init(): Promise<void>
    {
        await super.init();

        if (this.server)
            $('#puppet-server').val(this.server);

        if (this.certname)
            $('#puppet-certname').val(this.certname);

        const zis = this;

        $('#puppet-server').on("input", () => {
            zis.checkNext();
        });

        $('#puppet-certname').on("input", () => {
            zis.checkNext();
        });

        this.enableNext(this.server != null && this.certname != null);
    }
}

class CSRStep extends SetupStep
{
    private server: string;
    private certname: string;

    constructor(server: string, certname: string)
    {
        super("Step 2. Requesting Certificate", "setup-step-2", false);

        this.server = server;
        this.certname = certname;
    }

    public async next(): Promise<SetupStep>
    {
        return null;
    }
    
    public async init(): Promise<void>
    {
        await super.init();
        this.enableNext(false);

        let fingerprint;

        try
        {
            fingerprint = await ipc.publishCSR(this.server, this.certname);
        }
        catch (e)
        {
            const text = e.toString();
            if (text.indexOf("Bad Request") >= 0)
            {
                this.fail("Cannot upload certificate signing request. Please make sure there is no such certificate already requested. " + 
                "If so, pick another name or remove previous certificate request. <br><br>You can do this by calling <br>" + 
                "<code>/opt/puppetlabs/puppet/bin/puppet cert clean " + this.certname + "</code><br>on the Puppet Server.");
            }
            else
            {
                this.fail(text);
            }
            return;
        }

        this.success();
        renderer.setStep(new SignRequestStep(this.server, this.certname, fingerprint));
    }
}

class SignRequestStep extends SetupStep
{
    private server: string;
    private certname: string;
    private fingerprint: string;

    constructor(server: string, certname: string, fingerprint: string)
    {
        super("Step 3. Sign Requested Certificate", "setup-step-3", false);

        this.server = server;
        this.certname = certname;
        this.fingerprint = fingerprint;
    }

    public async next(): Promise<SetupStep>
    {
        return new DownloadCertificateStep(this.server, this.certname);
    }
    
    public async init(): Promise<void>
    {
        await super.init();

        $('#crs-sign-example').text("/opt/puppetlabs/puppet/bin/puppet cert sign " + this.certname);

        if (this.fingerprint)
        {
            $('#crs-fingerprint-check').text("/opt/puppetlabs/puppet/bin/puppet cert list " + this.certname);
            $('#crs-fingerprint-value').text(this.fingerprint);
            $('#crs-fingerprint').show();
        }
        
        this.nextTimer();
    }
}

class DownloadCertificateStep extends SetupStep
{
    private server: string;
    private certname: string;

    constructor(server: string, certname: string)
    {
        super("Step 4. Downloading Signed Certificate", "setup-step-4", false);

        this.server = server;
        this.certname = certname;
    }

    public async next(): Promise<SetupStep>
    {
        return null;
    }
    
    public async init(): Promise<void>
    {
        await super.init();
        this.enableNext(false);

        try
        {
            await ipc.downloadSignedCertificate();
        }
        catch (e)
        {
            const text = e.toString();
            this.fail(text);
            return;
        }

        this.success();
        renderer.setStep(new AuthStep(this.server, this.certname));
    }
}

class AuthStep extends SetupStep
{
    private server: string;
    private certname: string;

    constructor(server: string, certname: string)
    {
        super("Step 5. Authenticate Hiera Editor", "setup-step-5", false);

        this.server = server;
        this.certname = certname;
    }

    public async next(): Promise<SetupStep>
    {
        return null;
    }
    
    public async init(): Promise<void>
    {
        await super.init();

        $('#auth-conf-example').html(this.certname);

        this.complete();
    }
}

class SetupWorkspaceRenderer
{
    private step: SetupStep;

    constructor(server: string, certname: string)
    {
        this.setStep(new ConfigurationStep(server, certname));
    }

    public async setStep(step: SetupStep)
    {
        if (this.step != null)
        {
            this.step.release();
        }

        this.step = step;

        try
        {
            await this.step.init();
        }
        catch (e)
        {
            this.step.fail(e.toString());
        }
    }

    public async init()
    {
        $('[data-toggle="tooltip"]').tooltip();

        const zis = this;

        $('#btn-configuration-close').click(() => {
            window.close();
        });

        $('#btn-configuration-complete').click(() => 
        {
            ipcRenderer.send("setup-complete");
        });        

        $('#btn-configuration-retry').click(async () => 
        {
            const current = zis.step;
            let next;

            try
            {
                next = await current.retry();
            }
            catch (e)
            {
                current.fail(e.toString());
                return;
            }

            current.success();

            if (next != null)
            {
                await zis.setStep(next);
            }
        });

        $('#btn-configuration-next').click(async () => 
        {
            const current = zis.step;
            let next;

            try
            {
                next = await current.next();
            }
            catch (e)
            {
                current.fail(e.toString());
                return;
            }

            current.success();

            if (next != null)
            {
                await zis.setStep(next);
            }
        });
        
    }
}

// @ts-ignore
window.eval = global.eval = function () {
    throw new Error(`Sorry, this app does not support window.eval().`)
};

ipcRenderer.on('init', function (event: any, server: string, certname: string)
{
    renderer = new SetupWorkspaceRenderer(server, certname);
    renderer.init();
});
