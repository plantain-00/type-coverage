const tsFiles = `"packages/**/src/**/*.ts" "spec/**/*.ts"`
const jsFiles = `"*.config.js"`

module.exports = {
  build: [
    'rimraf packages/core/dist/',
    'tsc -p packages/core/src/',
    'rimraf packages/cli/dist/',
    'tsc -p packages/cli/src/',
    'node packages/cli/dist/index.js -p packages/core/src --detail --strict --cache --ignore-catch --supressError',
    'node packages/cli/dist/index.js -p packages/cli/src --detail --strict --cache --ignore-catch --supressError'
  ],
  lint: {
    ts: `tslint ${tsFiles}`,
    js: `standard ${jsFiles}`,
    export: `no-unused-export ${tsFiles}`,
    commit: `commitlint --from=HEAD~1`,
    markdown: `markdownlint README.md`
  },
  test: [
    'tsc -p spec',
    'jasmine'
  ],
  fix: {
    ts: `tslint --fix ${tsFiles}`,
    js: `standard --fix ${jsFiles}`
  }
}
