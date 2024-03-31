import * as ts from 'typescript'

import { FileAnyInfoKind, FileContext } from './interfaces'

function collectAny(node: ts.Node, context: FileContext, kind: FileAnyInfoKind) {
  const { file, sourceFile, typeCheckResult, ingoreMap, ignoreUnreadAnys, debug, processAny } = context
  if (processAny !== undefined) {
    return processAny(node, context)
  }
  const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile))
  if (ingoreMap[file] && ingoreMap[file]?.has(line)) {
    return false
  }
  if (ignoreUnreadAnys && isEvolvingAssignment(node)) {
    if (debug) {
      console.log(`Ignoring assignment to implicit any type: ${file}:${line + 1}:${character + 1}: ${node.parent.getText(sourceFile)}`)
    }
    return false
  }
  if (debug) {
    console.log(`type === any(${kind}): ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)}`)
  } else {
    typeCheckResult.anys.push({ line, character, text: node.getText(sourceFile), kind })
  }
  return true
}

function collectNotAny(node: ts.Node, { file, sourceFile, typeCheckResult, debug }: FileContext, type: ts.Type) {
  typeCheckResult.correctCount++
  if (debug) {
    const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile))
    console.log(`type !== any: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)} ${node.kind}(kind) ${type.flags}(flag) ${(type as unknown as { intrinsicName: string }).intrinsicName || ''}`)
  }
}

function collectData(node: ts.Node, context: FileContext) {
  const types: ts.Type[] = []
  const type = context.checker.getTypeAtLocation(node)
  if (type) {
    types.push(type)
  }
  const contextualType = context.checker.getContextualType(node as ts.Expression)
  if (contextualType) {
    types.push(contextualType)
  }

  if (types.length > 0) {
    context.typeCheckResult.totalCount++
    if (types.every((t) => typeIsAnyOrInTypeArguments(t, context.strict && !context.ignoreNested, context))) {
      const kind = types.every((t) => typeIsAnyOrInTypeArguments(t, false, context)) ? FileAnyInfoKind.any : FileAnyInfoKind.containsAny
      const success = collectAny(node, context, kind)
      if (!success) {
        collectNotAny(node, context, type)
      }
    } else {
      collectNotAny(node, context, type)
    }
  }
}

function typeIsAnyOrInTypeArguments(type: ts.Type, anyCanBeInTypeArguments: boolean, context: FileContext): boolean {
  if (type.flags === ts.TypeFlags.Any) {
    return (type as unknown as { intrinsicName: string }).intrinsicName === 'any'
  }
  if (type.flags === ts.TypeFlags.Object && type.symbol) {
    // foo: Object
    if (context.strict && !context.ignoreObject && type.symbol.escapedName === 'Object') {
      return true
    }
    // foo: {}
    if (
      context.strict &&
      !context.ignoreEmptyType &&
      (type as unknown as { objectFlags: ts.ObjectFlags }).objectFlags === ts.ObjectFlags.Anonymous &&
      type.getProperties().length === 0 &&
      type.getCallSignatures().length === 0 &&
      type.getConstructSignatures().length === 0 &&
      type.symbol.flags === (ts.SymbolFlags.Transient | ts.SymbolFlags.TypeLiteral) &&
      !type.symbol.members?.size
    ) {
      return true
    }
  }
  if (anyCanBeInTypeArguments && type.flags === ts.TypeFlags.Object) {
    const typeArguments = (type as ts.TypeReference).typeArguments
    if (typeArguments) {
      return typeArguments.some((typeArgument) => typeIsAnyOrInTypeArguments(typeArgument, anyCanBeInTypeArguments, context))
    }
  }
  return false
}

// See https://github.com/plantain-00/type-coverage/issues/28
function isEvolvingAssignment(node: ts.Node) {
  const { parent } = node;
  if (ts.isVariableDeclaration(parent)) {
    // Match "let foo" and "let foo = null" but not "let foo: any".
    return !parent.type;
  }
  if (ts.isBinaryExpression(parent)) {
    // Match "foo = 123".
    return parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  }
  return false;
}

function checkNodes(nodes: ts.NodeArray<ts.Node> | undefined, context: FileContext): void {
  if (nodes === undefined) {
    return
  }

  for (const node of nodes) {
    checkNode(node, context)
  }
}

