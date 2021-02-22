import * as ts from 'typescript'

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

export interface LintOptions extends CommonOptions {
  files?: string[],
  oldProgram?: ts.Program,
  enableCache: boolean,
  ignoreFiles?: string | string[],
  fileCounts: boolean,
  absolutePath?: boolean,
}

interface CommonOptions {
  debug: boolean,
  strict: boolean,
  ignoreCatch: boolean,
  ignoreUnreadAnys: boolean,
  processAny?: ProccessAny,
  /**
   * Promise<any>
   */
  ignoreNested: boolean
  /**
   * foo as string
   */
  ignoreAsAssertion: boolean
  /**
   * <string>foo
   */
  ignoreTypeAssertion: boolean
  /**
   * foo!
   */
  ignoreNonNullAssertion: boolean
}

export interface FileContext extends CommonOptions {
  file: string
  sourceFile: ts.SourceFile
  typeCheckResult: FileTypeCheckResult
  checker: ts.TypeChecker
  catchVariables: { [variable: string]: boolean }
  ingoreMap: { [file: string]: Set<number> }
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
