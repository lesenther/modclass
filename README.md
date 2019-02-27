Modclass
========

Allows large classes to be easily and modularly split into separate files with the ability to limit the scope of each modular subclass group.

Usage
-----

Install the package to your project:

```
npm i git://github.com/lesenther/modclass.git
```

Add to main class (or function):

```javascript
  const modclass = require('modclass');
```

Add hook in constructor (or method):

```javascript
  modclass(this);
```

Add modules to extend class in the format:  

./modules/module_name/index.js:

```javascript
module.exports = _this => {
    return {
        methodName: in => 'out'
    }
};
```

Known Issues
------

 * ~~Compatibility issues converting class to client-side with **Browserify**.~~
     * Update 2019-01-17:  As a work around, a bundler method was added to allow a class and it's external methods to be bundled into a more direct format.  The bundler doesn't yet support limited scoped reference passing.  
 *