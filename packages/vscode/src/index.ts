import * as vscode from 'vscode'

const configId = 'ts-plugin-type-coverage'
const configurationSection = 'typeCoverage'

/**
 * @public
 */
export async function activate(context: vscode.ExtensionContext) {
  const extension = vscode.extensions.getExtension<{ getAPI?: (n: number) => API }>('vscode.typescript-language-features')
  if (!extension) {
    return
  }
  await extension.activate()
  if (!extension.exports || !extension.exports.getAPI) {
    return
  }
  const api = extension.exports.getAPI(0)
  if (!api) {
    return
  }
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(configurationSection)) {
      synchronizeConfiguration(api)
    }
  }, undefined, context.subscriptions)

  synchronizeConfiguration(api)
}

function synchronizeConfiguration(api: API) {
  const configuration = vscode.workspace.getConfiguration(configurationSection)
  const options = {
    strict: configuration.get('strict'),
    ignoreCatch: configuration.get('ignoreCatch')
  }
  api.configurePlugin(configId, options)
}

interface API {
  configurePlugin(configId: string, options: unknown): void
}
