import * as path from 'path'
import { createRequire } from 'module'
import { minimatch } from 'minimatch'
import { getTsConfigFilePath } from './tsconfig'
import { AnyInfo, FileAnyInfoKind, FileTypeCheckResult, LintOptions } from './interfaces'

interface Node {
  kind: number
  flags: number
  pos: number
  end: number
  parent: Node | undefined
  forEachChild(visit: (node: Node) => void): void
  getStart(sourceFile: SourceFile): number
  getText(sourceFile: SourceFile): string
}

interface SourceFile extends Node {
  text: string
  getLineAndCharacterOfPosition(position: number): { line: number, character: number }
}

interface Type {
  flags: number
  intrinsicName?: string
}

interface Project {
  program: {
    getSourceFileNames(): readonly string[]
    getSourceFile(fileName: string): SourceFile | undefined
  }
  checker: {
    getTypeAtLocation(nodes: readonly Node[]): Type[]
    getContextualType: { gen(node: Node): unknown }
  }
}

interface Api {
  createSnapshot(params: { openProjects: string[] }): { getProjects(): readonly Project[] }
  batch(...requests: unknown[]): (Type | undefined)[]
  close(): void
}

interface SyncModule {
  API: new (options: { cwd: string }) => Api
  TypeFlags: { Any: number }
}

interface AstModule {
  SyntaxKind: Record<'Identifier' | 'PrivateIdentifier' | 'ThisKeyword' | 'LabeledStatement' | 'BreakStatement' | 'ContinueStatement' | 'JsxExpression', number>
  NodeFlags: { Reparsed: number }
}

type ForEachCommentRange = (text: string, pos: number, callback: (pos: number, end: number) => void) => void

interface ScannerModule {
  forEachLeadingCommentRange: ForEachCommentRange
  forEachTrailingCommentRange: ForEachCommentRange
}

const unsupportedOptions = ['strict', 'enableCache', 'ignoreCatch', 'ignoreUnreadAnys', 'reportSemanticError', 'reportUnusedIgnore', 'oldProgram', 'processAny', 'debug'] as const