const isTypeAssertionExpression = ts.isTypeAssertionExpression || (ts as { isTypeAssertion?: typeof ts.isTypeAssertionExpression }).isTypeAssertion

function checkTypeAssertion(node: ts.Node, context: FileContext, kind: FileAnyInfoKind) {
  if (context.strict) {
    if (kind === FileAnyInfoKind.unsafeNonNull && context.ignoreNonNullAssertion) {
      return
    }
    if (kind === FileAnyInfoKind.unsafeAs && context.ignoreAsAssertion) {
      return
    }
    if (kind === FileAnyInfoKind.unsafeTypeAssertion && context.ignoreTypeAssertion) {
      return
    }

    // include `foo as any` and `<any>foo`
    if ((ts.isAsExpression(node) || isTypeAssertionExpression(node)) && node.type.kind !== ts.SyntaxKind.AnyKeyword) {
      // exclude `foo as const` and `<const>foo`
      if (ts.isTypeReferenceNode(node.type) && node.type.getText() === 'const') {
        return
      }
      // exclude `foo as unknown` and `<unknown>foo`
      if (node.type.kind === ts.SyntaxKind.UnknownKeyword) {
        return
      }
      // exclude safe type assertion powered by isTypeAssignableTo
      const checker = context.checker
      if (checker.isTypeAssignableTo
        && checker.isTypeAssignableTo(checker.getTypeAtLocation(node.expression), checker.getTypeFromTypeNode(node.type))) {
        return
      }
    }
    const success = collectAny(node, context, kind)
    if (success) {
      context.typeCheckResult.totalCount++
    }
  }
}

