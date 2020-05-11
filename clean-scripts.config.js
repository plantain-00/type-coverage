const tsFiles = `"packages/**/src/**/*.ts" "spec/**/*.ts"`
const jsFiles = `"*.config.js"`

module.exports = {
  build: [
    'rimraf packages/utils/dist/',
    'rimraf packages/utils/es/',
    'tsc -p packages/utils/src/',
    'tsc -p packages/utils/src/tsconfig.es.json',
    'rimraf packages/core/dist/',
    'tsc -p packages/core/src/',
    'rimraf packages/cli/dist/',
    'tsc -p packages/cli/src/',
    'node packages/cli/dist/index.js -p packages/core/src --detail --strict --cache --ignore-catch --update --supressError',
    'node packages/cli/dist/index.js -p packages/cli/src --detail --strict --cache --ignore-catch --update --supressError'
  ],
  lint: {
    ts: `eslint --ext .js,.ts ${tsFiles} ${jsFiles}`,
    export: `no-unused-export ${tsFiles} --need-module tslib --strict`,
    commit: `commitlint --from=HEAD~1`,
    markdown: `markdownlint README.md`
  },
  test: [
    'tsc -p spec',
    'jasmine'
  ],
  fix: `eslint --ext .js,.ts ${tsFiles} ${jsFiles} --fix`
}
