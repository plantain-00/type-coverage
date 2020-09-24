import ts from 'typescript'

/**
 * @public
 */
export function getJsDocs(node: ts.Node) {
  const jsDocs = (node as unknown as { jsDoc?: ts.JSDoc[] }).jsDoc
  const result: JsDoc[] = []
  if (jsDocs && jsDocs.length > 0) {
    for (const jsDoc of jsDocs) {
      if (jsDoc.tags) {
        for (const tag of jsDoc.tags) {
          result.push(getJsDocFromTag(tag))
        }
      }
    }
  }
  return result
}

function getJsDocFromTag(tag: ts.JSDocTag) {
  let type: ts.TypeNode | undefined
  let paramName: string | undefined
  let optional: boolean | undefined
  if (tag.tagName.text === 'param') {
    const typeExpression = (tag as unknown as { typeExpression?: ts.JSDocTypeExpression }).typeExpression
    if (typeExpression) {
      type = typeExpression.type
      paramName = (tag as unknown as { name: ts.Identifier }).name.text
      optional = (tag as unknown as { isBracketed?: boolean }).isBracketed
    }
  }
  return {
    name: tag.tagName.text,
    type,
    paramName,
    comment: tag.comment,
    optional
  }
}

/**
 * @public
 */
export interface JsDoc {
  name: string;
  type?: ts.TypeNode;
  paramName?: string;
  comment?: string;
  optional?: boolean;
}
