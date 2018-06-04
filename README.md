WDIO Test Coverage Reporter
=========================

[![NPM version](https://badge.fury.io/js/wdio-test-coverage-reporter.svg)]

> A WebdriverIO reporter plugin to generate test result with custom event in json format to display in html page as test coverage information.


## Installation

Simply install npm or yarn:

```shell
npm install --save wdio-test-coverage-reporter
```
```shell
yarn add wdio-test-coverage-reporter
```

`package.json` will be updated as:

```json
{
  "dependencies": {
    "wdio-test-coverage-reporter": "^1.0.0"
  }
}
```

It is recommended to install package as devDependencies.

## Using

 Add ```'test-coverage'``` to the reporters array in your wdio config file.

```js
// sample wdio.conf.js
module.exports = {
  // ...
  reporters: ['dot', 'test-coverage'],
  // ...
};
```

## Reporter Configurations

To use test coverage reporter, please add following option the wdio.conf.js

```js
// sample wdio.conf.js
module.exports = {
  // ...
  reporters: ['dot', 'test-coverage'],
  reporterOptions: {
        'test-coverage':{
            outputDir: './reports'
        }
    },
  // ...
};
```
