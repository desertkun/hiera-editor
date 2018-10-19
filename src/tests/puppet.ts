
const assert = require('assert');
const rmdir = require('rimraf');

import * as path from "path";
import * as tmp from "tmp";
import { puppet } from "../puppet";
import {PuppetASTAccess, PuppetASTPrimitive, PuppetASTQualifiedName, PuppetASTType} from "../puppet/ast";

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

    it('compilation error', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                $%@%+@*$ _&(FHW_ +{@#}UH
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            await expect(node.acquireClass("test")).to.be.rejectedWith(puppet.CompilationError);
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

    it('concatenation', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test {
                  $test_a = "Hello"
                  $test_b = "World"
                  $v = "$\{test_a\}, $\{test_b\}!"
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            const class_ = await node.acquireClass("test");
            expect(class_.getResolvedProperty("v").value).to.equal("Hello, World!");
        });
    });

    it('global', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test {
                  $v = "Hello, $\{::hostname\}!"
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            node.global.put("hostname", "myhost");
            const class_ = await node.acquireClass("test");
            expect(class_.getResolvedProperty("v").value).to.equal("Hello, myhost!");
        });
    });

    it('resources', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test {
                  notice { "hello": }
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            await node.acquireClass("test");
        });
    });

    it('keyed entries', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test {
                  notice { "hello": 
                    name => "hello",
                    ensure => present
                  }
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            await node.acquireClass("test");
        });
    });

    it('default entries', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test {
                  notice { "hello": 
                    ensure => def
                  }
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            await node.acquireClass("test");
        });
    });

    it('order chains', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test {
                  notice { "hello": 
                  } -> notice { "hello2": 
                  } -> notice { "hello3": 
                  } ~> notice { "hello4": 
                  }
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            await node.acquireClass("test");
        });
    });

    it('enums', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test (
                    Enum['info', 'error', 'warning'] $log_level = 'error',
                    Enum[absent, present] $ensure = present
                ) {}
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            const class_ = await node.acquireClass("test");

            {
                const _t: any = class_.getResolvedProperty("log_level").type;
                if (!(_t instanceof PuppetASTAccess))
                    assert.fail("log_level expected to be access");
                expect(_t.what).to.be.instanceOf(PuppetASTType);
                expect(_t.values[0]).to.be.instanceOf(PuppetASTPrimitive).and.have.property("value", "info");
                expect(_t.values[1]).to.be.instanceOf(PuppetASTPrimitive).and.have.property("value", "error");
                expect(_t.values[2]).to.be.instanceOf(PuppetASTPrimitive).and.have.property("value", "warning");
            }

            {
                const _t: any = class_.getResolvedProperty("ensure").type;
                if (!(_t instanceof PuppetASTAccess))
                    assert.fail("log_level expected to be access");
                expect(_t.what).to.be.instanceOf(PuppetASTType);
                expect(_t.values[0]).to.be.instanceOf(PuppetASTQualifiedName).and.have.deep.property("value", {"_value": "absent"});
                expect(_t.values[1]).to.be.instanceOf(PuppetASTQualifiedName).and.have.deep.property("value", {"_value": "present"});
            }
        });
    });

    it('switch', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test (
                    $test = 'b',
                    $test_def = 'd',
                ) {
                    $v = $test ? {'a' => 'it_was_a', 'b' => 'it_was_b', 'c' => 'it_was_c', default => 'default'}
                    $b = $test_def ? {'a' => 'it_was_a', 'b' => 'it_was_b', 'c' => 'it_was_c', default => 'ddddd'}
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            const class_ = await node.acquireClass("test");

            expect(class_.getResolvedProperty("v").value).to.be.equal("it_was_b");
            expect(class_.getResolvedProperty("b").value).to.be.equal("ddddd");

        });
    });

    it('if', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test ($a = 1, $b = 5, $c = 10, $d = 10) {
                    if ($a < $b) {
                        $test_1 = '1works'
                    } else {
                        $test_1 = '1doesnt'
                    }
                    if ($a > $b) {
                        $test_2 = '2works'
                    } else {
                        $test_2 = '2doesnt'
                    }
                    if ($d == $c) {
                        $test_3 = '3works'
                    }
                    if ($a == $c) {
                        $test_4 = '4doesnt'
                    } else {
                        $test_4 = '4works'
                    }
                    if ($b != $c) {
                        $test_5 = '5works'
                    }
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: puppet.Workspace,
            environment: puppet.Environment,
            node: puppet.Node) =>
        {
            const class_ = await node.acquireClass("test");

            expect(class_.getResolvedProperty("test_1").value).to.be.equal("1works");
            expect(class_.getResolvedProperty("test_2").value).to.be.equal("2doesnt");
            expect(class_.getResolvedProperty("test_3").value).to.be.equal("3works");
            expect(class_.getResolvedProperty("test_4").value).to.be.equal("4works");
            expect(class_.getResolvedProperty("test_5").value).to.be.equal("5works");

        });
    });
});

