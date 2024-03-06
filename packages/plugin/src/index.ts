import * as tsserverlibrary from 'typescript/lib/tsserverlibrary'
import { lintSync, FileAnyInfoKind } from 'type-coverage-core'

function init(modules: { typescript: typeof tsserverlibrary }) {
  let oldProgram: tsserverlibrary.Program | undefined

  function create(info: tsserverlibrary.server.PluginCreateInfo) {
    const proxy: tsserverlibrary.LanguageService = {
      ...info.languageService,
      getSemanticDiagnostics(fileName) {
        const config: { jsEnable: boolean } = info.config
        if (!config?.jsEnable && (fileName.endsWith('.js') || fileName.endsWith('.jsx'))) {
          return []
        }
        const result = lintSync(
          info.project.getCompilerOptions(),
          info.project.getRootFiles(),
          {
            ...config,
            files: [fileName],
            oldProgram,
          },
        )
        oldProgram = result.program
        const diagnostics: tsserverlibrary.Diagnostic[] = []
        for (const anyObject of result.anys) {
          let messageText: string
          if (anyObject.kind === FileAnyInfoKind.containsAny) {
            messageText = `The type of '${anyObject.text}' contains 'any'`
          } else if (anyObject.kind === FileAnyInfoKind.unsafeAs) {
            messageText = `The '${anyObject.text}' has unsafe 'as' type assertion`
          } else if (anyObject.kind === FileAnyInfoKind.unsafeNonNull) {
            messageText = `The '${anyObject.text}' has unsafe '!' type assertion`
          } else if (anyObject.kind === FileAnyInfoKind.unsafeTypeAssertion) {
            messageText = `The '${anyObject.text}' has unsafe '<>' type assertion`
          } else {
            messageText = `The type of '${anyObject.text}' is 'any'`
          }
          diagnostics.push({
            category: modules.typescript.DiagnosticCategory.Warning,
            code: anyObject.kind,
            source: 'ts-plugin-type-coverage',
            file: anyObject.sourceFile,
            start: modules.typescript.getPositionOfLineAndCharacter(anyObject.sourceFile, anyObject.line, anyObject.character),
            length: anyObject.text.length,
            messageText,
          })
        }
        return diagnostics
      },
    }
    return proxy
  }

  return {
    create,
  };
}

export = init;