export function lintWithTypeScript7(project: string, lintOptions: LintOptions) {
  const unsupported = unsupportedOptions.filter((name) => lintOptions[name])
  if (unsupported.length > 0) {
    throw new Error(`Not supported on TypeScript 7 yet: ${unsupported.join(', ')}`)
  }
  const { sync: { API, TypeFlags }, ast: { SyntaxKind, NodeFlags }, scanner } = loadTypeScript7Api()
  const countedKinds = new Set([SyntaxKind.Identifier, SyntaxKind.PrivateIdentifier, SyntaxKind.ThisKeyword])
  const labelParentKinds = new Set([SyntaxKind.LabeledStatement, SyntaxKind.BreakStatement, SyntaxKind.ContinueStatement])
  const isAny = (type: Type | undefined) => type?.flags === TypeFlags.Any && type.intrinsicName === 'any'
  const ignoreFileGlobs = typeof lintOptions.ignoreFiles === 'string' ? [lintOptions.ignoreFiles] : lintOptions.ignoreFiles
  const tsconfig = path.resolve(getTsConfigFilePath(project).configFilePath)

  const api = new API({ cwd: path.dirname(tsconfig) })
  try {
    const [tsProject] = api.createSnapshot({ openProjects: [tsconfig] }).getProjects()
    if (!tsProject) {
      throw new Error(`TypeScript found no project for ${tsconfig}`)
    }
    const { program, checker } = tsProject

    let correctCount = 0
    let totalCount = 0
    const anys: AnyInfo[] = []
    const fileCounts = new Map<string, Pick<FileTypeCheckResult, 'correctCount' | 'totalCount'>>()
    for (const fileName of program.getSourceFileNames()) {
      if (fileName.includes('node_modules')) {
        continue
      }
      let file = fileName
      if (!lintOptions.absolutePath) {
        file = path.relative(process.cwd(), file)
        if (!lintOptions.notOnlyInCWD && file.startsWith('..')) {
          continue
        }
      }
      if (lintOptions.files && !lintOptions.files.includes(file)) {
        continue
      }
      if (ignoreFileGlobs && ignoreFileGlobs.some((glob) => minimatch(file, glob))) {
        continue
      }
      const sourceFile = program.getSourceFile(fileName)
      if (!sourceFile) {
        continue
      }

      const nodes: Node[] = []
      const visit = (node: Node) => {
        if (node.flags & NodeFlags.Reparsed) {
          return
        }
        if (countedKinds.has(node.kind) && !(node.parent && labelParentKinds.has(node.parent.kind))) {
          nodes.push(node)
        }
        node.forEachChild(visit)
      }
      sourceFile.forEachChild(visit)

      const ignoreLines = sourceFile.text.includes('type-coverage:ignore')
        ? collectIgnoreLines(sourceFile, scanner, SyntaxKind.JsxExpression)
        : undefined
      // A contextual type can only rescue a node whose own type is any, so only those nodes need a second request
      const types = checker.getTypeAtLocation(nodes)
      const candidates = nodes.filter((_, index) => isAny(types[index]))
      const contextualTypes = api.batch(...candidates.map((node) => checker.getContextualType.gen(node)))
      let fileCorrectCount = nodes.length - candidates.length
      candidates.forEach((node, index) => {
        const contextualType = contextualTypes[index]
        if (contextualType && !isAny(contextualType)) {
          fileCorrectCount++
          return
        }
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        if (ignoreLines?.has(line)) {
          fileCorrectCount++
          return
        }
        anys.push({ file, line, character, text: node.getText(sourceFile), kind: FileAnyInfoKind.any })
      })

      correctCount += fileCorrectCount
      totalCount += nodes.length
      if (lintOptions.fileCounts) {
        fileCounts.set(file, { correctCount: fileCorrectCount, totalCount: nodes.length })
      }
    }
    return { correctCount, totalCount, anys, program: undefined, fileCounts }
  } finally {
    api.close()
  }
}

function loadTypeScript7Api() {
  const load = createRequire(__filename)
  try {
    return {
      sync: load('typescript/unstable/sync') as SyncModule,
      ast: load('typescript/unstable/ast') as AstModule,
      scanner: load('typescript/unstable/ast/scanner') as ScannerModule,
    }
  } catch (error) {
    throw new Error(`type-coverage could not load typescript/unstable/*, the TypeScript 7 API. It needs Node.js 20.19 or later, or 22.12 or later.
${error instanceof Error ? error.message : String(error)}`)
  }
}

// TypeScript 7 nodes carry no tokens, so this reads the leading and trailing comments around every node boundary
function collectIgnoreLines(sourceFile: SourceFile, scanner: ScannerModule, jsxExpressionKind: number) {
  const ignoreLines = new Set<number>()
  const seen = new Set<number>()
  const collect = (pos: number, end: number) => {
    if (seen.has(pos)) {
      return
    }
    seen.add(pos)
    const comment = sourceFile.text.slice(pos, end)
    const { line } = sourceFile.getLineAndCharacterOfPosition(pos)
    if (comment.includes('type-coverage:ignore-next-line')) {
      ignoreLines.add(line + 1)
    } else if (comment.includes('type-coverage:ignore-line')) {
      ignoreLines.add(line)
    }
  }
  const visit = (node: Node) => {
    // An empty JSX expression such as {/* comment */} has no child node, so its comment starts right after the brace
    const positions = node.kind === jsxExpressionKind ? [node.pos, node.getStart(sourceFile) + 1, node.end] : [node.pos, node.end]
    for (const pos of positions) {
      scanner.forEachLeadingCommentRange(sourceFile.text, pos, collect)
      scanner.forEachTrailingCommentRange(sourceFile.text, pos, collect)
    }
    node.forEachChild(visit)
  }
  sourceFile.forEachChild(visit)
  return ignoreLines
}
