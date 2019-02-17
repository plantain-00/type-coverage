# type-coverage

A CLI tool to check type coverage for typescript code

This tool will check type of all identifiers, `the code coverage` = `the count of identifiers whose type is not any` / `the total count of identifiers`, the higher, the better.

[![Dependency Status](https://david-dm.org/plantain-00/type-coverage.svg)](https://david-dm.org/plantain-00/type-coverage)
[![devDependency Status](https://david-dm.org/plantain-00/type-coverage/dev-status.svg)](https://david-dm.org/plantain-00/type-coverage#info=devDependencies)
[![Build Status: Linux](https://travis-ci.org/plantain-00/type-coverage.svg?branch=master)](https://travis-ci.org/plantain-00/type-coverage)
[![Build Status: Windows](https://ci.appveyor.com/api/projects/status/github/plantain-00/type-coverage?branch=master&svg=true)](https://ci.appveyor.com/project/plantain-00/type-coverage/branch/master)
[![npm version](https://badge.fury.io/js/type-coverage.svg)](https://badge.fury.io/js/type-coverage)
[![Downloads](https://img.shields.io/npm/dm/type-coverage.svg)](https://www.npmjs.com/package/type-coverage)
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fplantain-00%2Ftype-coverage%2Fmaster%2Fpackage.json)](https://github.com/plantain-00/type-coverage)

## install

`yarn global add type-coverage`

## usage

run `type-coverage`

## arguments

name | type | description
--- | --- | ---
-p, --project | string? | show where is the `tsconfig.json`
--detail | boolean? | show detail
--at-least | number? | fail if coverage rate < this value
--debug | boolean? | show debug info
--strict | boolean? | if the identifiers' type arguments exist and contain at least one `any`, like `any[]`, `ReadonlyArray<any>`, `Promise<any>`, `Foo<number, any>`, it will be considered as `any` too; also, future minor release may introduce stricter type check in this mode, which may lower the code coverage
--cache | boolean? | save and reuse type check result of files that is unchanged and independent of changed files in `.type-coverage` directory, to improve speed

## config in package.json

```json
  "typeCoverage": {
    "atLeast": 99 // same as --at-least
  },
```

## ingore line

Use `type-coverage:ignore-next-line` or `type-coverage:ignore-line` in comment(`//` or `/*  */`) to ignore `any` in a line.

```ts
try {
  // type-coverage:ignore-next-line
} catch (error) { // type-coverage:ignore-line
}
```

## vscode plugin

<https://marketplace.visualstudio.com/items?itemName=york-yao.vscode-type-coverage>

## add dynamic badges of type coverage

Use your own project url:

```md
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fplantain-00%2Ftype-coverage%2Fmaster%2Fpackage.json)](https://github.com/plantain-00/type-coverage)
```

## FAQ

> Q: Does this count JavaScript files?

Yes, This package calls Typescript API, Typescript can parse Javascript file(with `allowJs`), then this package can too.
