import * as tsserverlibrary from 'typescript/lib/tsserverlibrary'
import { lintSync, FileAnyInfoKind } from 'type-coverage-core'

interface Option {
  strict: boolean
  ignoreCatch: boolean
  jsEnable: boolean
  ignoreUnreadAnys: boolean
}

function init(modules: { typescript: typeof tsserverlibrary }) {
  let oldProgram: tsserverlibrary.Program | undefined
  let options: Option | undefined

  function create(info: tsserverlibrary.server.PluginCreateInfo) {
    const proxy: tsserverlibrary.LanguageService = {
      ...info.languageService,
      getSemanticDiagnostics(fileName) {
        const prior = info.languageService.getSemanticDiagnostics(fileName)
        if (!options?.jsEnable && (fileName.endsWith('.js') || fileName.endsWith('.jsx'))) {
          return prior
        }
        const result = lintSync(
          info.project.getCompilerOptions(),
          info.project.getRootFiles(),
          {
            ...options,
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
    onConfigurationChanged(config: Option) {
      options = config
    }
  };
}

export = init;
