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

/**
 * @public
 */
export interface FileAnyInfo {
  line: number
  character: number
  text: string
  kind: FileAnyInfoKind
}

export const enum FileAnyInfoKind {
  any = 1, // any
  containsAny = 2, // Promise<any>
  unsafeAs = 3, // foo as string
  unsafeTypeAssertion = 4, // <string>foo
  unsafeNonNull = 5, // foo!
}

/**
 * @public
 */
export type ProccessAny = (node: ts.Node, context: FileContext) => boolean

export interface LintOptions {
  debug: boolean,
  files?: string[],
  oldProgram?: ts.Program,
  strict: boolean,
  enableCache: boolean,
  ignoreCatch: boolean,
  ignoreFiles?: string | string[]
  fileCounts: boolean,
  absolutePath?: boolean,
  processAny?: ProccessAny,
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
  processAny?: ProccessAny
}

interface TypeCheckCache extends FileTypeCheckResult {
  hash: string
}

export interface TypeCheckResult {
  cache: { [file: string]: TypeCheckCache }
}

export interface SourceFileInfo extends SourceFileInfoWithoutCache {
  hash: string
  cache?: TypeCheckCache
}

export interface SourceFileInfoWithoutCache {
  file: string
  sourceFile: ts.SourceFile
}
