import ts from 'typescript'
import * as path from 'path'
import minimatch from 'minimatch'
import { getProjectRootNamesAndCompilerOptions } from 'ts-lib-utils'

import {
  FileContext,
  AnyInfo,
  SourceFileInfo,
  LintOptions,
  FileTypeCheckResult
} from './interfaces'
import { checkNode } from './checker'
import { clearCacheOfDependencies, collectDependencies } from './dependencies'
import { collectIgnoreMap } from './ignore'
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
  const typeCheckResult = await readCache(lintOptions.enableCache)
  const ignoreFileGlobs = lintOptions.ignoreFiles
    ? (typeof lintOptions.ignoreFiles === 'string'
      ? [lintOptions.ignoreFiles]
      : lintOptions.ignoreFiles)
    : undefined
  for (const sourceFile of program.getSourceFiles()) {
    let file = sourceFile.fileName
    if (!file.includes('node_modules') && (!lintOptions.files || lintOptions.files.includes(file))) {
      if (ignoreFileGlobs && ignoreFileGlobs.some((f) => minimatch(file, f))) {
        continue
      }
      allFiles.add(file)
      const hash = await getFileHash(file, lintOptions.enableCache)
      const cache = typeCheckResult.cache[file]
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

    const ingoreMap = collectIgnoreMap(sourceFile, file)
    const context: FileContext = {
      file,
      sourceFile,
      typeCheckResult: {
        correctCount: 0,
        totalCount: 0,
        anys: []
      },
      ignoreCatch: lintOptions.ignoreCatch,
      catchVariables: {},
      debug: lintOptions.debug,
      strict: lintOptions.strict,
      checker,
      ingoreMap
    }

    sourceFile.forEachChild(node => {
      checkNode(node, context)
    })

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
    await saveCache(typeCheckResult)
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
  fileCounts: false,
}
