import * as ts from 'typescript'
import * as path from 'path'
import { minimatch } from 'minimatch'
import { getProjectRootNamesAndCompilerOptions } from './tsconfig'

import {
  FileContext,
  AnyInfo,
  SourceFileInfo,
  LintOptions,
  FileTypeCheckResult,
  SourceFileInfoWithoutCache,
  FileAnyInfoKind
} from './interfaces'
import { checkNode } from './checker'
import { clearCacheOfDependencies, collectDependencies } from './dependencies'
import { collectIgnoreLines } from './ignore'
import { readCache, getFileHash, saveCache } from './cache'

/**
 * @public
 */
export async function lint(project: string, options?: Partial<LintOptions>) {
  const lintOptions = { ...defaultLintOptions, ...options }
  const { rootNames, compilerOptions } = await getProjectRootNamesAndCompilerOptions(project)

  const program = ts.createProgram(rootNames, compilerOptions, undefined, lintOptions.oldProgram)
  const checker = program.getTypeChecker()

  const allFiles = new Set<string>()
  const sourceFileInfos: SourceFileInfo[] = []
  const typeCheckResult = await readCache(lintOptions.enableCache, lintOptions.cacheDirectory)
  const ignoreFileGlobs = lintOptions.ignoreFiles
    ? (typeof lintOptions.ignoreFiles === 'string'
      ? [lintOptions.ignoreFiles]
      : lintOptions.ignoreFiles)
    : undefined
  for (const sourceFile of program.getSourceFiles()) {
    let file = sourceFile.fileName
    if (!file.includes('node_modules')) {
      if (!lintOptions.absolutePath) {
        file = path.relative(process.cwd(), file)
        if (!lintOptions.notOnlyInCWD && file.startsWith('..')) {
          continue
        }
      }
      if (lintOptions.files && !lintOptions.files.includes(file)) {
        continue
      }
      if (ignoreFileGlobs && ignoreFileGlobs.some((f) => minimatch(file, f))) {
        continue
      }
      allFiles.add(file)
      const hash = await getFileHash(file, lintOptions.enableCache)
      const cache = typeCheckResult.cache[file]
      if (cache) {
        if (lintOptions.ignoreNested) {
          cache.anys = cache.anys.filter((c) => c.kind !== FileAnyInfoKind.containsAny)
        }
        if (lintOptions.ignoreAsAssertion) {
          cache.anys = cache.anys.filter((c) => c.kind !== FileAnyInfoKind.unsafeAs)
        }
        if (lintOptions.ignoreTypeAssertion) {
          cache.anys = cache.anys.filter((c) => c.kind !== FileAnyInfoKind.unsafeTypeAssertion)
        }
        if (lintOptions.ignoreNonNullAssertion) {
          cache.anys = cache.anys.filter((c) => c.kind !== FileAnyInfoKind.unsafeNonNull)
        }
      }
      sourceFileInfos.push({
        file,
        sourceFile,
        hash,
        cache: cache && cache.hash === hash ? cache : undefined
      })
    }
  }

  if (lintOptions.enableCache) {
    const dependencies = collectDependencies(sourceFileInfos, allFiles)

    for (const sourceFileInfo of sourceFileInfos) {
      if (!sourceFileInfo.cache) {
        clearCacheOfDependencies(sourceFileInfo, dependencies, sourceFileInfos)
      }
    }
  }

  let correctCount = 0
  let totalCount = 0
  const anys: AnyInfo[] = []
  const fileCounts =
    new Map<string, Pick<FileTypeCheckResult, 'correctCount' | 'totalCount'>>()
  for (const { sourceFile, file, hash, cache } of sourceFileInfos) {
    if (cache) {
      correctCount += cache.correctCount
      totalCount += cache.totalCount
      anys.push(...cache.anys.map((a) => ({ file, ...a })))

      if (lintOptions.fileCounts) {
        fileCounts.set(file, {
          correctCount: cache.correctCount,
          totalCount: cache.totalCount,
        })
      }
      continue
    }

    const ignoreLines = collectIgnoreLines(sourceFile)
    const context: FileContext = {
      file,
      sourceFile,
      typeCheckResult: {
        correctCount: 0,
        totalCount: 0,
        anys: []
      },
      ignoreCatch: lintOptions.ignoreCatch,
      ignoreUnreadAnys: lintOptions.ignoreUnreadAnys,
      catchVariables: {},
      debug: lintOptions.debug,
      strict: lintOptions.strict,
      processAny: lintOptions.processAny,
      checker,
      ignoreLines,
      ignoreNested: lintOptions.ignoreNested,
      ignoreAsAssertion: lintOptions.ignoreAsAssertion,
      ignoreTypeAssertion: lintOptions.ignoreTypeAssertion,
      ignoreNonNullAssertion: lintOptions.ignoreNonNullAssertion,
      ignoreObject: lintOptions.ignoreObject,
      ignoreEmptyType: lintOptions.ignoreEmptyType,
    }

    if (lintOptions.reportSemanticError) {
      const diagnostics = program.getSemanticDiagnostics(sourceFile)
      for (const diagnostic of diagnostics) {
        if (diagnostic.start !== undefined) {
          totalCount++
          let text: string
          if (typeof diagnostic.messageText === 'string') {
            text = diagnostic.messageText
          } else {
            text = diagnostic.messageText.messageText
          }
          const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, diagnostic.start)
          anys.push({
            line,
            character,
            text,
            kind: FileAnyInfoKind.semanticError,
            file,
          })
        }
      }
    }

    sourceFile.forEachChild(node => {
      checkNode(node, context)
    })

    if (lintOptions.reportUnusedIgnore && ignoreLines) {
      for (const line of ignoreLines) {
        if (!context.usedIgnoreLines?.has(line)) {
          anys.push({
            line,
            character: 0,
            text: 'Unused ignore line directive(no problems reported on that line)',
            kind: FileAnyInfoKind.unusedIgnore,
            file,
          })
        }
      }
    }

    correctCount += context.typeCheckResult.correctCount
    totalCount += context.typeCheckResult.totalCount
    anys.push(...context.typeCheckResult.anys.map((a) => ({ file, ...a })))

    if (lintOptions.fileCounts) {
      fileCounts.set(file, {
        correctCount: context.typeCheckResult.correctCount,
        totalCount: context.typeCheckResult.totalCount
      })
    }

    if (lintOptions.enableCache) {
      const resultCache = typeCheckResult.cache[file]
      if (resultCache) {
        resultCache.hash = hash
        resultCache.correctCount = context.typeCheckResult.correctCount
        resultCache.totalCount = context.typeCheckResult.totalCount
        resultCache.anys = context.typeCheckResult.anys
      } else {
        typeCheckResult.cache[file] = {
          hash,
          ...context.typeCheckResult
        }
      }
    }
  }

  if (lintOptions.enableCache) {
    await saveCache(typeCheckResult, lintOptions.cacheDirectory)
  }

  return { correctCount, totalCount, anys, program, fileCounts }
}

