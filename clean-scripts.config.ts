import { Tasks, readWorkspaceDependencies } from 'clean-scripts'

const tsFiles = `"packages/**/src/**/*.ts"`

const workspaces = readWorkspaceDependencies()

export default {
  build: [
    new Tasks(workspaces.map((d) => ({
      name: d.name,
      script: [
        `rimraf ${d.path}/dist/`,
        `tsc -p ${d.path}/src/`,
        ...(d.name === 'utils' ? [
          `rimraf ${d.path}/es/`,
          `tsc -p ${d.path}/src/tsconfig.es.json`,
        ] : []),
      ],
      dependencies: d.dependencies
    }))),
    ...workspaces.map((d) => `node packages/cli/dist/index.js -p ${d.path}/src --detail --strict --supressError`)
  ],
  lint: {
    ts: `eslint --ext .js,.ts ${tsFiles}`,
    export: `no-unused-export ${tsFiles} --need-module tslib --need-module ts-plugin-type-coverage --ignore-module vscode --strict`,
    markdown: `markdownlint README.md`
  },
  test: [],
  fix: `eslint --ext .js,.ts ${tsFiles} --fix`
}
