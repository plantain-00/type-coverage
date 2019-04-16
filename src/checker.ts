import ts from 'typescript'

import { FileContext } from './interfaces'

function collectAny(node: ts.Node, { file, sourceFile, typeCheckResult, ingoreMap, debug, detail }: FileContext) {
  const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile))
  if (ingoreMap[file] && ingoreMap[file].has(line)) {
    return false
  }
  if (debug) {
    console.log(`type === any: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)}`)
  } else if (detail) {
    typeCheckResult.anys.push({ line, character, text: node.getText(sourceFile) })
  }
  return true
}

function collectNotAny(node: ts.Node, { file, sourceFile, typeCheckResult, debug }: FileContext, type: ts.Type) {
  typeCheckResult.correctCount++
  if (debug) {
    const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile))
    console.log(`type !== any: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)} ${node.kind}(kind) ${type.flags}(flag) ${(type as any).intrinsicName || ''}`)
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
    return (type as any).intrinsicName === 'any'
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

// tslint:disable-next-line:no-big-function
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

  // tslint:disable-next-line:max-switch-cases
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
      break
    case ts.SyntaxKind.Identifier:
      const id = node as ts.Identifier
      if (context.catchVariables[id.escapedText as string]) {
        return
      }
      collectData(node, context)
      break
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
      break
    case ts.SyntaxKind.QualifiedName:
      const qualifiedName = node as ts.QualifiedName
      checkNode(qualifiedName.left, context)
      checkNode(qualifiedName.right, context)
      break
    case ts.SyntaxKind.ComputedPropertyName:
      const computedPropertyName = node as ts.ComputedPropertyName
      checkNode(computedPropertyName.expression, context)
      break
    case ts.SyntaxKind.TypeParameter:
      const typeParameterDeclaration = node as ts.TypeParameterDeclaration
      checkNode(typeParameterDeclaration.name, context)
      checkNode(typeParameterDeclaration.default, context)
      checkNode(typeParameterDeclaration.expression, context)
      checkNode(typeParameterDeclaration.constraint, context)
      break
    case ts.SyntaxKind.Parameter:
      const parameterDeclaration = node as ts.ParameterDeclaration
      checkNode(parameterDeclaration.dotDotDotToken, context)
      checkNode(parameterDeclaration.name, context)
      checkNode(parameterDeclaration.initializer, context)
      checkNode(parameterDeclaration.type, context)
      checkNode(parameterDeclaration.questionToken, context)
      break
    case ts.SyntaxKind.Decorator:
      const decorator = node as ts.Decorator
      checkNode(decorator.expression, context)
      break
    case ts.SyntaxKind.PropertySignature:
      const propertySignature = node as ts.PropertySignature
      checkNode(propertySignature.name, context)
      checkNode(propertySignature.questionToken, context)
      checkNode(propertySignature.type, context)
      checkNode(propertySignature.initializer, context)
      break
    case ts.SyntaxKind.PropertyDeclaration:
      const propertyDeclaration = node as ts.PropertyDeclaration
      checkNode(propertyDeclaration.name, context)
      checkNode(propertyDeclaration.initializer, context)
      checkNode(propertyDeclaration.type, context)
      checkNode(propertyDeclaration.questionToken, context)
      break
    case ts.SyntaxKind.MethodSignature:
      const methodSignature = node as ts.MethodSignature
      checkNode(methodSignature.name, context)
      checkNodes(methodSignature.parameters, context)
      checkNode(methodSignature.questionToken, context)
      checkNode(methodSignature.type, context)
      checkNodes(methodSignature.typeParameters, context)
      break
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.Constructor:
    case ts.SyntaxKind.GetAccessor:
    case ts.SyntaxKind.SetAccessor:
      const functionLikeDeclarationBase = node as ts.FunctionLikeDeclarationBase
      checkNode(functionLikeDeclarationBase.name, context)
      checkNodes(functionLikeDeclarationBase.parameters, context)
      checkNode(functionLikeDeclarationBase.body, context)
      checkNode(functionLikeDeclarationBase.asteriskToken, context)
      checkNode(functionLikeDeclarationBase.questionToken, context)
      checkNode(functionLikeDeclarationBase.type, context)
      checkNodes(functionLikeDeclarationBase.typeParameters, context)
      break
    case ts.SyntaxKind.CallSignature:
      const callSignatureDeclaration = node as ts.CallSignatureDeclaration
      checkNode(callSignatureDeclaration.name, context)
      checkNodes(callSignatureDeclaration.parameters, context)
      checkNode(callSignatureDeclaration.questionToken, context)
      checkNode(callSignatureDeclaration.type, context)
      checkNodes(callSignatureDeclaration.typeParameters, context)
      break
    case ts.SyntaxKind.ConstructSignature:
      const constructSignatureDeclaration = node as ts.ConstructSignatureDeclaration
      checkNode(constructSignatureDeclaration.name, context)
      checkNodes(constructSignatureDeclaration.parameters, context)
      checkNode(constructSignatureDeclaration.questionToken, context)
      checkNode(constructSignatureDeclaration.type, context)
      checkNodes(constructSignatureDeclaration.typeParameters, context)
      break
    case ts.SyntaxKind.IndexSignature:
      const indexSignatureDeclaration = node as ts.IndexSignatureDeclaration
      checkNode(indexSignatureDeclaration.name, context)
      checkNodes(indexSignatureDeclaration.parameters, context)
      checkNode(indexSignatureDeclaration.questionToken, context)
      checkNode(indexSignatureDeclaration.type, context)
      checkNodes(indexSignatureDeclaration.typeParameters, context)
      break
    case ts.SyntaxKind.TypePredicate:
      const typePredicateNode = node as ts.TypePredicateNode
      checkNode(typePredicateNode.type, context)
      checkNode(typePredicateNode.parameterName, context)
      break
    case ts.SyntaxKind.TypeReference:
      const typeReferenceNode = node as ts.TypeReferenceNode
      checkNode(typeReferenceNode.typeName, context)
      checkNodes(typeReferenceNode.typeArguments, context)
      break
    case ts.SyntaxKind.FunctionType:
    case ts.SyntaxKind.ConstructorType:
      const signatureDeclarationBase = node as ts.SignatureDeclarationBase
      checkNode(signatureDeclarationBase.name, context)
      checkNodes(signatureDeclarationBase.parameters, context)
      checkNode(signatureDeclarationBase.type, context)
      checkNodes(signatureDeclarationBase.typeParameters, context)
      break
    case ts.SyntaxKind.TypeQuery:
      const typeQueryNode = node as ts.TypeQueryNode
      checkNode(typeQueryNode.exprName, context)
      break
    case ts.SyntaxKind.TypeLiteral:
      const typeLiteralNode = node as ts.TypeLiteralNode
      checkNodes(typeLiteralNode.members, context)
      break
    case ts.SyntaxKind.ArrayType:
      const arrayTypeNode = node as ts.ArrayTypeNode
      checkNode(arrayTypeNode.elementType, context)
      break
    case ts.SyntaxKind.TupleType:
      const tupleTypeNode = node as ts.TupleTypeNode
      checkNodes(tupleTypeNode.elementTypes, context)
      break
    case ts.SyntaxKind.OptionalType:
      break
    case ts.SyntaxKind.RestType:
      const restTypeNode = node as ts.RestTypeNode
      checkNode(restTypeNode.type, context)
      break
    case ts.SyntaxKind.UnionType:
      const unionTypeNode = node as ts.UnionTypeNode
      checkNodes(unionTypeNode.types, context)
      break
    case ts.SyntaxKind.IntersectionType:
      const intersectionTypeNode = node as ts.IntersectionTypeNode
      checkNodes(intersectionTypeNode.types, context)
      break
    case ts.SyntaxKind.ConditionalType:
      const conditionalTypeNode = node as ts.ConditionalTypeNode
      checkNode(conditionalTypeNode.checkType, context)
      checkNode(conditionalTypeNode.extendsType, context)
      checkNode(conditionalTypeNode.trueType, context)
      checkNode(conditionalTypeNode.falseType, context)
      break
    case ts.SyntaxKind.InferType:
      const inferTypeNode = node as ts.InferTypeNode
      checkNode(inferTypeNode.typeParameter, context)
      break
    case ts.SyntaxKind.ParenthesizedType:
      const parenthesizedTypeNode = node as ts.ParenthesizedTypeNode
      checkNode(parenthesizedTypeNode.type, context)
      break
    case ts.SyntaxKind.ThisType:
      break
    case ts.SyntaxKind.TypeOperator:
      const typeOperatorNode = node as ts.TypeOperatorNode
      checkNode(typeOperatorNode.type, context)
      break
    case ts.SyntaxKind.IndexedAccessType:
      const indexedAccessTypeNode = node as ts.IndexedAccessTypeNode
      checkNode(indexedAccessTypeNode.objectType, context)
      checkNode(indexedAccessTypeNode.indexType, context)
      break
    case ts.SyntaxKind.MappedType:
      const mappedTypeNode = node as ts.MappedTypeNode
      checkNode(mappedTypeNode.questionToken, context)
      checkNode(mappedTypeNode.readonlyToken, context)
      checkNode(mappedTypeNode.type, context)
      checkNode(mappedTypeNode.typeParameter, context)
      break
    case ts.SyntaxKind.LiteralType:
      const literalTypeNode = node as ts.LiteralTypeNode
      checkNode(literalTypeNode.literal, context)
      break
    case ts.SyntaxKind.ImportType:
      const importTypeNode = node as ts.ImportTypeNode
      checkNode(importTypeNode.qualifier, context)
      checkNode(importTypeNode.argument, context)
      checkNodes(importTypeNode.typeArguments, context)
      break
    case ts.SyntaxKind.ObjectBindingPattern:
      const objectBindingPattern = node as ts.ObjectBindingPattern
      checkNodes(objectBindingPattern.elements, context)
      break
    case ts.SyntaxKind.ArrayBindingPattern:
      const arrayBindingPattern = node as ts.ArrayBindingPattern
      checkNodes(arrayBindingPattern.elements, context)
      break
    case ts.SyntaxKind.BindingElement:
      const bindingElement = node as ts.BindingElement
      checkNode(bindingElement.name, context)
      checkNode(bindingElement.initializer, context)
      checkNode(bindingElement.dotDotDotToken, context)
      checkNode(bindingElement.propertyName, context)
      break
    case ts.SyntaxKind.ArrayLiteralExpression:
      const arrayLiteralExpression = node as ts.ArrayLiteralExpression
      checkNodes(arrayLiteralExpression.elements, context)
      break
    case ts.SyntaxKind.ObjectLiteralExpression:
      const objectLiteralExpression = node as ts.ObjectLiteralExpression
      checkNodes(objectLiteralExpression.properties, context)
      break
    case ts.SyntaxKind.PropertyAccessExpression:
      const propertyAccessExpression = node as ts.PropertyAccessExpression
      checkNode(propertyAccessExpression.expression, context)
      checkNode(propertyAccessExpression.name, context)
      break
    case ts.SyntaxKind.ElementAccessExpression:
      const elementAccessExpression = node as ts.ElementAccessExpression
      checkNode(elementAccessExpression.expression, context)
      checkNode(elementAccessExpression.argumentExpression, context)
      break
    case ts.SyntaxKind.CallExpression:
      const callExpression = node as ts.CallExpression
      checkNode(callExpression.expression, context)
      checkNodes(callExpression.arguments, context)
      checkNodes(callExpression.typeArguments, context)
      break
    case ts.SyntaxKind.NewExpression:
      const newExpression = node as ts.NewExpression
      checkNode(newExpression.expression, context)
      checkNodes(newExpression.arguments, context)
      checkNodes(newExpression.typeArguments, context)
      break
    case ts.SyntaxKind.TaggedTemplateExpression:
      const taggedTemplateExpression = node as ts.TaggedTemplateExpression
      checkNode(taggedTemplateExpression.template, context)
      break
    case ts.SyntaxKind.TypeAssertionExpression:
      const typeAssertion = node as ts.TypeAssertion
      checkNode(typeAssertion.expression, context)
      checkNode(typeAssertion.type, context)
      break
    case ts.SyntaxKind.ParenthesizedExpression:
      const parenthesizedExpression = node as ts.ParenthesizedExpression
      checkNode(parenthesizedExpression.expression, context)
      break
    case ts.SyntaxKind.FunctionExpression:
      const functionExpression = node as ts.FunctionExpression
      checkNode(functionExpression.name, context)
      checkNodes(functionExpression.parameters, context)
      checkNode(functionExpression.body, context)
      checkNode(functionExpression.asteriskToken, context)
      checkNode(functionExpression.questionToken, context)
      checkNode(functionExpression.type, context)
      checkNodes(functionExpression.typeParameters, context)
      break
    case ts.SyntaxKind.ArrowFunction:
      const arrowFunction = node as ts.ArrowFunction
      checkNode(arrowFunction.name, context)
      checkNodes(arrowFunction.parameters, context)
      checkNode(arrowFunction.body, context)
      checkNode(arrowFunction.asteriskToken, context)
      checkNode(arrowFunction.questionToken, context)
      checkNode(arrowFunction.type, context)
      checkNodes(arrowFunction.typeParameters, context)
      checkNode(arrowFunction.equalsGreaterThanToken, context)
      break
    case ts.SyntaxKind.DeleteExpression:
      const deleteExpression = node as ts.DeleteExpression
      checkNode(deleteExpression.expression, context)
      break
    case ts.SyntaxKind.TypeOfExpression:
      const typeOfExpression = node as ts.TypeOfExpression
      checkNode(typeOfExpression.expression, context)
      break
    case ts.SyntaxKind.VoidExpression:
      const voidExpression = node as ts.VoidExpression
      checkNode(voidExpression.expression, context)
      break
    case ts.SyntaxKind.AwaitExpression:
      const awaitExpression = node as ts.AwaitExpression
      checkNode(awaitExpression.expression, context)
      break
    case ts.SyntaxKind.PrefixUnaryExpression:
      const prefixUnaryExpression = node as ts.PrefixUnaryExpression
      checkNode(prefixUnaryExpression.operand, context)
      break
    case ts.SyntaxKind.PostfixUnaryExpression:
      const postfixUnaryExpression = node as ts.PostfixUnaryExpression
      checkNode(postfixUnaryExpression.operand, context)
      break
    case ts.SyntaxKind.BinaryExpression:
      const binaryExpression = node as ts.BinaryExpression
      checkNode(binaryExpression.left, context)
      checkNode(binaryExpression.right, context)
      checkNode(binaryExpression.operatorToken, context)
      break
    case ts.SyntaxKind.ConditionalExpression:
      const conditionalExpression = node as ts.ConditionalExpression
      checkNode(conditionalExpression.condition, context)
      checkNode(conditionalExpression.colonToken, context)
      checkNode(conditionalExpression.questionToken, context)
      checkNode(conditionalExpression.whenTrue, context)
      checkNode(conditionalExpression.whenFalse, context)
      break
    case ts.SyntaxKind.TemplateExpression:
      const templateExpression = node as ts.TemplateExpression
      checkNodes(templateExpression.templateSpans, context)
      break
    case ts.SyntaxKind.YieldExpression:
      const yieldExpression = node as ts.YieldExpression
      checkNode(yieldExpression.asteriskToken, context)
      checkNode(yieldExpression.expression, context)
      break
    case ts.SyntaxKind.SpreadElement:
      const spreadElement = node as ts.SpreadElement
      checkNode(spreadElement.expression, context)
      break
    case ts.SyntaxKind.ClassExpression:
      const classExpression = node as ts.ClassExpression
      checkNode(classExpression.name, context)
      checkNodes(classExpression.typeParameters, context)
      checkNodes(classExpression.members, context)
      checkNodes(classExpression.heritageClauses, context)
      break
    case ts.SyntaxKind.OmittedExpression:
      break
    case ts.SyntaxKind.ExpressionWithTypeArguments:
      const expressionWithTypeArguments = node as ts.ExpressionWithTypeArguments
      checkNode(expressionWithTypeArguments.expression, context)
      checkNodes(expressionWithTypeArguments.typeArguments, context)
      break
    case ts.SyntaxKind.AsExpression:
      const asExpression = node as ts.AsExpression
      checkNode(asExpression.expression, context)
      checkNode(asExpression.type, context)
      break
    case ts.SyntaxKind.NonNullExpression:
      const nonNullExpression = node as ts.NonNullExpression
      checkNode(nonNullExpression.expression, context)
      break
    case ts.SyntaxKind.MetaProperty:
      const metaProperty = node as ts.MetaProperty
      checkNode(metaProperty.name, context)
      break
    case ts.SyntaxKind.TemplateSpan:
      const templateSpan = node as ts.TemplateSpan
      checkNode(templateSpan.expression, context)
      checkNode(templateSpan.literal, context)
      break
    case ts.SyntaxKind.SemicolonClassElement:
      const semicolonClassElement = node as ts.SemicolonClassElement
      checkNode(semicolonClassElement.name, context)
      break
    case ts.SyntaxKind.Block:
      const block = node as ts.Block
      checkNodes(block.statements, context)
      break
    case ts.SyntaxKind.VariableStatement:
      const variableStatement = node as ts.VariableStatement
      checkNode(variableStatement.declarationList, context)
      break
    case ts.SyntaxKind.EmptyStatement:
      break
    case ts.SyntaxKind.ExpressionStatement:
      const expressionStatement = node as ts.ExpressionStatement
      checkNode(expressionStatement.expression, context)
      break
    case ts.SyntaxKind.IfStatement:
      const ifStatement = node as ts.IfStatement
      checkNode(ifStatement.expression, context)
      checkNode(ifStatement.thenStatement, context)
      checkNode(ifStatement.elseStatement, context)
      break
    case ts.SyntaxKind.DoStatement:
      const doStatement = node as ts.DoStatement
      checkNode(doStatement.expression, context)
      checkNode(doStatement.statement, context)
      break
    case ts.SyntaxKind.WhileStatement:
      const whileStatement = node as ts.WhileStatement
      checkNode(whileStatement.statement, context)
      checkNode(whileStatement.expression, context)
      break
    case ts.SyntaxKind.ForStatement:
      const forStatement = node as ts.ForStatement
      checkNode(forStatement.initializer, context)
      checkNode(forStatement.condition, context)
      checkNode(forStatement.incrementor, context)
      checkNode(forStatement.statement, context)
      break
    case ts.SyntaxKind.ForInStatement:
      const forInStatement = node as ts.ForInStatement
      checkNode(forInStatement.initializer, context)
      checkNode(forInStatement.expression, context)
      checkNode(forInStatement.statement, context)
      break
    case ts.SyntaxKind.ForOfStatement:
      const forOfStatement = node as ts.ForOfStatement
      checkNode(forOfStatement.initializer, context)
      checkNode(forOfStatement.statement, context)
      checkNode(forOfStatement.expression, context)
      checkNode(forOfStatement.awaitModifier, context)
      break
    case ts.SyntaxKind.ContinueStatement:
    case ts.SyntaxKind.BreakStatement:
      break
    case ts.SyntaxKind.ReturnStatement:
      const returnStatement = node as ts.ReturnStatement
      checkNode(returnStatement.expression, context)
      break
    case ts.SyntaxKind.WithStatement:
      const withStatement = node as ts.WithStatement
      checkNode(withStatement.expression, context)
      checkNode(withStatement.statement, context)
      break
    case ts.SyntaxKind.SwitchStatement:
      const switchStatement = node as ts.SwitchStatement
      checkNode(switchStatement.expression, context)
      checkNode(switchStatement.caseBlock, context)
      break
    case ts.SyntaxKind.LabeledStatement:
      const labeledStatement = node as ts.LabeledStatement
      checkNode(labeledStatement.label, context)
      checkNode(labeledStatement.statement, context)
      break
    case ts.SyntaxKind.ThrowStatement:
      const throwStatement = node as ts.ThrowStatement
      checkNode(throwStatement.expression, context)
      break
    case ts.SyntaxKind.TryStatement:
      const tryStatement = node as ts.TryStatement
      checkNode(tryStatement.tryBlock, context)
      checkNode(tryStatement.catchClause, context)
      checkNode(tryStatement.finallyBlock, context)
      break
    case ts.SyntaxKind.DebuggerStatement:
      break
    case ts.SyntaxKind.VariableDeclaration:
      const variableDeclaration = node as ts.VariableDeclaration
      checkNode(variableDeclaration.name, context)
      checkNode(variableDeclaration.type, context)
      checkNode(variableDeclaration.initializer, context)
      break
    case ts.SyntaxKind.VariableDeclarationList:
      const declarationList = node as ts.VariableDeclarationList
      checkNodes(declarationList.declarations, context)
      break
    case ts.SyntaxKind.FunctionDeclaration:
      const functionDeclaration = node as ts.FunctionDeclaration
      checkNode(functionDeclaration.name, context)
      checkNodes(functionDeclaration.parameters, context)
      checkNode(functionDeclaration.body, context)
      checkNode(functionDeclaration.asteriskToken, context)
      checkNode(functionDeclaration.questionToken, context)
      checkNode(functionDeclaration.type, context)
      checkNodes(functionDeclaration.typeParameters, context)
      break
    case ts.SyntaxKind.ClassDeclaration:
      const classDeclaration = node as ts.ClassDeclaration
      checkNode(classDeclaration.name, context)
      checkNodes(classDeclaration.members, context)
      checkNodes(classDeclaration.typeParameters, context)
      checkNodes(classDeclaration.heritageClauses, context)
      break
    case ts.SyntaxKind.InterfaceDeclaration:
      const interfaceDeclaration = node as ts.InterfaceDeclaration
      checkNode(interfaceDeclaration.name, context)
      checkNodes(interfaceDeclaration.members, context)
      checkNodes(interfaceDeclaration.typeParameters, context)
      checkNodes(interfaceDeclaration.heritageClauses, context)
      break
    case ts.SyntaxKind.TypeAliasDeclaration:
      const typeAliasDeclaration = node as ts.TypeAliasDeclaration
      checkNode(typeAliasDeclaration.name, context)
      checkNode(typeAliasDeclaration.type, context)
      checkNodes(typeAliasDeclaration.typeParameters, context)
      break
    case ts.SyntaxKind.EnumDeclaration:
      const enumDeclaration = node as ts.EnumDeclaration
      checkNode(enumDeclaration.name, context)
      checkNodes(enumDeclaration.members, context)
      break
    case ts.SyntaxKind.ModuleDeclaration:
      const moduleDeclaration = node as ts.ModuleDeclaration
      checkNode(moduleDeclaration.name, context)
      checkNode(moduleDeclaration.body, context)
      break
    case ts.SyntaxKind.ModuleBlock:
      const moduleBlock = node as ts.ModuleBlock
      checkNodes(moduleBlock.statements, context)
      break
    case ts.SyntaxKind.CaseBlock:
      const caseBlock = node as ts.CaseBlock
      checkNodes(caseBlock.clauses, context)
      break
    case ts.SyntaxKind.NamespaceExportDeclaration:
      const namespaceExportDeclaration = node as ts.NamespaceExportDeclaration
      checkNode(namespaceExportDeclaration.name, context)
      break
    case ts.SyntaxKind.ImportEqualsDeclaration:
      const importEqualsDeclaration = node as ts.ImportEqualsDeclaration
      checkNode(importEqualsDeclaration.name, context)
      checkNode(importEqualsDeclaration.moduleReference, context)
      break
    case ts.SyntaxKind.ImportDeclaration:
      const importDeclaration = node as ts.ImportDeclaration
      checkNode(importDeclaration.importClause, context)
      checkNode(importDeclaration.moduleSpecifier, context)
      break
    case ts.SyntaxKind.ImportClause:
      const importClause = node as ts.ImportClause
      checkNode(importClause.name, context)
      checkNode(importClause.namedBindings, context)
      break
    case ts.SyntaxKind.NamespaceImport:
      const namespaceImport = node as ts.NamespaceImport
      checkNode(namespaceImport.name, context)
      break
    case ts.SyntaxKind.NamedImports:
      const namedImports = node as ts.NamedImports
      checkNodes(namedImports.elements, context)
      break
    case ts.SyntaxKind.ImportSpecifier:
      const importSpecifier = node as ts.ImportSpecifier
      checkNode(importSpecifier.name, context)
      checkNode(importSpecifier.propertyName, context)
      break
    case ts.SyntaxKind.ExportAssignment:
      const exportAssignment = node as ts.ExportAssignment
      checkNode(exportAssignment.name, context)
      checkNode(exportAssignment.expression, context)
      break
    case ts.SyntaxKind.ExportDeclaration:
      const exportDeclaration = node as ts.ExportDeclaration
      checkNode(exportDeclaration.exportClause, context)
      checkNode(exportDeclaration.name, context)
      checkNode(exportDeclaration.moduleSpecifier, context)
      break
    case ts.SyntaxKind.NamedExports:
      const namedExports = node as ts.NamedExports
      checkNodes(namedExports.elements, context)
      break
    case ts.SyntaxKind.ExportSpecifier:
      const exportSpecifier = node as ts.ExportSpecifier
      checkNode(exportSpecifier.name, context)
      checkNode(exportSpecifier.propertyName, context)
      break
    case ts.SyntaxKind.MissingDeclaration:
      const missingDeclaration = node as ts.MissingDeclaration
      checkNode(missingDeclaration.name, context)
      break
    case ts.SyntaxKind.ExternalModuleReference:
      const externalModuleReference = node as ts.ExternalModuleReference
      checkNode(externalModuleReference.expression, context)
      break
    case ts.SyntaxKind.JsxElement:
      const jsxElement = node as ts.JsxElement
      checkNode(jsxElement.openingElement, context)
      checkNode(jsxElement.closingElement, context)
      checkNodes(jsxElement.children, context)
      break
    case ts.SyntaxKind.JsxSelfClosingElement:
      const jsxSelfClosingElement = node as ts.JsxSelfClosingElement
      checkNode(jsxSelfClosingElement.attributes, context)
      checkNode(jsxSelfClosingElement.tagName, context)
      break
    case ts.SyntaxKind.JsxOpeningElement:
      const jsxOpeningElement = node as ts.JsxOpeningElement
      checkNode(jsxOpeningElement.attributes, context)
      checkNode(jsxOpeningElement.tagName, context)
      break
    case ts.SyntaxKind.JsxClosingElement:
      const jsxClosingElement = node as ts.JsxClosingElement
      checkNode(jsxClosingElement.tagName, context)
      break
    case ts.SyntaxKind.JsxFragment:
      const jsxFragment = node as ts.JsxFragment
      checkNode(jsxFragment.openingFragment, context)
      checkNode(jsxFragment.closingFragment, context)
      checkNodes(jsxFragment.children, context)
      break
    case ts.SyntaxKind.JsxOpeningFragment:
      break
    case ts.SyntaxKind.JsxClosingFragment:
      break
    case ts.SyntaxKind.JsxAttribute:
      const jsxAttribute = node as ts.JsxAttribute
      checkNode(jsxAttribute.name, context)
      checkNode(jsxAttribute.initializer, context)
      break
    case ts.SyntaxKind.JsxAttributes:
      const jsxAttributes = node as ts.JsxAttributes
      checkNodes(jsxAttributes.properties, context)
      break
    case ts.SyntaxKind.JsxSpreadAttribute:
      const jsxSpreadAttribute = node as ts.JsxSpreadAttribute
      checkNode(jsxSpreadAttribute.name, context)
      checkNode(jsxSpreadAttribute.expression, context)
      break
    case ts.SyntaxKind.JsxExpression:
      const jsxExpression = node as ts.JsxExpression
      checkNode(jsxExpression.dotDotDotToken, context)
      checkNode(jsxExpression.expression, context)
      break
    case ts.SyntaxKind.CaseClause:
      const caseClause = node as ts.CaseClause
      checkNodes(caseClause.statements, context)
      checkNode(caseClause.expression, context)
      break
    case ts.SyntaxKind.DefaultClause:
      const defaultClause = node as ts.DefaultClause
      checkNodes(defaultClause.statements, context)
      break
    case ts.SyntaxKind.HeritageClause:
      const heritageClause = node as ts.HeritageClause
      checkNodes(heritageClause.types, context)
      break
    case ts.SyntaxKind.CatchClause:
      const catchClause = node as ts.CatchClause

      if (context.ignoreCatch) {
        const copyContext = Object.assign({}, context)
        copyContext.catchVariables = Object.assign({}, context.catchVariables)
        if (catchClause.variableDeclaration) {
          const decl = catchClause.variableDeclaration
          if (decl.name.kind === ts.SyntaxKind.Identifier) {
            copyContext.catchVariables[
              decl.name.escapedText as string
            ] = true
          }
        }

        checkNode(catchClause.variableDeclaration, copyContext)
      } else {
        checkNode(catchClause.block, context)
        checkNode(catchClause.variableDeclaration, context)
      }
      break
    case ts.SyntaxKind.PropertyAssignment:
      const propertyAssignmentExpression = node as ts.PropertyAssignment
      checkNode(propertyAssignmentExpression.name, context)
      checkNode(propertyAssignmentExpression.questionToken, context)
      checkNode(propertyAssignmentExpression.initializer, context)
      break
    case ts.SyntaxKind.ShorthandPropertyAssignment:
      const shorthandPropertyAssignment = node as ts.ShorthandPropertyAssignment
      checkNode(shorthandPropertyAssignment.name, context)
      checkNode(shorthandPropertyAssignment.questionToken, context)
      checkNode(shorthandPropertyAssignment.equalsToken, context)
      checkNode(shorthandPropertyAssignment.objectAssignmentInitializer, context)
      break
    case ts.SyntaxKind.SpreadAssignment:
      const spreadAssignment = node as ts.SpreadAssignment
      checkNode(spreadAssignment.name, context)
      checkNode(spreadAssignment.expression, context)
      break
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
