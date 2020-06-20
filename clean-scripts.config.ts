const tsFiles = `"packages/**/src/**/*.ts"`
const jsFiles = `"*.config.js"`

export default {
  build: [
    'rimraf packages/utils/dist/',
    'rimraf packages/utils/es/',
    'tsc -p packages/utils/src/',
    'tsc -p packages/utils/src/tsconfig.es.json',
    'rimraf packages/core/dist/',
    'tsc -p packages/core/src/',
    'rimraf packages/cli/dist/',
    'tsc -p packages/cli/src/',
    'node packages/cli/dist/index.js -p packages/core/src -detail --strict --ignore-catch --supressError',
    'node packages/cli/dist/index.js -p packages/cli/src --detail --strict --ignore-catch --supressError',
    'node packages/cli/dist/index.js -p packages/utils/src --detail --strict --ignore-catch --supressError'
  ],
  lint: {
    ts: `eslint --ext .js,.ts ${tsFiles} ${jsFiles}`,
    export: `no-unused-export ${tsFiles} --need-module tslib --strict`,
    commit: `commitlint --from=HEAD~1`,
    markdown: `markdownlint README.md`
  },
  test: [],
  fix: `eslint --ext .js,.ts ${tsFiles} ${jsFiles} --fix`
}
