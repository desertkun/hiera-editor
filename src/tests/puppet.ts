
const assert = require('assert');
const rmdir = require('rimraf');

import * as path from "path";
import * as tmp from "tmp";

import { Workspace } from "../puppet/workspace";
import { Environment } from "../puppet/environment";
import { Node } from "../puppet/files";
import { PuppetASTAccess, PuppetASTPrimitive, PuppetASTQualifiedName, 
    PuppetASTType, PuppetASTTypeOf, PuppetHintBodyCompilationError } from "../puppet/ast";
import { WorkspaceError, CompilationError } from "../puppet/util"

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

type WorkspaceTestCallback = (workspace: Workspace,
                              environment: Environment,
                              node: Node) => Promise<any>;

async function testRealWorkspace(workspaceName: string, environmentName: string, nodeName: string,
                             f: WorkspaceTestCallback = null): Promise<Node>
{
    const d = tmp.dirSync();

    try
    {
        const workspace = new Workspace(getWorkspacePath(workspaceName), d.name);
        await workspace.init();
        const environment = await workspace.getEnvironment(environmentName);
        await environment.init();
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
                             f: WorkspaceTestCallback = null, nodeYAMLCommentBefore?: string, functions?: any): Promise<Node>
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

        if (functions)
        {
            const _f = path.join(d.name, "modules", "test", "functions");
            await async.makeDirectory(_f);
            for (const fileName in functions)
            {
                await async.write(path.join(_f, fileName), functions[fileName]);
            }
        }

        await async.makeDirectory(path.join(d.name, "environments"));
        await async.makeDirectory(path.join(d.name, "environments", "dev"));
        const _d = path.join(d.name, "environments", "dev", "data");
        await async.makeDirectory(_d);
        await async.writeYAML(path.join(_d, "test.yaml"), nodeYAML, nodeYAMLCommentBefore);
    }
    catch (e)
    {
        throw Error("Failed to init simple workspace: " + e);
    }

    try
    {
        const workspace = new Workspace(d.name);
        await workspace.init();
        const environment = await workspace.getEnvironment("dev");
        await environment.init();
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
        return expect(testRealWorkspace("missing...", "dev", "test")).to.be.rejectedWith(WorkspaceError);
    });

    it('minimal workspace', () =>
    {
        return testRealWorkspace("minimal", "dev", "test", async (
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
        {
            await expect(node.acquireClass("test")).to.be.rejectedWith(CompilationError);
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
        {
            const class_ = await node.acquireClass("test");
            expect(class_.getResolvedProperty("v").value).to.equal("Hello, myhost!");
        }, "hostname = \"myhost\"");
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
        {
            const class_ = await node.acquireClass("test");

            {
                const _t: any = class_.getResolvedProperty("log_level").type;
                if (!(_t instanceof PuppetASTTypeOf))
                    assert.fail("log_level expected to be PuppetASTTypeOf");
                const _tof = <PuppetASTTypeOf>_t;
                expect(_tof.type).to.be.instanceOf(PuppetASTType);
                expect(_tof.args[0]).to.be.instanceOf(PuppetASTPrimitive).and.have.property("value", "info");
                expect(_tof.args[1]).to.be.instanceOf(PuppetASTPrimitive).and.have.property("value", "error");
                expect(_tof.args[2]).to.be.instanceOf(PuppetASTPrimitive).and.have.property("value", "warning");
            }

            {
                const _t: any = class_.getResolvedProperty("ensure").type;
                if (!(_t instanceof PuppetASTTypeOf))
                    assert.fail("log_level expected to be access");
                const _tof = <PuppetASTTypeOf>_t;
                expect(_tof.type).to.be.instanceOf(PuppetASTType);
                expect(_tof.args[0]).to.be.instanceOf(PuppetASTQualifiedName).and.have.deep.property("value", {"value": "absent"});
                expect(_tof.args[1]).to.be.instanceOf(PuppetASTQualifiedName).and.have.deep.property("value", {"value": "present"});
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
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
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
        {
            const class_ = await node.acquireClass("test");

            expect(class_.getResolvedProperty("test_1").value).to.be.equal("1works");
            expect(class_.getResolvedProperty("test_2").value).to.be.equal("2doesnt");
            expect(class_.getResolvedProperty("test_3").value).to.be.equal("3works");
            expect(class_.getResolvedProperty("test_4").value).to.be.equal("4works");
            expect(class_.getResolvedProperty("test_5").value).to.be.equal("5works");

        });
    });

    it('functors', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test {
                    fail("Welp")
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
        {
            const class_ = await node.acquireClass("test");

            if (!class_.hasHints)
            {
                assert.fail("Expected to have a hint")
            }

            expect(class_.hints[0]).to.be.instanceOf(PuppetHintBodyCompilationError).
                and.have.deep.property("message", "Failed to resolve class body: Welp");
        });
    });

    it('functions', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test ($v = test::test_summ(1), $v2 = test::test_summ(1, 2)) {}
            `
        }, {"classes": ["test"]}, async (
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
        {
            const class_ = await node.acquireClass("test");
            
            {
                const test = class_.resolvedFields.get("v");
                expect(test.value).to.equal(11);
            }

            {
                const test = class_.resolvedFields.get("v2");
                expect(test.value).to.equal(3);
            }
        }, null, {
            "ff3.pp": `
                function test::test_summ (Number $a, Number $b = 10) {
                    return $a + $b
                }
            `
        });
    });
    
    it('access[optional]', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test (
                    Optional[Boolean] $test = true
                ) {
                    
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
        {
            const class_ = await node.acquireClass("test");
            
            {
                const test = class_.resolvedFields.get("test");
                expect(test.type).to.be.instanceOf(PuppetASTTypeOf);
            }
        });
    });

    it('access[a][b]', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test (
                    Hash $h = {'a' => {'b' => 5}},
                    String $test = $h['a']['b']
                ) {
                    
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
        {
            const class_ = await node.acquireClass("test");
            
            {
                const test = class_.resolvedFields.get("test");
                expect(test.value).to.equal(5);
            }
        });
    });

   it('access[class]', () =>
   {
       return testSimpleWorkspace({
           "init.pp": `
                class test (
                    Optional[Boolean] $testA = defined(Class['test::check']),
                    Optional[Boolean] $testB = defined(Class['test::false']),
                ) {}
           `,
           "check.pp": `
               class test::check () {
                   
               }
           `
       }, {"classes": ["test"]}, async (
           workspace: Workspace,
           environment: Environment,
           node: Node) =>
       {
           const class_ = await node.acquireClass("test");
           
           {
               const test = class_.resolvedFields.get("testA");
               expect(test.value).to.be.equal(true);
           }

           {
               const test = class_.resolvedFields.get("testB");
               expect(test.value).to.be.equal(false);
           }
       });
   });
    
   it('defined[variable]', () =>
   {
       return testSimpleWorkspace({
           "init.pp": `
                class test (
                    Optional[Boolean] $testA = defined($test::check::testA),
                    Optional[Boolean] $testB = defined($test::check::testB),
                    Optional[Boolean] $testC = defined($test::check::testC),
                ) {}
           `,
           "check.pp": `
               class test::check (
                   $testA = 10,
                   $testB = undef
               ) {
                   
               }
           `
       }, {"classes": ["test"]}, async (
           workspace: Workspace,
           environment: Environment,
           node: Node) =>
       {
           const class_ = await node.acquireClass("test");
           
           {
               const test = class_.resolvedFields.get("testA");
               expect(test.value).to.be.equal(true);
           }
           {
               const test = class_.resolvedFields.get("testB");
               expect(test.value).to.be.equal(true);
           }
           {
               const test = class_.resolvedFields.get("testC");
               expect(test.value).to.be.equal(false);
           }
       });
   });

   it('class properties defined by user', () =>
   {
       return testSimpleWorkspace({
           "init.pp": `
                class test (
                    Optional[Number] $testA = $test::check::checkA
                ) {}
           `,
           "check.pp": `
               class test::check (
                   $checkA
               ) {
                   
               }
           `
       }, {"classes": ["test"], "test::check::checkA": 15}, async (
           workspace: Workspace,
           environment: Environment,
           node: Node) =>
       {
           const class_ = await node.acquireClass("test");
           
           {
               const test = class_.resolvedFields.get("testA");
               expect(test.value).to.be.equal(15);
           }
       });
   });

    it('facts', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test (
                    String $testAV = $facts['testA'],
                    Number $testBV = $facts['testB'],
                    Number $testDirectV = $testFactsDirect
                ) {
                    
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
        {
            const class_ = await node.acquireClass("test");
            
            {
                const test = class_.resolvedFields.get("testAV");
                expect(test.value).to.equal("string");
            }

            {
                const test = class_.resolvedFields.get("testBV");
                expect(test.value).to.equal(5);
            }

            {
                const test = class_.resolvedFields.get("testDirectV");
                expect(test.value).to.equal(99);
            }
        }, 'testA = "string" \n testB = 5 \n testFactsDirect = 99');
    });

    it('access $facts[a][b]', () =>
    {
        return testSimpleWorkspace({
            "init.pp": `
                class test (
                    String $test = $facts['a']['b']
                ) {
                    
                }
            `
        }, {"classes": ["test"]}, async (
            workspace: Workspace,
            environment: Environment,
            node: Node) =>
        {
            const class_ = await node.acquireClass("test");
            
            {
                const test = class_.resolvedFields.get("test");
                expect(test.value).to.equal(10);
            }
        }, 'a = {"b": 10}');
    });
});

