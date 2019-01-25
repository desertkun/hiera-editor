
const assert = require('assert');
const rmdir = require('rimraf');

import * as path from "path";
import * as tmp from "tmp";
import * as async from "../async"

import { Workspace } from "../puppet/workspace";
import { Environment } from "../puppet/environment";
import { File } from "../puppet/files";
import { NodeContext } from "../puppet/node";
import { PuppetASTAccess, PuppetASTPrimitive, PuppetASTQualifiedName, 
    PuppetASTType, PuppetASTTypeOf, PuppetHintBodyCompilationError, PuppetASTClass } from "../puppet/ast";
import { WorkspaceError, CompilationError } from "../puppet/util"
import { rubyBridge } from "../global"

const ini = require('ini');
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
                              node: NodeContext) => Promise<any>;

async function testRealWorkspace(workspaceName: string, environmentName: string, nodeName: string,
                             f: WorkspaceTestCallback = null): Promise<NodeContext>
{
    const d = tmp.dirSync();

    try
    {
        const raw = ini.stringify({
            "main": {
                environment: "dev",
                codedir: d.name,
                certname: "hiera-editor-tool",
                server: "fake-puppet-server"
            }
        });
        await async.writeFile(path.join(d.name, "puppet.conf"), raw);

        const workspace = new Workspace(getWorkspacePath(workspaceName), d.name, true);
        await workspace.init();
        const environment = await workspace.getEnvironment(environmentName, true);
        await environment.init();
        const node = await environment.enterNodeContext(nodeName);
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

interface WorkspaceTest 
{
    files: any;
    certname?: string;
    hiera?: any;
    f?: WorkspaceTestCallback;
    facts?: any;
    functions?: any;
    manifests?: any;
}

async function testSimpleWorkspace(test: WorkspaceTest): Promise<NodeContext>
{
    const d = tmp.dirSync();

    try
    {
        await async.makeDirectory(path.join(d.name, ".pe-cache"));
        const raw = ini.stringify({
            "main": {
                environment: "dev",
                codedir: d.name,
                certname: "hiera-editor-tool",
                server: "fake-puppet-server"
            }
        });

        await async.writeFile(path.join(d.name, ".pe-cache", "puppet.conf"), raw);

        await async.makeDirectory(path.join(d.name, "modules"));
        await async.makeDirectory(path.join(d.name, "modules", "test"));
        const _m = path.join(d.name, "modules", "test", "manifests");
        await async.makeDirectory(_m);

        for (const fileName in test.files)
        {
            await async.write(path.join(_m, fileName), test.files[fileName]);
        }

        if (test.functions)
        {
            const _f = path.join(d.name, "modules", "test", "functions");
            await async.makeDirectory(_f);
            for (const fileName in test.functions)
            {
                await async.write(path.join(_f, fileName), test.functions[fileName]);
            }
        }

        await async.makeDirectory(path.join(d.name, "environments"));
        await async.makeDirectory(path.join(d.name, "environments", "dev"));

        if (test.manifests)
        {
            const _f = path.join(d.name, "environments", "dev", "manifests");
            await async.makeDirectory(_f);
            for (const fileName in test.manifests)
            {
                await async.write(path.join(_f, fileName), test.manifests[fileName]);
            }
        }

        const _d = path.join(d.name, "environments", "dev", "data");
        await async.makeDirectory(_d);

        if (test.hiera)
        {
            for (const fileName in test.hiera)
            {
                const data = test.hiera[fileName];
                const _f = path.join(_d, fileName);
                await async.makeDirectory(path.dirname(_f));
                await async.writeYAML(_f, data);
            }
        }
    }
    catch (e)
    {
        throw Error("Failed to init simple workspace: " + e);
    }

    try
    {
        const workspace = new Workspace(d.name, null, true);
        await workspace.init();
        const environment = await workspace.getEnvironment("dev", true);
        await environment.init();
        const node = await environment.enterNodeContext(test.certname || "node.puppet", test.facts);
        if (test.f)
        {
            return await test.f(workspace, environment, node);
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
    rubyBridge.start();

    it('missing directory', () =>
    {
        return expect(testRealWorkspace("missing...", "dev", "test")).to.be.rejectedWith(WorkspaceError);
    });

    it('minimal workspace', () =>
    {
        return testRealWorkspace("minimal", "dev", "test", async (
            workspace: Workspace,
            environment: Environment,
            node: NodeContext) =>
        {
            const class_ = await node.acquireClass("test");
            expect(class_.name).to.equal("test");
        });
    });

    it('compilation error', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    $%@%+@*$ _&(FHW_ +{@#}UH
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                await expect(node.isClassResolved("test")).to.be.equal(false);
            }
        });
    });

    it('workspace with body params', () =>
    {
        return testSimpleWorkspace({
            files:{
                "init.pp": `
                    class test {
                      $test_string = "testing"
                      $test_number = 234
                      $test_boolean = true
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const class_ = await node.acquireClass("test");
                expect(class_.getResolvedProperty("test_string").value).to.equal("testing");
                expect(class_.getResolvedProperty("test_number").value).to.equal(234);
                expect(class_.getResolvedProperty("test_boolean").value).to.equal(true);
            }
        });
    });

    it('simplest params pattern', () =>
    {
        return testSimpleWorkspace({
            files: {
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
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
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
            }
        });
    });

    it('concatenation', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test {
                      $test_a = "Hello"
                      $test_b = "World"
                      $v = "$\{test_a\}, $\{test_b\}!"
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const class_ = await node.acquireClass("test");
                expect(class_.getResolvedProperty("v").value).to.equal("Hello, World!");
            }
        });
    });

    it('global', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test {
                      $v = ">>>$\{::test\}"
                      $v2 = "Hello, $\{::hostname\}!"
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            facts: {
                "test": "<<<"
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const class_ = await node.acquireClass("test");
                expect(class_.getResolvedProperty("v2").value).to.equal("Hello, node!");
                expect(class_.getResolvedProperty("v").value).to.equal(">>><<<");
            }
        });
    });

    it('resources', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test {
                        test::ddd { "sometitle":
                            c => "anothertest"
                        }
                    }
                `,
                "ddd.pp": `
                    define test::ddd (
                        $a = $title,
                        $b = "test",
                        $c
                    ) {
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                await node.acquireClass("test");
            }
        });
    });

    it('keyed entries', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test {
                      notice { "hello": 
                        name => "hello",
                        ensure => present
                      }
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                await node.acquireClass("test");
            }
        });
    });

    it('default entries', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test {
                      notice { "hello": 
                        ensure => def
                      }
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                await node.acquireClass("test");
            }
        });
    });

    it('order chains', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test {
                      notice { "hello": 
                      } -> notice { "hello2": 
                      } -> notice { "hello3": 
                      } ~> notice { "hello4": 
                      }
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                await node.acquireClass("test");
            }
        });
    });

    it('enums', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test (
                        Enum['info', 'error', 'warning'] $log_level = 'error',
                        Enum[absent, present] $ensure = present
                    ) {}
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
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
            }
        });
    });

    it('? { ... }', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test (
                        $test = 'b',
                        $test_def = 'd',
                    ) {
                        $v = $test ? {'a' => 'it_was_a', 'b' => 'it_was_b', 'c' => 'it_was_c', default => 'default'}
                        $b = $test_def ? {'a' => 'it_was_a', 'b' => 'it_was_b', 'c' => 'it_was_c', default => 'ddddd'}
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const class_ = await node.acquireClass("test");
    
                expect(class_.getResolvedProperty("v").value).to.be.equal("it_was_b");
                expect(class_.getResolvedProperty("b").value).to.be.equal("ddddd");
    
            }
        });
    });
    
    it('case', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test (
                        $a = running,
                        $b = 'b',
                        $c = 'd',
                    ) {
                        case $a {
                            /^(running|stopped)$/: {
                                $result_a = true
                            }
                            default: {
                                $result_a = false
                            }
                        }
                        case $b {
                            /^(running|stopped)$/: {
                                $result_b = true
                            }
                            default: {
                                $result_b = false
                            }
                        }
                        case $c {
                            'd': {
                                $result_c = true
                            }
                            default: {
                                $result_c = false
                            }
                        }
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const class_ = await node.acquireClass("test");
    
                expect(class_.getResolvedProperty("result_a").value).to.be.equal(true);
                expect(class_.getResolvedProperty("result_b").value).to.be.equal(false);
                expect(class_.getResolvedProperty("result_c").value).to.be.equal(true);
    
            }
        });
    });

    it('if', () =>
    {
        return testSimpleWorkspace({
            files: {
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
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const class_ = await node.acquireClass("test");
    
                expect(class_.getResolvedProperty("test_1").value).to.be.equal("1works");
                expect(class_.getResolvedProperty("test_2").value).to.be.equal("2doesnt");
                expect(class_.getResolvedProperty("test_3").value).to.be.equal("3works");
                expect(class_.getResolvedProperty("test_4").value).to.be.equal("4works");
                expect(class_.getResolvedProperty("test_5").value).to.be.equal("5works");
    
            }
        });
    });

    it('functors', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test {
                        fail("Welp")
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const class_ = await node.acquireClass("test");
    
                if (!class_.hasHints)
                {
                    assert.fail("Expected to have a hint")
                }
    
                expect(class_.hints[0]).to.be.instanceOf(PuppetHintBodyCompilationError).
                    and.have.deep.property("message", "Failed to resolve class body: Welp");
            }
        });
    });

    it('functions', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test ($v = test::test_summ(1), $v2 = test::test_summ(1, 2)) {}
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
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
            }, 
            functions: {
                "ff3.pp": `
                    function test::test_summ (Number $a, Number $b = 10) {
                        return $a + $b
                    }
                `
            }
        });
    });
    
    it('access[optional]', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test (
                        Optional[Boolean] $test = true
                    ) {
                        
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const class_ = await node.acquireClass("test");
                
                {
                    const test = class_.resolvedFields.get("test");
                    expect(test.type).to.be.instanceOf(PuppetASTTypeOf);
                }
            }
        });
    });

    it('access[a][b]', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test (
                        Hash $h = {'a' => {'b' => 5}},
                        String $test = $h['a']['b']
                    ) {
                        
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const class_ = await node.acquireClass("test");
                
                {
                    const test = class_.resolvedFields.get("test");
                    expect(test.value).to.equal(5);
                }
            }
        });
    });

   it('access[class]', () =>
   {
       return testSimpleWorkspace({
           files: {
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
        }, 
        manifests: {
            "site.pp": `
                include test
            `  
        },
        f: async (
            workspace: Workspace,
            environment: Environment,
            node: NodeContext) =>
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
        }
       });
   });
    
   it('defined[variable]', () =>
   {
       return testSimpleWorkspace({
           files: {
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
        }, 
        manifests: {
            "site.pp": `
                include test
            `  
        },
        f: async (
            workspace: Workspace,
            environment: Environment,
            node: NodeContext) =>
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
        }
       });
   });

   it('class properties defined by hiera', () =>
   {
       return testSimpleWorkspace({
           files: {
            "init.pp": `
                 class test (
                     Optional[Number] $testA = $test::check::checkA,
                     Optional[Number] $testCommonA = $test::check::commonA,
                     Optional[Number] $testCommonB = $test::check::commonB
                 ) {}
            `,
            "check.pp": `
                class test::check (
                    $checkA,
                    $commonA,
                    $commonB
                ) {
                    
                }
            `
        },
        certname: "hiera.test.com",
        hiera: {
            "nodes/hiera.test.com.yaml": {
                "test::check::checkA": 15,
                "test::check::commonB": 20
            },
            "common.yaml": {
                "test::check::commonA": 10,
                "test::check::commonB": 10
            },
        },
        manifests: {
            "site.pp": `
                include test
            `  
        },
        f: async (
            workspace: Workspace,
            environment: Environment,
            node: NodeContext) =>
        {
            const class_ = await node.acquireClass("test");
            
            {
                const test = class_.resolvedFields.get("testA");
                expect(test.value).to.be.equal(15);
            }
            {
                const test = class_.resolvedFields.get("testCommonA");
                expect(test.value).to.be.equal(10);
            }
            {
                const test = class_.resolvedFields.get("testCommonB");
                expect(test.value).to.be.equal(20);
            }
        }
       });
   });

    it('facts', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test (
                        String $testAV = $facts['testA'],
                        Number $testBV = $facts['testB'],
                        Number $testDirectV = $testFactsDirect
                    ) {
                        
                    }
                `
            }, 
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            facts: {
                "testA": "string",
                "testB": 5,
                "testFactsDirect": 99
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
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
            }
        });
    });

    it('access $facts[a][b]', () =>
    {
        return testSimpleWorkspace({
            files: {
                "init.pp": `
                    class test (
                        String $test = $facts['a']['b']
                    ) {
                        
                    }
                `
            },
            facts: {
                "a": {
                    "b": 10
                }
            },
            manifests: {
                "site.pp": `
                    include test
                `  
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const class_ = await node.acquireClass("test");
                
                {
                    const test = class_.resolvedFields.get("test");
                    expect(test.value).to.equal(10);
                }
            }
        });
    });

    it('manifest locals passing', () =>
    {
        // variables should be passed from one manifest to another within manifests folder

        return testSimpleWorkspace({
            files: {
                "a.pp": `
                    class a () {}
                `,
                "b.pp": `
                    class b () {}
                `,
                "c.pp": `
                    class c () {}
                `
            }, 
            certname: "testnode.domain.com",
            manifests: {
                "testB.pp":  `
                    $testValue1 = 5
                `,
                "testA.pp":  `
                    $testValue2 = 10
                `,
                "testC.pp":  `
                    $testValue = $testValue1 + $testValue2
                `
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                const value = node.ast.resolvedLocals.get("testValue");
                expect(value.value).to.be.equal(15)
            }
        });
    });

    it('node', () =>
    {
        return testSimpleWorkspace({
            files: {
                "a.pp": `
                    class a () {}
                `,
                "b.pp": `
                    class b () {}
                `,
                "c.pp": `
                    class c () {}
                `
            }, 
            certname: "testnode.domain.com",
            manifests: {
                "site.pp":  `
                    node "testnode.domain.com" {
                        include a
                    }
                    node "othernode.domain.com" {
                        include b
                    }
                    node default {
                        include c
                    }
                `
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                expect(node.isClassResolved("a")).to.be.equal(true)
                expect(node.isClassResolved("b")).to.be.equal(false)
                expect(node.isClassResolved("c")).to.be.equal(false)
            }
        });
    });

    it('node default', () =>
    {
        return testSimpleWorkspace({
            files: {
                "a.pp": `
                    class a () {}
                `,
                "b.pp": `
                    class b () {}
                `,
                "c.pp": `
                    class c () {}
                `
            }, 
            certname: "testnode.domain.com",
            manifests: {
                "site.pp":  `
                    node "testnode2.domain.com" {
                        include a
                    }
                    node "othernode2.domain.com" {
                        include b
                    }
                    node default {
                        include c
                    }
                `
            },
            f: async (
                workspace: Workspace,
                environment: Environment,
                node: NodeContext) =>
            {
                expect(node.isClassResolved("a")).to.be.equal(false)
                expect(node.isClassResolved("b")).to.be.equal(false)
                expect(node.isClassResolved("c")).to.be.equal(true)
            }
        });
    });
});