export function checkNode(node: ts.Node | undefined, context: FileContext): void {
  if (node === undefined) {
    return
  }

  if (context.debug) {
    const { line, character } = ts.getLineAndCharacterOfPosition(context.sourceFile, node.getStart(context.sourceFile))
    console.log(`node: ${context.file}:${line + 1}:${character + 1}: ${node.getText(context.sourceFile)} ${node.kind}(kind)`)
  }

  checkNodes((node as { decorators?: ts.NodeArray<ts.Node> }).decorators, context)
  checkNodes((node as { modifiers?: ts.NodeArray<ts.Node> }).modifiers, context)

  if (skippedNodeKinds.has(node.kind)) {
    return
  }

  if (node.kind === ts.SyntaxKind.ThisKeyword) {
    collectData(node, context)
    return
  }
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier?.(node)) {
    if (context.catchVariables[node.escapedText as string]) {
      return
    }
    collectData(node, context)
    return
  }
  if (ts.isQualifiedName(node)) {
    checkNode(node.left, context)
    checkNode(node.right, context)
    return
  }
  if (ts.isComputedPropertyName(node)) {
    checkNode(node.expression, context)
    return
  }
  if (ts.isTypeParameterDeclaration(node)) {
    checkNode(node.name, context)
    checkNode(node.default, context)
    checkNode(node.expression, context)
    checkNode(node.constraint, context)
    return
  }
  if (ts.isParameter(node)) {
    checkNode(node.dotDotDotToken, context)
    checkNode(node.name, context)
    checkNode(node.initializer, context)
    checkNode(node.type, context)
    checkNode(node.questionToken, context)
    return
  }
  if (ts.isDecorator(node)) {
    checkNode(node.expression, context)
    return
  }
  if (ts.isPropertySignature(node)
    || ts.isPropertyDeclaration(node)) {
    checkNode(node.name, context)
    checkNode(node.questionToken, context)
    checkNode(node.type, context)
    checkNode((node as { initializer?: ts.Node }).initializer, context)
    return
  }
  if (ts.isMethodSignature(node)
    || ts.isCallSignatureDeclaration(node)
    || ts.isConstructSignatureDeclaration(node)
    || ts.isIndexSignatureDeclaration(node)) {
    checkNode(node.name, context)
    checkNodes(node.parameters, context)
    checkNode(node.questionToken, context)
    checkNode(node.type, context)
    checkNodes(node.typeParameters, context)
    return
  }
  if (ts.isFunctionTypeNode(node)
    || ts.isConstructorTypeNode(node)) {
    checkNode(node.name, context)
    checkNodes(node.parameters, context)
    checkNode(node.type, context)
    checkNodes(node.typeParameters, context)
    return
  }
  if (ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isFunctionDeclaration(node)) {
    checkNode(node.name, context)
    checkNodes(node.parameters, context)
    checkNode(node.body, context)
    checkNode(node.asteriskToken, context)
    checkNode(node.questionToken, context)
    checkNode(node.type, context)
    checkNodes(node.typeParameters, context)
    return
  }
  if (ts.isTypePredicateNode(node)) {
    checkNode(node.type, context)
    checkNode(node.parameterName, context)
    return
  }
  if (ts.isTypeReferenceNode(node)) {
    checkNode(node.typeName, context)
    checkNodes(node.typeArguments, context)
    return
  }
  if (ts.isTypeQueryNode(node)) {
    checkNode(node.exprName, context)
    return
  }
  if (ts.isTypeLiteralNode(node)) {
    checkNodes(node.members, context)
    return
  }
  if (ts.isArrayTypeNode(node)) {
    checkNode(node.elementType, context)
    return
  }
  if (ts.isTupleTypeNode(node)) {
    checkNodes(node.elements, context)
    // for typescript < 4
    checkNodes((node as { elementTypes?: ts.NodeArray<ts.Node> }).elementTypes, context)
    return
  }
  if (ts.isUnionTypeNode(node)
    || ts.isIntersectionTypeNode(node)
    || ts.isHeritageClause(node)) {
    checkNodes(node.types, context)
    return
  }
  if (ts.isConditionalTypeNode(node)) {
    checkNode(node.checkType, context)
    checkNode(node.extendsType, context)
    checkNode(node.trueType, context)
    checkNode(node.falseType, context)
    return
  }
  if (ts.isInferTypeNode(node)) {
    checkNode(node.typeParameter, context)
    return
  }
  if (ts.isParenthesizedTypeNode(node)
    || ts.isTypeOperatorNode(node)) {
    checkNode(node.type, context)
    return
  }
  if (ts.isIndexedAccessTypeNode(node)) {
    checkNode(node.objectType, context)
    checkNode(node.indexType, context)
    return
  }
  if (ts.isMappedTypeNode(node)) {
    checkNode(node.questionToken, context)
    checkNode(node.readonlyToken, context)
    checkNode(node.type, context)
    checkNode(node.typeParameter, context)
    return
  }
  if (ts.isLiteralTypeNode(node)) {
    checkNode(node.literal, context)
    return
  }
  if (ts.isImportTypeNode(node)) {
    checkNode(node.qualifier, context)
    checkNode(node.argument, context)
    checkNodes(node.typeArguments, context)
    return
  }
  if (ts.isObjectBindingPattern(node)
    || ts.isArrayBindingPattern(node)
    || ts.isArrayLiteralExpression(node)
    || ts.isNamedImports(node)
    || ts.isNamedExports(node)) {
    checkNodes(node.elements, context)
    return
  }
  if (ts.isBindingElement(node)) {
    checkNode(node.name, context)
    checkNode(node.initializer, context)
    checkNode(node.dotDotDotToken, context)
    checkNode(node.propertyName, context)
    return
  }
  if (ts.isObjectLiteralExpression(node)
    || ts.isJsxAttributes(node)) {
    checkNodes(node.properties, context)
    return
  }
  if (ts.isPropertyAccessExpression(node)
    || ts.isExportAssignment(node)
    || ts.isJsxSpreadAttribute(node)
    || ts.isSpreadAssignment(node)) {
    checkNode(node.expression, context)
    checkNode(node.name, context)
    return
  }
  if (ts.isElementAccessExpression(node)) {
    checkNode(node.expression, context)
    checkNode(node.argumentExpression, context)
    return
  }
  if (ts.isCallExpression(node)
    || ts.isNewExpression(node)) {
    checkNode(node.expression, context)
    checkNodes(node.arguments, context)
    checkNodes(node.typeArguments, context)
    return
  }
  if (isTypeAssertionExpression(node)) {
    checkTypeAssertion(node, context, FileAnyInfoKind.unsafeTypeAssertion)
    checkNode(node.expression, context)
    checkNode(node.type, context)
    return
  }
  if (ts.isParenthesizedExpression(node)
    || ts.isDeleteExpression(node)
    || ts.isTypeOfExpression(node)
    || ts.isVoidExpression(node)
    || ts.isAwaitExpression(node)
    || ts.isYieldExpression(node)
    || ts.isSpreadElement(node)
    || ts.isExpressionStatement(node)
    || ts.isReturnStatement(node)
    || ts.isThrowStatement(node)
    || ts.isExternalModuleReference(node)) {
    checkNode(node.expression, context)
    return
  }
  if (ts.isTaggedTemplateExpression(node)) {
    checkNode(node.template, context)
    return
  }
  if (ts.isPrefixUnaryExpression(node)
    || ts.isPostfixUnaryExpression(node)) {
    checkNode(node.operand, context)
    return
  }
  if (ts.isBinaryExpression(node)) {
    checkNode(node.left, context)
    checkNode(node.right, context)
    checkNode(node.operatorToken, context)
    return
  }
  if (ts.isConditionalExpression(node)) {
    checkNode(node.condition, context)
    checkNode(node.colonToken, context)
    checkNode(node.questionToken, context)
    checkNode(node.whenTrue, context)
    checkNode(node.whenFalse, context)
    return
  }
  if (ts.isTemplateExpression(node)) {
    checkNodes(node.templateSpans, context)
    return
  }
  if (ts.isClassExpression(node)
    || ts.isClassDeclaration(node)
    || ts.isInterfaceDeclaration(node)) {
    checkNode(node.name, context)
    checkNodes(node.typeParameters, context)
    checkNodes(node.members, context)
    checkNodes(node.heritageClauses, context)
    return
  }
  if (ts.isExpressionWithTypeArguments(node)) {
    checkNode(node.expression, context)
    checkNodes(node.typeArguments, context)
    return
  }
  if (ts.isAsExpression(node)) {
    checkTypeAssertion(node, context, FileAnyInfoKind.unsafeAs)
    checkNode(node.expression, context)
    checkNode(node.type, context)
    return
  }
  if (ts.isNonNullExpression(node)) {
    checkTypeAssertion(node, context, FileAnyInfoKind.unsafeNonNull)
    checkNode(node.expression, context)
    return
  }
  if (ts.isMetaProperty(node)
    || ts.isSemicolonClassElement(node)
    || ts.isNamespaceExportDeclaration(node)
    || ts.isNamespaceImport(node)
    || ts.isMissingDeclaration(node)) {
    checkNode(node.name, context)
    return
  }
  if (ts.isTemplateSpan(node)) {
    checkNode(node.expression, context)
    checkNode(node.literal, context)
    return
  }
  if (ts.isBlock(node)
    || ts.isModuleBlock(node)
    || ts.isDefaultClause(node)) {
    checkNodes(node.statements, context)
    return
  }
  if (ts.isVariableStatement(node)) {
    checkNode(node.declarationList, context)
    return
  }
  if (ts.isIfStatement(node)) {
    checkNode(node.expression, context)
    checkNode(node.thenStatement, context)
    checkNode(node.elseStatement, context)
    return
  }
  if (ts.isDoStatement(node)
    || ts.isWhileStatement(node)
    || ts.isWithStatement(node)) {
    checkNode(node.expression, context)
    checkNode(node.statement, context)
    return
  }
  if (ts.isForStatement(node)) {
    checkNode(node.initializer, context)
    checkNode(node.condition, context)
    checkNode(node.incrementor, context)
    checkNode(node.statement, context)
    return
  }
  if (ts.isForInStatement(node)) {
    checkNode(node.initializer, context)
    checkNode(node.expression, context)
    checkNode(node.statement, context)
    return
  }
  if (ts.isForOfStatement(node)) {
    checkNode(node.initializer, context)
    checkNode(node.statement, context)
    checkNode(node.expression, context)
    checkNode(node.awaitModifier, context)
    return
  }
  if (ts.isSwitchStatement(node)) {
    checkNode(node.expression, context)
    checkNode(node.caseBlock, context)
    return
  }
  if (ts.isLabeledStatement(node)) {
    checkNode(node.label, context)
    checkNode(node.statement, context)
    return
  }
  if (ts.isTryStatement(node)) {
    checkNode(node.tryBlock, context)
    checkNode(node.catchClause, context)
    checkNode(node.finallyBlock, context)
    return
  }
  if (ts.isVariableDeclaration(node)) {
    checkNode(node.name, context)
    checkNode(node.type, context)
    checkNode(node.initializer, context)
    return
  }
  if (ts.isVariableDeclarationList(node)) {
    checkNodes(node.declarations, context)
    return
  }
  if (ts.isTypeAliasDeclaration(node)) {
    checkNode(node.name, context)
    checkNode(node.type, context)
    checkNodes(node.typeParameters, context)
    return
  }
  if (ts.isEnumDeclaration(node)) {
    checkNode(node.name, context)
    checkNodes(node.members, context)
    return
  }
  if (ts.isModuleDeclaration(node)) {
    checkNode(node.name, context)
    checkNode(node.body, context)
    return
  }
  if (ts.isCaseBlock(node)) {
    checkNodes(node.clauses, context)
    return
  }
  if (ts.isImportEqualsDeclaration(node)) {
    checkNode(node.name, context)
    checkNode(node.moduleReference, context)
    return
  }
  if (ts.isImportDeclaration(node)) {
    checkNode(node.importClause, context)
    checkNode(node.moduleSpecifier, context)
    return
  }
  if (ts.isImportClause(node)) {
    checkNode(node.name, context)
    checkNode(node.namedBindings, context)
    return
  }
  if (ts.isImportSpecifier(node)
    || ts.isExportSpecifier(node)) {
    checkNode(node.name, context)
    checkNode(node.propertyName, context)
    return
  }
  if (ts.isExportDeclaration(node)) {
    checkNode(node.exportClause, context)
    checkNode(node.name, context)
    checkNode(node.moduleSpecifier, context)
    return
  }
  if (ts.isJsxElement(node)) {
    checkNode(node.openingElement, context)
    checkNode(node.closingElement, context)
    checkNodes(node.children, context)
    return
  }
  if (ts.isJsxSelfClosingElement(node)
    || ts.isJsxOpeningElement(node)) {
    checkNode(node.attributes, context)
    checkNode(node.tagName, context)
    return
  }
  if (ts.isJsxClosingElement(node)) {
    checkNode(node.tagName, context)
    return
  }
  if (ts.isJsxFragment(node)) {
    checkNode(node.openingFragment, context)
    checkNode(node.closingFragment, context)
    checkNodes(node.children, context)
    return
  }
  if (ts.isJsxAttribute(node)) {
    checkNode(node.name, context)
    checkNode(node.initializer, context)
    return
  }
  if (ts.isJsxExpression(node)) {
    checkNode(node.dotDotDotToken, context)
    checkNode(node.expression, context)
    return
  }
  if (ts.isCaseClause(node)) {
    checkNodes(node.statements, context)
    checkNode(node.expression, context)
    return
  }
  if (ts.isCatchClause(node)) {
    if (context.ignoreCatch) {
      const copyContext = Object.assign({}, context)
      copyContext.catchVariables = Object.assign({}, context.catchVariables)
      if (node.variableDeclaration) {
        const decl = node.variableDeclaration
        if (decl.name.kind === ts.SyntaxKind.Identifier) {
          copyContext.catchVariables[
            decl.name.escapedText as string
          ] = true
        }
      }

      checkNode(node.variableDeclaration, copyContext)
    } else {
      checkNode(node.block, context)
      checkNode(node.variableDeclaration, context)
    }
    return
  }
  if (ts.isPropertyAssignment(node)) {
    checkNode(node.name, context)
    checkNode((node as { questionToken?: ts.Node }).questionToken, context)
    checkNode(node.initializer, context)
    return
  }
  if (ts.isShorthandPropertyAssignment(node)) {
    checkNode(node.name, context)
    checkNode((node as { questionToken?: ts.Node }).questionToken, context)
    checkNode(node.equalsToken, context)
    checkNode(node.objectAssignmentInitializer, context)
    return
  }
  if (node.kind === ts.SyntaxKind.RestType) {
    checkNode((node as ts.RestTypeNode).type, context)
    return
  }
  if (ts.isNamedTupleMember(node)) {
    checkNode(node.name, context)
    checkNode(node.type, context)
    return
  }
  if (ts.isTemplateLiteralTypeNode(node)) {
    checkNode(node.head, context)
    checkNodes(node.templateSpans, context)
    return
  }
  if (ts.isTemplateLiteralTypeSpan(node)) {
    checkNode(node.literal, context)
    checkNode(node.type, context)
    return
  }
  if (ts.isNamespaceExport(node)) {
    checkNode(node.name, context)
    return
  }
  if (ts.isSatisfiesExpression(node)) {
    checkNode(node.expression, context)
    checkNode(node.type, context)
    return
  }
  const { line, character } = ts.getLineAndCharacterOfPosition(context.sourceFile, node.getStart(context.sourceFile))
  console.log(`warning: unhandled node kind: ${node.kind} in ${context.file}:${line + 1}:${character + 1}`)
}

