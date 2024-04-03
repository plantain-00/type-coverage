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
      ],
      dependencies: d.dependencies
    }))),
    ...workspaces.map((d) => `node packages/cli/dist/index.js -p ${d.path}/src --detail --strict --report-unused-ignore --suppressError`)
  ],
  lint: {
    ts: `eslint --ext .js,.ts ${tsFiles}`,
    markdown: `markdownlint README.md`
  },
  test: [],
  fix: `eslint --ext .js,.ts ${tsFiles} --fix`
}
