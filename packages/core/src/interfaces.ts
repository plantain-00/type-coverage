import ts from 'typescript'

/**
 * @public
 */
export interface FileTypeCheckResult {
  correctCount: number
  totalCount: number
  anys: FileAnyInfo[]
}

export interface AnyInfo extends FileAnyInfo {
  file: string
}

interface FileAnyInfo {
  line: number
  character: number
  text: string
}

export interface LintOptions {
  debug: boolean,
  files?: string[],
  oldProgram?: ts.Program,
  strict: boolean,
  enableCache: boolean,
  ignoreCatch: boolean,
  ignoreFiles?: string | string[]
}

export interface FileContext {
  file: string
  sourceFile: ts.SourceFile
  typeCheckResult: FileTypeCheckResult
  debug: boolean
  strict: boolean
  checker: ts.TypeChecker
  ignoreCatch: boolean
  catchVariables: { [variable: string]: boolean }
  ingoreMap: { [file: string]: Set<number> }
}

interface TypeCheckCache extends FileTypeCheckResult {
  hash: string
}

export interface TypeCheckResult {
  cache: { [file: string]: TypeCheckCache }
}

export interface SourceFileInfo {
  file: string
  sourceFile: ts.SourceFile
  hash: string
  cache?: TypeCheckCache
}
