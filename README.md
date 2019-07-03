# type-coverage

A CLI tool to check type coverage for typescript code

This tool will check type of all identifiers, `the type coverage rate` = `the count of identifiers whose type is not any` / `the total count of identifiers`, the higher, the better.

[![Dependency Status](https://david-dm.org/plantain-00/type-coverage.svg)](https://david-dm.org/plantain-00/type-coverage)
[![devDependency Status](https://david-dm.org/plantain-00/type-coverage/dev-status.svg)](https://david-dm.org/plantain-00/type-coverage#info=devDependencies)
[![Build Status: Linux](https://travis-ci.org/plantain-00/type-coverage.svg?branch=master)](https://travis-ci.org/plantain-00/type-coverage)
[![Build Status: Windows](https://ci.appveyor.com/api/projects/status/github/plantain-00/type-coverage?branch=master&svg=true)](https://ci.appveyor.com/project/plantain-00/type-coverage/branch/master)
[![npm version](https://badge.fury.io/js/type-coverage.svg)](https://badge.fury.io/js/type-coverage)
[![Downloads](https://img.shields.io/npm/dm/type-coverage.svg)](https://www.npmjs.com/package/type-coverage)
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fplantain-00%2Ftype-coverage%2Fmaster%2Fpackage.json)](https://github.com/plantain-00/type-coverage)
[![Codechecks](https://raw.githubusercontent.com/codechecks/docs/master/images/badges/badge-default.svg?sanitize=true)](https://codechecks.io)

## install

`yarn global add type-coverage`

## usage

run `type-coverage`

## arguments

name | type | description
--- | --- | ---
`-p`, `--project` | string? | tell the CLI where is the `tsconfig.json`
`--detail` | boolean? | show detail
`--at-least` | number? | fail if coverage rate < this value
`--debug` | boolean? | show debug info
`--strict` | boolean? | [strict mode](#strict-mode)
`--ignore-catch` | boolean? | [ignore catch](#ignore-catch)
`--cache` | boolean? | [enable cache](#enable-cache)
`--ignore-files` | string[]? | [ignore files](#ignore-files)

### strict mode

If the identifiers' type arguments exist and contain at least one `any`, like `any[]`, `ReadonlyArray<any>`, `Promise<any>`, `Foo<number, any>`, it will be considered as `any` too

Also, future minor release may introduce stricter type check in this mode, which may lower the type coverage rate

### enable cache

save and reuse type check result of files that is unchanged and independent of changed files in `.type-coverage` directory, to improve speed

### ignore catch

If you want to get 100% type coverage then `try {} catch {}` is
the largest blocked towards that.

This can be fixed in typescript with [Allow type annotation on catch clause variable](https://github.com/Microsoft/TypeScript/issues/20024)
but until then you can turn on `--ignore-catch --at-least 100`.

Your catch blocks should look like

```ts
try {
  await ...
} catch (anyErr) {
  const err = <Error> anyErr
}
```

To have the highest type coverage.

### ignore files

This tool will ignore the files, eg: `--ignore-files "demo1/*.ts" --ignore-files "demo2/foo.ts"`

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

## add dynamic badges of type coverage rate

Use your own project url:

```md
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fplantain-00%2Ftype-coverage%2Fmaster%2Fpackage.json)](https://github.com/plantain-00/type-coverage)
```

## integrating with PRs

Using [codechecks](codechecks.io) you can integrate `type-coverage` with GitHub's Pull Requests. See [type-coverage-watcher](https://github.com/codechecks/type-coverage-watcher).

[![type-coverage-watcher](https://github.com/codechecks/type-coverage-watcher/raw/master/meta/check.png "type-coverage-watcher")](https://github.com/codechecks/type-coverage-watcher)

## API

```ts
import { lint } from 'type-coverage-core'

const result = await lint('.', { strict: true })
```

```ts
export function lint(project: string, options?: Partial<LintOptions>): Promise<FileTypeCheckResult & { program: ts.Program }>

export interface LintOptions {
  debug: boolean,
  files?: string[],
  oldProgram?: ts.Program,
  strict: boolean,
  enableCache: boolean,
  ignoreCatch: boolean,
  ignoreFiles?: string | string[]
}

export interface FileTypeCheckResult {
  correctCount: number
  totalCount: number
  anys: FileAnyInfo[]
}
```

## FAQ

> Q: Does this count JavaScript files?

Yes, This package calls Typescript API, Typescript can parse Javascript file(with `allowJs`), then this package can too.

## Changelogs

### v2

1. Move `typescript` from `dependencies` to `peerDependencies`
2. Move API from package `type-coverage` to package `type-coverage-core`

```ts
// v1
import { lint } from 'type-coverage'
lint('.', false, false, undefined, undefined, true)

// v2
import { lint } from 'type-coverage-core'
lint('.', { strict: true })
```
