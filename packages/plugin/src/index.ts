import * as tsserverlibrary from 'typescript/lib/tsserverlibrary'
import { lintSync, LintOptions, FileAnyInfoKind } from 'type-coverage-core'

function init(modules: { typescript: typeof tsserverlibrary }) {
  let oldProgram: ts.Program | undefined
  let lintOptions: LintOptions | undefined

  function create(info: ts.server.PluginCreateInfo) {
    const proxy: tsserverlibrary.LanguageService = {
      ...info.languageService,
      getSemanticDiagnostics(fileName) {
        const prior = info.languageService.getSemanticDiagnostics(fileName)
        const result = lintSync(
          info.project.getCompilerOptions(),
          info.project.getRootFiles(),
          {
            ...(lintOptions || info.config as LintOptions),
            files: [fileName],
            oldProgram,
          },
        )
        oldProgram = result.program
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
          prior.push({
            category: modules.typescript.DiagnosticCategory.Warning,
            code: anyObject.kind,
            source: 'ts-plugin-type-coverage',
            file: anyObject.sourceFile,
            start: modules.typescript.getPositionOfLineAndCharacter(anyObject.sourceFile, anyObject.line, anyObject.character),
            length: anyObject.text.length,
            messageText,
          })
        }
        return prior
      },
    }
    return proxy
  }

  return {
    create,
    onConfigurationChanged(config: LintOptions) {
      lintOptions = config
    }
  };
}

export = init;
