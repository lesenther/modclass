'use strict';

const path = require('path');

const fs = require('fs');
const extend = require('extend');

const DEFAULT_MODULE_DIRECTORY = 'modules';
const PROPERTY_TITLE = '__modclass';

const inVal = (str, val) => val.indexOf(str) !== -1;

/**
 * Attach libraries of methods to another object and automatically inject
 * a reference to the object for proper access.
 *
 * @param {Object} classHandle Handle to object to which to attach methods
 * @param {Object} scopedClassHandle Object containing alternative scope mappings for subclasses
 * @param {String} subclassPath Path of the subclass directory
 */
module.exports = function(
    handle = {},
    scopedHandles = {},
    subclassPath = false,
    config
){
    config = extend({
        scope: {},
        path: false,
        enableBundler: true
    }, config);

    // Auto-detect subclass location if not defined
    if (!subclassPath) {
        subclassPath = path.join(path.dirname(module.parent.filename), DEFAULT_MODULE_DIRECTORY);
    }

    // Validate subclass directory
    if (!fs.statSync(subclassPath).isDirectory()) {
        throw new Error(`Not a valid directory:  ${subclassPath}`);
    }

    // Validate scope options
    if (scopedHandles && scopedHandles.constructor !== Object) {
        throw new Error(`Invalid restricted scope format:  ${scopedHandles.constructor.name}`);
    }

    // Find subclasses and process
    fs.readdirSync(subclassPath)
    .forEach(subclassName => {

        // Load the subclass
        const subclass = require(path.join(subclassPath, subclassName));

        // Determine the scope if required (defaults to global)
        const scope = scopedHandles.hasOwnProperty(subclassName)
        ? scopedHandles[subclassName]
        : handle;

        // Initialize subclass references with proper scope
        const subclassInitialized = subclass.constructor === Function
        ? subclass(scope)
        : subclass.constructor === Object
            ? subclass
            : { [`${subclassName}`]: subclass };

        // Attach subclass properties to class object
        Object.keys(subclassInitialized)
        .forEach(property => {

            if (handle.hasOwnProperty(property)) {
                throw new Error(`Failed to import ${subclassName}.${property}, `+
                `property already exists in class ${handle.constructor.name}`);
            }

            handle[property] = subclassInitialized[property];

        });

    });

    if (!config.enableBundler) {
        return;
    }

    // Add utility methods
    handle[PROPERTY_TITLE] = { createBundle };

    /**
     *
     * @param {object} config
     */
    function createBundle(config) {
        config = extend({
            filename: __dirname + '\\modclass.bundle.js',
            overwrite: false,
            dependencies: [],
            excludeProps: [],
            cloneClass: false,
            classPath: module.parent.filename
        }, config);

        return new Promise((resolve, reject) => {
            if (fs.existsSync(config.filename) && !config.overwrite) {
                return reject(new Error(`File exists: ${config.filename}`));
            }

            const output = [
                ...config.dependencies.map(dependency => [ dependency.type || 'const',
                    dependency.name, '=', `require('${dependency.path||'./'+dependency.name}');`
                ].join(' ')),
                ...[ ``, `module.exports = _this => { const _modclass = {` ]
            ];

            for (let property in handle) {
                if (!inVal(property, [ ...config.excludeProps, PROPERTY_TITLE ])) {
                    const strVal = typeof handle[property] === 'function'
                    ? String(handle[property])
                    : handle[property];

                    output.push(`\t${property}: ${strVal},`);
                }
            }

            output.push('\t};\n\tfor (let prop in _modclass) { _this[prop] = _modclass[prop]; }\n};');

            fs.writeFileSync(`${path.dirname(config.classPath)}\\${config.filename}`, `${output.join("\n")}`);

            if (!config.cloneClass) {
                return resolve();
            }

            const masterName = __dirname.split(path.sep).pop(); // used for dereferencing
            const cloneClass = fs.readFileSync(config.classPath).toString().split('\n');
            const clonePath = `${path.dirname(config.classPath)}\\${path.basename(config.classPath).split('.')[0]}Bundle.js`;

            let classFound = false;
            let className = false;
            let addedDeref = false;

            cloneClass.forEach((line, index) => {
                // Deference modclass and replace with the new bundle
                if (inVal('require', line) && inVal(masterName, line)) {
                    cloneClass[index] = line.replace(/require\(.*?\)/, `require('./${config.filename}')`);
                    addedDeref = true;
                }

                // Try to determine the classname
                className = classFound ? className : line.trim().match(/class\ +(\w*)\ +?\{?/);
                classFound = classFound ? true : className !== null;

                if (classFound && inVal('module.exports', line)) {
                    cloneClass[index] = `global.${className[1]} = ${className[1]};`;
                }
            });

            if (!addedDeref) {
                cloneClass.splice(1, 0, `const modclass = require('./${config.filename}');`);
                console.log(` - Warning:  Could not dereference properly, check the class require for the modclass bundle.`)
            }

            fs.writeFileSync(clonePath, cloneClass.join('\n'));

            return resolve();
        });
    }

}