const skippedNodeKinds = new Set([
  ts.SyntaxKind.Unknown,
  ts.SyntaxKind.EndOfFileToken,
  ts.SyntaxKind.SingleLineCommentTrivia,
  ts.SyntaxKind.MultiLineCommentTrivia,
  ts.SyntaxKind.NewLineTrivia,
  ts.SyntaxKind.WhitespaceTrivia,
  ts.SyntaxKind.ShebangTrivia,
  ts.SyntaxKind.ConflictMarkerTrivia,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.JsxText,
  ts.SyntaxKind.JsxTextAllWhiteSpaces,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.OpenBraceToken,
  ts.SyntaxKind.CloseBraceToken,
  ts.SyntaxKind.OpenParenToken,
  ts.SyntaxKind.CloseParenToken,
  ts.SyntaxKind.OpenBracketToken,
  ts.SyntaxKind.CloseBracketToken,
  ts.SyntaxKind.DotToken,
  ts.SyntaxKind.DotDotDotToken,
  ts.SyntaxKind.SemicolonToken,
  ts.SyntaxKind.CommaToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanSlashToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsGreaterThanToken,
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.AsteriskAsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
  ts.SyntaxKind.PlusPlusToken,
  ts.SyntaxKind.MinusMinusToken,
  ts.SyntaxKind.LessThanLessThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
  ts.SyntaxKind.AmpersandToken,
  ts.SyntaxKind.BarToken,
  ts.SyntaxKind.CaretToken,
  ts.SyntaxKind.ExclamationToken,
  ts.SyntaxKind.TildeToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionToken,
  ts.SyntaxKind.ColonToken,
  ts.SyntaxKind.AtToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.BreakKeyword,
  ts.SyntaxKind.CaseKeyword,
  ts.SyntaxKind.CatchKeyword,
  ts.SyntaxKind.ClassKeyword,
  ts.SyntaxKind.ConstKeyword,
  ts.SyntaxKind.ContinueKeyword,
  ts.SyntaxKind.DebuggerKeyword,
  ts.SyntaxKind.DefaultKeyword,
  ts.SyntaxKind.DeleteKeyword,
  ts.SyntaxKind.DoKeyword,
  ts.SyntaxKind.ElseKeyword,
  ts.SyntaxKind.EnumKeyword,
  ts.SyntaxKind.ExportKeyword,
  ts.SyntaxKind.ExtendsKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.FinallyKeyword,
  ts.SyntaxKind.ForKeyword,
  ts.SyntaxKind.FunctionKeyword,
  ts.SyntaxKind.IfKeyword,
  ts.SyntaxKind.ImportKeyword,
  ts.SyntaxKind.InKeyword,
  ts.SyntaxKind.InstanceOfKeyword,
  ts.SyntaxKind.NewKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.ReturnKeyword,
  ts.SyntaxKind.SuperKeyword,
  ts.SyntaxKind.SwitchKeyword,
  ts.SyntaxKind.ThrowKeyword,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.TryKeyword,
  ts.SyntaxKind.TypeOfKeyword,
  ts.SyntaxKind.VarKeyword,
  ts.SyntaxKind.VoidKeyword,
  ts.SyntaxKind.WhileKeyword,
  ts.SyntaxKind.WithKeyword,
  ts.SyntaxKind.ImplementsKeyword,
  ts.SyntaxKind.InterfaceKeyword,
  ts.SyntaxKind.LetKeyword,
  ts.SyntaxKind.PackageKeyword,
  ts.SyntaxKind.PrivateKeyword,
  ts.SyntaxKind.ProtectedKeyword,
  ts.SyntaxKind.PublicKeyword,
  ts.SyntaxKind.StaticKeyword,
  ts.SyntaxKind.YieldKeyword,
  ts.SyntaxKind.AbstractKeyword,
  ts.SyntaxKind.AccessorKeyword,
  ts.SyntaxKind.AsKeyword,
  ts.SyntaxKind.AnyKeyword,
  ts.SyntaxKind.AsyncKeyword,
  ts.SyntaxKind.AwaitKeyword,
  ts.SyntaxKind.BooleanKeyword,
  ts.SyntaxKind.ConstructorKeyword,
  ts.SyntaxKind.DeclareKeyword,
  ts.SyntaxKind.GetKeyword,
  ts.SyntaxKind.IsKeyword,
  ts.SyntaxKind.KeyOfKeyword,
  ts.SyntaxKind.ModuleKeyword,
  ts.SyntaxKind.NamespaceKeyword,
  ts.SyntaxKind.NeverKeyword,
  ts.SyntaxKind.ReadonlyKeyword,
  ts.SyntaxKind.RequireKeyword,
  ts.SyntaxKind.NumberKeyword,
  ts.SyntaxKind.ObjectKeyword,
  ts.SyntaxKind.SetKeyword,
  ts.SyntaxKind.StringKeyword,
  ts.SyntaxKind.SymbolKeyword,
  ts.SyntaxKind.TypeKeyword,
  ts.SyntaxKind.UndefinedKeyword,
  ts.SyntaxKind.UniqueKeyword,
  ts.SyntaxKind.UnknownKeyword,
  ts.SyntaxKind.FromKeyword,
  ts.SyntaxKind.GlobalKeyword,
  ts.SyntaxKind.BigIntKeyword,
  ts.SyntaxKind.OverrideKeyword,
  ts.SyntaxKind.OfKeyword,
  ts.SyntaxKind.OptionalType,
  ts.SyntaxKind.ThisType,
  ts.SyntaxKind.OmittedExpression,
  ts.SyntaxKind.EmptyStatement,
  ts.SyntaxKind.ContinueStatement,
  ts.SyntaxKind.BreakStatement,
  ts.SyntaxKind.DebuggerStatement,
  ts.SyntaxKind.JsxOpeningFragment,
  ts.SyntaxKind.JsxClosingFragment,
  ts.SyntaxKind.EnumMember,
  ts.SyntaxKind.SourceFile,
  ts.SyntaxKind.Bundle,
  ts.SyntaxKind.JSDocTypeExpression,
  ts.SyntaxKind.JSDocAllType,
  ts.SyntaxKind.JSDocUnknownType,
  ts.SyntaxKind.JSDocNullableType,
  ts.SyntaxKind.JSDocNonNullableType,
  ts.SyntaxKind.JSDocOptionalType,
  ts.SyntaxKind.JSDocFunctionType,
  ts.SyntaxKind.JSDocVariadicType,
  ts.SyntaxKind.JSDocComment,
  ts.SyntaxKind.JSDocTag,
  ts.SyntaxKind.JSDocAugmentsTag,
  ts.SyntaxKind.JSDocClassTag,
  ts.SyntaxKind.JSDocParameterTag,
  ts.SyntaxKind.JSDocReturnTag,
  ts.SyntaxKind.JSDocTypeTag,
  ts.SyntaxKind.JSDocTemplateTag,
  ts.SyntaxKind.JSDocTypedefTag,
  ts.SyntaxKind.JSDocPropertyTag,
  ts.SyntaxKind.JSDocTypeLiteral,
  ts.SyntaxKind.SyntaxList,
  ts.SyntaxKind.NotEmittedStatement,
  ts.SyntaxKind.PartiallyEmittedExpression,
  ts.SyntaxKind.CommaListExpression,
  ts.SyntaxKind.Count,
])
