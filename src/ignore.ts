import ts from 'typescript'
import * as utils from 'tsutils/util'

export function collectIgnoreMap(sourceFile: ts.SourceFile, file: string) {
  const ingoreMap: { [file: string]: Set<number> } = {}

  utils.forEachComment(sourceFile, (_, comment) => {
    const commentText = comment.kind === ts.SyntaxKind.SingleLineCommentTrivia
      ? sourceFile.text.substring(comment.pos + 2, comment.end).trim()
      : sourceFile.text.substring(comment.pos + 2, comment.end - 2).trim()
    if (commentText.includes('type-coverage:ignore-next-line')) {
      if (!ingoreMap[file]) {
        ingoreMap[file] = new Set()
      }
      const line = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos).line
      ingoreMap[file].add(line + 1)
    } else if (commentText.includes('type-coverage:ignore-line')) {
      if (!ingoreMap[file]) {
        ingoreMap[file] = new Set()
      }
      const line = ts.getLineAndCharacterOfPosition(sourceFile, comment.pos).line
      ingoreMap[file].add(line)
    }
  })

  return ingoreMap
}
