import * as tsserverlibrary from 'typescript/lib/tsserverlibrary'
import { lintSync, LintOptions } from 'type-coverage-core'

function init(modules: { typescript: typeof tsserverlibrary }) {
  let oldProgram: ts.Program | undefined

  function create(info: ts.server.PluginCreateInfo) {
    const lintOptions = info.config as LintOptions
    const proxy: tsserverlibrary.LanguageService = {
      ...info.languageService,
      getSemanticDiagnostics(fileName) {
        const prior = info.languageService.getSemanticDiagnostics(fileName)
        const result = lintSync(
          info.project.getCompilerOptions(),
          info.project.getRootFiles(),
          {
            ...lintOptions,
            files: [fileName],
            oldProgram,
          },
        )
        oldProgram = result.program
        for (const anyObject of result.anys) {
          prior.push({
            category: modules.typescript.DiagnosticCategory.Warning,
            code: 1,
            source: 'ts-plugin-type-coverage',
            file: anyObject.sourceFile,
            start: modules.typescript.getPositionOfLineAndCharacter(anyObject.sourceFile, anyObject.line, anyObject.character),
            length: anyObject.text.length,
            messageText: `The type of '${anyObject.text}' is 'any'`,
          })
        }
        return prior
      },
    }
    return proxy
  }

  return { create };
}

export = init;
