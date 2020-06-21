import ts from 'typescript'

import { FileContext } from './interfaces'

function collectAny(node: ts.Node, context: FileContext) {
  const { file, sourceFile, typeCheckResult, ingoreMap, debug, processAny } = context
  if (processAny !== undefined) {
    return processAny(node, context)
  }
  const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile))
  if (ingoreMap[file] && ingoreMap[file].has(line)) {
    return false
  }
  if (debug) {
    console.log(`type === any: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)}`)
  } else {
    typeCheckResult.anys.push({ line, character, text: node.getText(sourceFile) })
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
  const type = context.checker.getTypeAtLocation(node)
  if (type) {
    context.typeCheckResult.totalCount++
    if (typeIsStrictAny(type, context.strict)) {
      const success = collectAny(node, context)
      if (!success) {
        collectNotAny(node, context, type)
      }
    } else {
      collectNotAny(node, context, type)
    }
  }
}

function typeIsStrictAny(type: ts.Type, strict: boolean): boolean {
  if (type.flags === ts.TypeFlags.Any) {
    return (type as unknown as { intrinsicName: string }).intrinsicName === 'any'
  }
  if (strict && type.flags === ts.TypeFlags.Object) {
    const typeArguments = (type as ts.TypeReference).typeArguments
    if (typeArguments) {
      return typeArguments.some((typeArgument) => typeIsStrictAny(typeArgument, strict))
    }
  }
  return false
}

function checkNodes(nodes: ts.NodeArray<ts.Node> | undefined, context: FileContext): void {
  if (nodes === undefined) {
    return
  }

  for (const node of nodes) {
    checkNode(node, context)
  }
}

