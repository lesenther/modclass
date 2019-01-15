'use strict';

const fs = require('fs-extra');

/**
 * Create test modules
 *
 * @param {*} moduleName
 * @param {*} moduleFunc 
 */
function createTestModule(moduleName, moduleFunc) {
    return new Promise(resolve => {
        const moduleBaseDir = `${__dirname}\\modules`;
        const moduleDir = `${moduleBaseDir}\\${moduleName}`;

        if (!fs.existsSync(moduleBaseDir)) fs.mkdirSync(moduleBaseDir);
        if (!fs.existsSync(moduleDir)) fs.mkdirSync(moduleDir);

        const data = moduleFunc.constructor === Function
        ? String(moduleFunc)
        : JSON.stringify(moduleFunc);

        fs.writeFile(`${moduleDir}\\index.js`, `module.exports=${data}`, resolve);
    });
}

/**
 * Delete all the folders and files used for testing.
 * 
 */
function destroyTestModules() {
    return fs.remove(`${__dirname}\\modules`)
    .then(_ => {
        fs.remove(`${__dirname}\\modClass.bundle.js`);
        fs.remove(`${__dirname}\\TestClass.js`);
        fs.remove(`${__dirname}\\TestClassBundle.js`);
        fs.remove(`${__dirname}\\test.html`);
        fs.remove(`${__dirname}\\bundle.js`);
    });
}

module.exports = {
    createTestModule,
    destroyTestModules
};