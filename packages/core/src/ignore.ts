import * as ts from 'typescript'
import * as utils from 'tsutils/util'

export function collectIgnoreLines(sourceFile: ts.SourceFile) {
  let ignoreLines: Set<number> | undefined
  utils.forEachComment(sourceFile, (_, comment) => {
    const commentText = comment.kind === ts.SyntaxKind.SingleLineCommentTrivia
      ? sourceFile.text.substring(comment.pos + 2, comment.end).trim()
      : sourceFile.text.substring(comment.pos + 2, comment.end - 2).trim()
    if (commentText.includes('type-coverage:ignore-next-line')) {
      if (!ignoreLines) {
        ignoreLines = new Set()
      }
      const line = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos).line
      ignoreLines.add(line + 1)
    } else if (commentText.includes('type-coverage:ignore-line')) {
      if (!ignoreLines) {
        ignoreLines = new Set()
      }
      const line = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos).line
      ignoreLines.add(line)
    }
  })

  return ignoreLines
}
