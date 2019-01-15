const assert = require('assert');
const { execSync } = require('child_process')

const fs = require('fs-extra');
const puppeteer = require('puppeteer');

const modclass = require('../');
const MockClass = require('./MockClass');
const { createTestModule, destroyTestModules } = require('./testHelper');

describe('Attach subclasses properly', _ => {

    it('should destroy test modules before starting', destroyTestModules);

    it('should attach a static property to a class', done => {

        createTestModule('testLibrary1', {
            prop2: 'module'
        })
        .then(_ => {
            const test = new MockClass(_this => {
                _this.prop1 = 'class';
                modclass(_this);
            });

            assert.equal(test.prop1, 'class');
            assert.equal(test.prop2, 'module');

            destroyTestModules()
            .then(done);
        });
    });

    it('should attach a method to a class', done => {

        createTestModule('testLibrary2', _this => {
            return { prop2: _ => 'module' };
        })
        .then(_ => {
            const test = new MockClass(_this => {
                _this.prop1 = 'class';
                modclass(_this);
            });

            assert.equal(test.prop1, 'class');
            assert.equal(test.prop2.constructor, Function);
            assert.equal(test.prop2(), 'module');

            destroyTestModules()
            .then(done);
        });

    });

    it('should attach a method to a class with a reference to the global object', done => {

        createTestModule('testLibrary3', _this => {
            return { prop2: _ => { _this.prop1 = 'module'; } };
        })
        .then(_ => {
            const test = new MockClass(_this => {
                _this.prop1 = 'class';
                modclass(_this);
            });

            assert.equal(test.prop1, 'class');
            assert.equal(test.prop2.constructor, Function);
            test.prop2();
            assert.equal(test.prop1, 'module');

            destroyTestModules()
            .then(done);
        });

    });

    it('should extend a more complex class with an object containing a limited reference to the object', done => {

        createTestModule('testLibrary4', _this => {
            return {
                prop2: _ => _this.setProp('module'),
                prop3: _ => _this.restrictedProp
            };
        })
        .then(_ => {
            const test = new MockClass(_this => {
                _this.prop1 = 'class';
                _this.restrictedProp = 'no';
                modclass(_this, {
                    testLibrary4    : { setProp: prop => _this.prop1 = prop }
                });
            });

            assert.equal(test.prop1, 'class');
            assert.equal(test.prop2.constructor, Function);
            test.prop2();
            assert.equal(test.prop1, 'module');
            assert.equal(test.prop3(), undefined);

            destroyTestModules()
            .then(done);
        });

    });

});


describe('bundle the module classes properly', _ => {

    it('should create a subclass bundle compile with browserify', done => {
        fs.writeFileSync('./tests/TestClass.js', [
            `const modclass = require('../../ModClass');`,
            `class TestClass {`,
                `constructor(){`,
                    `this.z = '123';`,
                    `modclass(this);`,
                `}`,
            `}`,
            `module.exports = TestClass;`
        ].join('\n'));

        Promise.all([
            createTestModule('testLib1', _this => { return { a: _ => 'aaa' }; }),
            createTestModule('testLib2', _this => { return { b: _ => 'bbb' }; }),
            createTestModule('testLib3', _this => { return { c: _ => 'ccc' }; })
        ])
        .then(_ => {
            const TestClass = require('./TestClass');
            const test = new TestClass();

            assert.equal(test.a(), 'aaa');
            assert.equal(test.b(), 'bbb');
            assert.equal(test.c(), 'ccc');

            test.__modclass
            .createBundle({
                cloneClass: true,
                filename: 'modclass.bundle.js',
                classPath: 'tests\\TestClass.js'
            })
            .then(_ => {
                execSync('browserify tests/TestClass.bundle.js -o tests/bundle.js');
                fs.writeFileSync('./tests/test.html', `<script src="bundle.js"></script>`);
            })
            .then(async _ => {
                const browser = await puppeteer.launch();
                const page = await browser.newPage();
                await page.goto(`file:///${__dirname.replace('\\', '/')}/test.html`);
                const run = await page.evaluate(_ => {
                    const a = new TestClass();
                    return [ a.a(), a.b(), a.c() ];
                });
                await browser.close();

                assert.equal(run[0], 'aaa');
                assert.equal(run[1], 'bbb');
                assert.equal(run[2], 'ccc');
            }).then(_ => {
                destroyTestModules()
                .then(done);
            });
        });

    });

});