function checkTypeAssertion(node: ts.Node, context: FileContext) {
  if (context.strict) {
    if ((ts.isAsExpression(node) || ts.isTypeAssertion(node))) {
      // exclude `foo as const` and `<const>foo`
      if (ts.isTypeReferenceNode(node.type) && node.type.getText() === 'const') {
        return
      }
      // exclude `foo as unknown` and `<unknown>foo`
      if (node.type.kind === ts.SyntaxKind.UnknownKeyword) {
        return
      }
    }
    const success = collectAny(node, context)
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

  checkNodes(node.decorators, context)
  checkNodes(node.modifiers, context)

  if (ts.isIdentifier(node)) {
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
    checkNode(node.initializer, context)
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
    checkNodes(node.elementTypes, context)
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
  if (ts.isTypeAssertion(node)) {
    checkTypeAssertion(node, context)
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
    checkTypeAssertion(node, context)
    checkNode(node.expression, context)
    checkNode(node.type, context)
    return
  }
  if (ts.isNonNullExpression(node)) {
    checkTypeAssertion(node, context)
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
    checkNode(node.questionToken, context)
    checkNode(node.initializer, context)
    return
  }
  if (ts.isShorthandPropertyAssignment(node)) {
    checkNode(node.name, context)
    checkNode(node.questionToken, context)
    checkNode(node.equalsToken, context)
    checkNode(node.objectAssignmentInitializer, context)
    return
  }

  switch (node.kind) {
    case ts.SyntaxKind.Unknown:
    case ts.SyntaxKind.EndOfFileToken:
    case ts.SyntaxKind.SingleLineCommentTrivia:
    case ts.SyntaxKind.MultiLineCommentTrivia:
    case ts.SyntaxKind.NewLineTrivia:
    case ts.SyntaxKind.WhitespaceTrivia:
    case ts.SyntaxKind.ShebangTrivia:
    case ts.SyntaxKind.ConflictMarkerTrivia:
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.JsxText:
    case ts.SyntaxKind.JsxTextAllWhiteSpaces:
    case ts.SyntaxKind.RegularExpressionLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.TemplateHead:
    case ts.SyntaxKind.TemplateMiddle:
    case ts.SyntaxKind.TemplateTail:
    case ts.SyntaxKind.OpenBraceToken:
    case ts.SyntaxKind.CloseBraceToken:
    case ts.SyntaxKind.OpenParenToken:
    case ts.SyntaxKind.CloseParenToken:
    case ts.SyntaxKind.OpenBracketToken:
    case ts.SyntaxKind.CloseBracketToken:
    case ts.SyntaxKind.DotToken:
    case ts.SyntaxKind.DotDotDotToken:
    case ts.SyntaxKind.SemicolonToken:
    case ts.SyntaxKind.CommaToken:
    case ts.SyntaxKind.LessThanToken:
    case ts.SyntaxKind.LessThanSlashToken:
    case ts.SyntaxKind.GreaterThanToken:
    case ts.SyntaxKind.LessThanEqualsToken:
    case ts.SyntaxKind.GreaterThanEqualsToken:
    case ts.SyntaxKind.EqualsEqualsToken:
    case ts.SyntaxKind.ExclamationEqualsToken:
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
    case ts.SyntaxKind.EqualsGreaterThanToken:
    case ts.SyntaxKind.PlusToken:
    case ts.SyntaxKind.MinusToken:
    case ts.SyntaxKind.AsteriskToken:
    case ts.SyntaxKind.AsteriskAsteriskToken:
    case ts.SyntaxKind.SlashToken:
    case ts.SyntaxKind.PercentToken:
    case ts.SyntaxKind.PlusPlusToken:
    case ts.SyntaxKind.MinusMinusToken:
    case ts.SyntaxKind.LessThanLessThanToken:
    case ts.SyntaxKind.GreaterThanGreaterThanToken:
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
    case ts.SyntaxKind.AmpersandToken:
    case ts.SyntaxKind.BarToken:
    case ts.SyntaxKind.CaretToken:
    case ts.SyntaxKind.ExclamationToken:
    case ts.SyntaxKind.TildeToken:
    case ts.SyntaxKind.AmpersandAmpersandToken:
    case ts.SyntaxKind.BarBarToken:
    case ts.SyntaxKind.QuestionToken:
    case ts.SyntaxKind.ColonToken:
    case ts.SyntaxKind.AtToken:
    case ts.SyntaxKind.QuestionQuestionToken:
    case ts.SyntaxKind.EqualsToken:
    case ts.SyntaxKind.PlusEqualsToken:
    case ts.SyntaxKind.MinusEqualsToken:
    case ts.SyntaxKind.AsteriskEqualsToken:
    case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
    case ts.SyntaxKind.SlashEqualsToken:
    case ts.SyntaxKind.PercentEqualsToken:
    case ts.SyntaxKind.LessThanLessThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
    case ts.SyntaxKind.AmpersandEqualsToken:
    case ts.SyntaxKind.BarEqualsToken:
    case ts.SyntaxKind.CaretEqualsToken:
    case ts.SyntaxKind.BreakKeyword:
    case ts.SyntaxKind.CaseKeyword:
    case ts.SyntaxKind.CatchKeyword:
    case ts.SyntaxKind.ClassKeyword:
    case ts.SyntaxKind.ConstKeyword:
    case ts.SyntaxKind.ContinueKeyword:
    case ts.SyntaxKind.DebuggerKeyword:
    case ts.SyntaxKind.DefaultKeyword:
    case ts.SyntaxKind.DeleteKeyword:
    case ts.SyntaxKind.DoKeyword:
    case ts.SyntaxKind.ElseKeyword:
    case ts.SyntaxKind.EnumKeyword:
    case ts.SyntaxKind.ExportKeyword:
    case ts.SyntaxKind.ExtendsKeyword:
    case ts.SyntaxKind.FalseKeyword:
    case ts.SyntaxKind.FinallyKeyword:
    case ts.SyntaxKind.ForKeyword:
    case ts.SyntaxKind.FunctionKeyword:
    case ts.SyntaxKind.IfKeyword:
    case ts.SyntaxKind.ImportKeyword:
    case ts.SyntaxKind.InKeyword:
    case ts.SyntaxKind.InstanceOfKeyword:
    case ts.SyntaxKind.NewKeyword:
    case ts.SyntaxKind.NullKeyword:
    case ts.SyntaxKind.ReturnKeyword:
    case ts.SyntaxKind.SuperKeyword:
    case ts.SyntaxKind.SwitchKeyword:
      break
    case ts.SyntaxKind.ThisKeyword:
      collectData(node, context)
      break
    case ts.SyntaxKind.ThrowKeyword:
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.TryKeyword:
    case ts.SyntaxKind.TypeOfKeyword:
    case ts.SyntaxKind.VarKeyword:
    case ts.SyntaxKind.VoidKeyword:
    case ts.SyntaxKind.WhileKeyword:
    case ts.SyntaxKind.WithKeyword:
    case ts.SyntaxKind.ImplementsKeyword:
    case ts.SyntaxKind.InterfaceKeyword:
    case ts.SyntaxKind.LetKeyword:
    case ts.SyntaxKind.PackageKeyword:
    case ts.SyntaxKind.PrivateKeyword:
    case ts.SyntaxKind.ProtectedKeyword:
    case ts.SyntaxKind.PublicKeyword:
    case ts.SyntaxKind.StaticKeyword:
    case ts.SyntaxKind.YieldKeyword:
    case ts.SyntaxKind.AbstractKeyword:
    case ts.SyntaxKind.AsKeyword:
    case ts.SyntaxKind.AnyKeyword:
    case ts.SyntaxKind.AsyncKeyword:
    case ts.SyntaxKind.AwaitKeyword:
    case ts.SyntaxKind.BooleanKeyword:
    case ts.SyntaxKind.ConstructorKeyword:
    case ts.SyntaxKind.DeclareKeyword:
    case ts.SyntaxKind.GetKeyword:
    case ts.SyntaxKind.IsKeyword:
    case ts.SyntaxKind.KeyOfKeyword:
    case ts.SyntaxKind.ModuleKeyword:
    case ts.SyntaxKind.NamespaceKeyword:
    case ts.SyntaxKind.NeverKeyword:
    case ts.SyntaxKind.ReadonlyKeyword:
    case ts.SyntaxKind.RequireKeyword:
    case ts.SyntaxKind.NumberKeyword:
    case ts.SyntaxKind.ObjectKeyword:
    case ts.SyntaxKind.SetKeyword:
    case ts.SyntaxKind.StringKeyword:
    case ts.SyntaxKind.SymbolKeyword:
    case ts.SyntaxKind.TypeKeyword:
    case ts.SyntaxKind.UndefinedKeyword:
    case ts.SyntaxKind.UniqueKeyword:
    case ts.SyntaxKind.UnknownKeyword:
    case ts.SyntaxKind.FromKeyword:
    case ts.SyntaxKind.GlobalKeyword:
    case ts.SyntaxKind.BigIntKeyword:
    case ts.SyntaxKind.OfKeyword:
    case ts.SyntaxKind.OptionalType:
      break
    case ts.SyntaxKind.RestType:
      const restTypeNode = node as ts.RestTypeNode
      checkNode(restTypeNode.type, context)
      break
    case ts.SyntaxKind.ThisType:
    case ts.SyntaxKind.OmittedExpression:
    case ts.SyntaxKind.EmptyStatement:
    case ts.SyntaxKind.ContinueStatement:
    case ts.SyntaxKind.BreakStatement:
    case ts.SyntaxKind.DebuggerStatement:
    case ts.SyntaxKind.JsxOpeningFragment:
    case ts.SyntaxKind.JsxClosingFragment:
    case ts.SyntaxKind.EnumMember:
    case ts.SyntaxKind.SourceFile:
    case ts.SyntaxKind.Bundle:
    case ts.SyntaxKind.JSDocTypeExpression:
    case ts.SyntaxKind.JSDocAllType:
    case ts.SyntaxKind.JSDocUnknownType:
    case ts.SyntaxKind.JSDocNullableType:
    case ts.SyntaxKind.JSDocNonNullableType:
    case ts.SyntaxKind.JSDocOptionalType:
    case ts.SyntaxKind.JSDocFunctionType:
    case ts.SyntaxKind.JSDocVariadicType:
    case ts.SyntaxKind.JSDocComment:
    case ts.SyntaxKind.JSDocTag:
    case ts.SyntaxKind.JSDocAugmentsTag:
    case ts.SyntaxKind.JSDocClassTag:
    case ts.SyntaxKind.JSDocParameterTag:
    case ts.SyntaxKind.JSDocReturnTag:
    case ts.SyntaxKind.JSDocTypeTag:
    case ts.SyntaxKind.JSDocTemplateTag:
    case ts.SyntaxKind.JSDocTypedefTag:
    case ts.SyntaxKind.JSDocPropertyTag:
    case ts.SyntaxKind.JSDocTypeLiteral:
    case ts.SyntaxKind.SyntaxList:
    case ts.SyntaxKind.NotEmittedStatement:
    case ts.SyntaxKind.PartiallyEmittedExpression:
    case ts.SyntaxKind.CommaListExpression:
    case ts.SyntaxKind.MergeDeclarationMarker:
    case ts.SyntaxKind.EndOfDeclarationMarker:
    case ts.SyntaxKind.Count:
      break
    default:
      console.log(`warning: unhandled node kind: ${node.kind}`)
  }
}
