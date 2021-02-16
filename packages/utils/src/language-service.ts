import * as ts from 'typescript'
import * as fs from 'fs'

/**
 * @public
 */
export function getLanguageService(uniqFiles: string[]) {
  return ts.createLanguageService({
    getCompilationSettings() {
      return {
        jsx: ts.JsxEmit.React
      }
    },
    getScriptFileNames() {
      return uniqFiles
    },
    getScriptVersion() {
      return ''
    },
    getScriptSnapshot(fileName: string) {
      if (fileName === '.ts') {
        return ts.ScriptSnapshot.fromString('')
      }
      return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, { encoding: 'utf8' }))
    },
    getCurrentDirectory: () => '.',
    getDefaultLibFileName(options: ts.CompilerOptions) {
      return ts.getDefaultLibFilePath(options)
    },
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory
  })
}
