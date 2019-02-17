import ts from 'typescript'
import * as path from 'path'

import { SourceFileInfo } from './interfaces'

export function collectDependencies(sourceFileInfos: SourceFileInfo[], allFiles: string[]) {
  const dependencies: [string, string][] = []
  for (const { sourceFile, file } of sourceFileInfos) {
    sourceFile.forEachChild(node => {
      let source: string | undefined
      if (node.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
        source = (node as ts.ImportEqualsDeclaration).name.text
      } else if (node.kind === ts.SyntaxKind.ImportDeclaration) {
        source = ((node as ts.ImportDeclaration).moduleSpecifier as ts.Identifier).text
      }
      if (source
        && (source.startsWith('.') || source.startsWith('/'))
        && !source.endsWith('.json')
        && !source.endsWith('.node')
      ) {
        const resolveResult = resolveImport(path.relative(process.cwd(), path.resolve(path.dirname(file), source)), allFiles)
        dependencies.push([file, resolveResult])
      }
    })
  }
  return dependencies
}

function resolveImport(moduleName: string, allFiles: string[]) {
  let resolveResult = moduleName + '.ts'
  if (allFiles.includes(resolveResult)) {
    return resolveResult
  }

  resolveResult = moduleName + '.tsx'
  if (allFiles.includes(resolveResult)) {
    return resolveResult
  }

  resolveResult = moduleName + '.d.ts'
  if (allFiles.includes(resolveResult)) {
    return resolveResult
  }

  resolveResult = path.resolve(moduleName, 'index.ts')
  if (allFiles.includes(resolveResult)) {
    return resolveResult
  }

  resolveResult = path.resolve(moduleName, 'index.tsx')
  if (allFiles.includes(resolveResult)) {
    return resolveResult
  }

  resolveResult = path.resolve(moduleName, 'index.d.ts')
  if (allFiles.includes(resolveResult)) {
    return resolveResult
  }

  return moduleName
}

export function clearCacheOfDependencies(
  sourceFileInfo: SourceFileInfo,
  dependencies: [string, string][],
  sourceFileInfos: SourceFileInfo[]
) {
  for (const dependency of dependencies) {
    if (dependency[1] === sourceFileInfo.file) {
      const dependentSourceFileInfo = sourceFileInfos.find((s) => s.file === dependency[0])
      if (dependentSourceFileInfo && dependentSourceFileInfo.cache) {
        dependentSourceFileInfo.cache = undefined
        clearCacheOfDependencies(dependentSourceFileInfo, dependencies, sourceFileInfos)
      }
    }
  }
}
