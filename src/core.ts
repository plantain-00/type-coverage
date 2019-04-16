import ts from 'typescript'
import * as path from 'path'

import { getTsConfigFilePath, getTsConfig, getRootNames } from './tsconfig'
import { FileContext, AnyInfo, SourceFileInfo } from './interfaces'
import { checkNode } from './checker'
import { clearCacheOfDependencies, collectDependencies } from './dependencies'
import { collectIgnoreMap } from './ignore'
import { readCache, getFileHash, saveCache } from './cache'

// tslint:disable-next-line:no-big-function cognitive-complexity
export async function lint(
  project: string,
  detail: boolean,
  debug: boolean,
  files?: string[],
  oldProgram?: ts.Program,
  strict = false,
  enableCache = false,
  ignoreCatch = false
) {
  const { configFilePath, dirname } = getTsConfigFilePath(project)
  const config = getTsConfig(configFilePath, dirname)

  const { options: compilerOptions, errors } = ts.convertCompilerOptionsFromJson(config.compilerOptions, dirname)
  if (errors && errors.length > 0) {
    throw errors
  }

  const rootNames = await getRootNames(config, dirname)

  const program = ts.createProgram(rootNames, compilerOptions, undefined, oldProgram)
  const checker = program.getTypeChecker()

  const allFiles = new Set<string>()
  const sourceFileInfos: SourceFileInfo[] = []
  const typeCheckResult = await readCache(enableCache)
  for (const sourceFile of program.getSourceFiles()) {
    let file = sourceFile.fileName
    if (!file.includes('node_modules') && (!files || files.includes(file))) {
      file = path.relative(process.cwd(), file)
      allFiles.add(file)
      const hash = await getFileHash(file, enableCache)
      const cache = typeCheckResult.cache[file]
      sourceFileInfos.push({
        file,
        sourceFile,
        hash,
        cache: cache && cache.hash === hash ? cache : undefined
      })
    }
  }

  if (enableCache) {
    const dependencies = collectDependencies(sourceFileInfos, allFiles)

    for (const sourceFileInfo of sourceFileInfos) {
      if (!sourceFileInfo.cache) {
        clearCacheOfDependencies(sourceFileInfo, dependencies, sourceFileInfos)
      }
    }
  }

  let correctCount = 0
  let totalCount = 0
  let anys: AnyInfo[] = []
  for (const { sourceFile, file, hash, cache } of sourceFileInfos) {
    if (cache) {
      correctCount += cache.correctCount
      totalCount += cache.totalCount
      anys.push(...cache.anys.map((a) => ({ file, ...a })))
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
      ignoreCatch,
      catchVariables: {},
      debug,
      detail,
      strict,
      checker,
      ingoreMap
    }

    sourceFile.forEachChild(node => {
      checkNode(node, context)
    })

    correctCount += context.typeCheckResult.correctCount
    totalCount += context.typeCheckResult.totalCount
    anys.push(...context.typeCheckResult.anys.map((a) => ({ file, ...a })))
    if (enableCache) {
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

  if (enableCache) {
    await saveCache(typeCheckResult)
  }

  return { correctCount, totalCount, anys, program }
}