const defaultLintOptions: LintOptions = {
  debug: false,
  files: undefined,
  oldProgram: undefined,
  strict: false,
  enableCache: false,
  ignoreCatch: false,
  ignoreFiles: undefined,
  ignoreUnreadAnys: false,
  fileCounts: false,
  ignoreNested: false,
  ignoreAsAssertion: false,
  ignoreTypeAssertion: false,
  ignoreNonNullAssertion: false,
  ignoreObject: false,
  ignoreEmptyType: false,
  reportSemanticError: false,
  reportUnusedIgnore: false,
}

/**
 * @public
 */
export function lintSync(compilerOptions: ts.CompilerOptions, rootNames: string[], options?: Partial<LintOptions>) {
  const lintOptions = { ...defaultLintOptions, ...options }

  const program = ts.createProgram(rootNames, compilerOptions, undefined, lintOptions.oldProgram)
  const checker = program.getTypeChecker()

  const allFiles = new Set<string>()
  const sourceFileInfos: SourceFileInfoWithoutCache[] = []
  const ignoreFileGlobs = lintOptions.ignoreFiles
    ? (typeof lintOptions.ignoreFiles === 'string'
      ? [lintOptions.ignoreFiles]
      : lintOptions.ignoreFiles)
    : undefined
  for (const sourceFile of program.getSourceFiles()) {
    let file = sourceFile.fileName
    if (!file.includes('node_modules') && (!lintOptions.files || lintOptions.files.includes(file))) {
      if (!lintOptions.absolutePath) {
        file = path.relative(process.cwd(), file)
        if (!lintOptions.notOnlyInCWD && file.startsWith('..')) {
          continue
        }
      }
      if (ignoreFileGlobs && ignoreFileGlobs.some((f) => minimatch(file, f))) {
        continue
      }
      allFiles.add(file)
      sourceFileInfos.push({
        file,
        sourceFile,
      })
    }
  }

  let correctCount = 0
  let totalCount = 0
  const anys: Array<AnyInfo & { sourceFile: ts.SourceFile }> = []
  const fileCounts =
    new Map<string, Pick<FileTypeCheckResult, 'correctCount' | 'totalCount'>>()
  for (const { sourceFile, file } of sourceFileInfos) {
    const ignoreLines = collectIgnoreLines(sourceFile)
    const context: FileContext = {
      file,
      sourceFile,
      typeCheckResult: {
        correctCount: 0,
        totalCount: 0,
        anys: []
      },
      ignoreCatch: lintOptions.ignoreCatch,
      ignoreUnreadAnys: lintOptions.ignoreUnreadAnys,
      catchVariables: {},
      debug: lintOptions.debug,
      strict: lintOptions.strict,
      processAny: lintOptions.processAny,
      checker,
      ignoreLines,
      ignoreNested: lintOptions.ignoreNested,
      ignoreAsAssertion: lintOptions.ignoreAsAssertion,
      ignoreTypeAssertion: lintOptions.ignoreTypeAssertion,
      ignoreNonNullAssertion: lintOptions.ignoreNonNullAssertion,
      ignoreObject: lintOptions.ignoreObject,
      ignoreEmptyType: lintOptions.ignoreEmptyType,
    }

    sourceFile.forEachChild(node => {
      checkNode(node, context)
    })

    correctCount += context.typeCheckResult.correctCount
    totalCount += context.typeCheckResult.totalCount
    anys.push(...context.typeCheckResult.anys.map((a) => ({ file, ...a, sourceFile })))

    if (lintOptions.fileCounts) {
      fileCounts.set(file, {
        correctCount: context.typeCheckResult.correctCount,
        totalCount: context.typeCheckResult.totalCount
      })
    }
  }

  return { correctCount, totalCount, anys, program, fileCounts }
}
