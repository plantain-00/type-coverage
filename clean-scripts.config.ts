const tsFiles = `"packages/**/src/**/*.ts"`

export default {
  build: [
    'rimraf packages/utils/dist/',
    'rimraf packages/utils/es/',
    'tsc -p packages/utils/src/',
    'tsc -p packages/utils/src/tsconfig.es.json',
    'rimraf packages/core/dist/',
    'tsc -p packages/core/src/',
    'rimraf packages/plugin/dist/',
    'tsc -p packages/plugin/src/',
    'rimraf packages/cli/dist/',
    'tsc -p packages/cli/src/',
    'node packages/cli/dist/index.js -p packages/core/src --detail --strict --supressError',
    'node packages/cli/dist/index.js -p packages/cli/src --detail --strict --supressError',
    'node packages/cli/dist/index.js -p packages/utils/src --detail --strict --supressError',
    'node packages/cli/dist/index.js -p packages/plugin/src --detail --strict --supressError'
  ],
  lint: {
    ts: `eslint --ext .js,.ts ${tsFiles}`,
    export: `no-unused-export ${tsFiles} --need-module tslib --strict`,
    markdown: `markdownlint README.md`
  },
  test: [],
  fix: `eslint --ext .js,.ts ${tsFiles} --fix`
}
