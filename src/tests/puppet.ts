
const assert = require('assert');
const rmdir = require('rimraf');

import * as path from "path";
import * as tmp from "tmp";
import { puppet } from "../puppet";

const async = require("../async");
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
chai.use(chaiAsPromised);

import 'mocha';

function getWorkspacePath(name: string)
{
    return path.join(__dirname, "../../tests/workspaces/" + name);
}

type WorkspaceTestCallback = (workspace: puppet.Workspace,
                              environment: puppet.Environment,
                              node: puppet.Node) => Promise<any>;

async function testRealWorkspace(workspaceName: string, environmentName: string, nodeName: string,
                             f: WorkspaceTestCallback = null): Promise<puppet.Node>
{
    const d = tmp.dirSync();

    try
    {
        const workspace = new puppet.Workspace(getWorkspacePath(workspaceName), d.name);
        await workspace.refresh();
        const environment = await workspace.getEnvironment(environmentName);
        await environment.refresh();
        const node = await environment.root.getNode(nodeName);
        if (f)
        {
            return await f(workspace, environment, node);
        }
        return node;
    }
    finally
    {
        rmdir(d.name, function(e: any){});
    }
}

async function testSimpleWorkspace(files: any, nodeYAML: any,
                             f: WorkspaceTestCallback = null): Promise<puppet.Node>
{
    const d = tmp.dirSync();

    try
    {
        await async.makeDirectory(path.join(d.name, "modules"));
        await async.makeDirectory(path.join(d.name, "modules", "test"));
        const _m = path.join(d.name, "modules", "test", "manifests");
        await async.makeDirectory(_m);

        for (const fileName in files)
        {
            await async.write(path.join(_m, fileName), files[fileName]);
        }

        await async.makeDirectory(path.join(d.name, "environments"));
        await async.makeDirectory(path.join(d.name, "environments", "dev"));
        const _d = path.join(d.name, "environments", "dev", "data");
        await async.makeDirectory(_d);
        await async.writeYAML(path.join(_d, "test.yaml"), nodeYAML);
    }
    catch (e)
    {
        throw Error("Failed to init simple workspace: " + e);
    }

    try
    {
        const workspace = new puppet.Workspace(d.name);
        await workspace.refresh();
        const environment = await workspace.getEnvironment("dev");
        await environment.refresh();
        const node = await environment.root.getNode("test");
        if (f)
        {
            return await f(workspace, environment, node);
        }
        return node;
    }
    finally
    {
        rmdir(d.name, function(e: any){});
    }
}

describe('Workspaces', () =>
{
    it('missing directory', () =>
    {
        return expect(testRealWorkspace("missing...", "dev", "test")).to.be.rejectedWith(puppet.WorkspaceError);
    });

    it('minimal workspace', () =>
    {
        return testRealWorkspace("minimal", "dev", "test", async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            const class_ = await node.acquireClass("test");
            expect(class_.name).to.equal("test");
        });
    });

    it('workspace with body params', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test {
                  $test_string = "testing"
                  $test_number = 234
                  $test_boolean = true
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            const class_ = await node.acquireClass("test");
            expect(class_.getResolvedProperty("test_string").value).to.equal("testing");
            expect(class_.getResolvedProperty("test_number").value).to.equal(234);
            expect(class_.getResolvedProperty("test_boolean").value).to.equal(true);
        });
    });

    it('simplest params pattern', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test (
                    String $test_string = $test::params::a_string,
                    Number $test_number = $test::params::a_number,
                    Boolean $test_boolean = $test::params::a_boolean,
                ) inherits test::params {}
            `,
            "params.pp": `
                class test::params {
                  $a_string = "testing"
                  $a_number = 234
                  $a_boolean = true
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            const class_ = await node.acquireClass("test");
            const a = class_.getResolvedProperty("test_string");
            expect(a.type).to.equal("String");
            expect(a.value).to.equal("testing");
            const b = class_.getResolvedProperty("test_number");
            expect(b.type).to.equal("Number");
            expect(b.value).to.equal(234);
            const c = class_.getResolvedProperty("test_boolean");
            expect(c.type).to.equal("Boolean");
            expect(c.value).to.equal(true);
        });
    });
});

