import ts from 'typescript'
import * as path from 'path'

import { getTsConfigFilePath, getTsConfig, getRootNames } from './tsconfig'

// tslint:disable-next-line:no-big-function
export async function lint(project: string, detail: boolean, debug: boolean) {
  const { configFilePath, dirname } = getTsConfigFilePath(project)
  const config = getTsConfig(configFilePath, dirname)

  const { options: compilerOptions, errors } = ts.convertCompilerOptionsFromJson(config.compilerOptions, dirname)
  if (errors && errors.length > 0) {
    throw errors
  }

  const rootNames = await getRootNames(config, dirname)

  const program = ts.createProgram(rootNames, compilerOptions)
  const checker = program.getTypeChecker()

  let correctCount = 0
  let totalCount = 0
  let anys: { file: string, line: number, character: number, text: string }[] = []

  function collectData(node: ts.Node, file: string, sourceFile: ts.SourceFile) {
    const type = checker.getTypeAtLocation(node)
    if (type) {
      const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile))
      totalCount++
      if (type.flags === 1 && (type as any).intrinsicName === 'any') {
        if (debug) {
          console.log(`type === any: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)}`)
        } else if (detail) {
          anys.push({ file, line, character, text: node.getText(sourceFile) })
        }
      } else {
        correctCount++
        if (debug) {
          console.log(`type !== any: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)} ${node.kind}(kind) ${type.flags}(flag) ${(type as any).intrinsicName || ''}`)
        }
      }
    }
  }

  function handleNodes(nodes: ts.NodeArray<ts.Node> | undefined, file: string, sourceFile: ts.SourceFile): void {
    if (nodes === undefined) {
      return
    }

    for (const node of nodes) {
      handleNode(node, file, sourceFile)
    }
  }

  // tslint:disable-next-line:no-big-function
  function handleNode(node: ts.Node | undefined, file: string, sourceFile: ts.SourceFile): void {
    if (node === undefined) {
      return
    }

    if (debug) {
      const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile))
      console.log(`node: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)} ${node.kind}(kind)`)
    }

    handleNodes(node.decorators, file, sourceFile)
    handleNodes(node.modifiers, file, sourceFile)

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
        collectData(node, file, sourceFile)
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
        collectData(node, file, sourceFile)
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
      case ts.SyntaxKind.OfKeyword:
        break
      case ts.SyntaxKind.QualifiedName:
        const qualifiedName = node as ts.QualifiedName
        handleNode(qualifiedName.left, file, sourceFile)
        handleNode(qualifiedName.right, file, sourceFile)
        break
      case ts.SyntaxKind.ComputedPropertyName:
        const computedPropertyName = node as ts.ComputedPropertyName
        handleNode(computedPropertyName.expression, file, sourceFile)
        break
      case ts.SyntaxKind.TypeParameter:
        const typeParameterDeclaration = node as ts.TypeParameterDeclaration
        handleNode(typeParameterDeclaration.name, file, sourceFile)
        handleNode(typeParameterDeclaration.default, file, sourceFile)
        handleNode(typeParameterDeclaration.expression, file, sourceFile)
        handleNode(typeParameterDeclaration.constraint, file, sourceFile)
        break
      case ts.SyntaxKind.Parameter:
        const parameterDeclaration = node as ts.ParameterDeclaration
        handleNode(parameterDeclaration.dotDotDotToken, file, sourceFile)
        handleNode(parameterDeclaration.name, file, sourceFile)
        handleNode(parameterDeclaration.initializer, file, sourceFile)
        handleNode(parameterDeclaration.type, file, sourceFile)
        handleNode(parameterDeclaration.questionToken, file, sourceFile)
        break
      case ts.SyntaxKind.Decorator:
        const decorator = node as ts.Decorator
        handleNode(decorator.expression, file, sourceFile)
        break
      case ts.SyntaxKind.PropertySignature:
        const propertySignature = node as ts.PropertySignature
        handleNode(propertySignature.name, file, sourceFile)
        handleNode(propertySignature.questionToken, file, sourceFile)
        handleNode(propertySignature.type, file, sourceFile)
        handleNode(propertySignature.initializer, file, sourceFile)
        break
      case ts.SyntaxKind.PropertyDeclaration:
        const propertyDeclaration = node as ts.PropertyDeclaration
        handleNode(propertyDeclaration.name, file, sourceFile)
        handleNode(propertyDeclaration.initializer, file, sourceFile)
        handleNode(propertyDeclaration.type, file, sourceFile)
        handleNode(propertyDeclaration.questionToken, file, sourceFile)
        break
      case ts.SyntaxKind.MethodSignature:
        const methodSignature = node as ts.MethodSignature
        handleNode(methodSignature.name, file, sourceFile)
        handleNodes(methodSignature.parameters, file, sourceFile)
        handleNode(methodSignature.questionToken, file, sourceFile)
        handleNode(methodSignature.type, file, sourceFile)
        handleNodes(methodSignature.typeParameters, file, sourceFile)
        break
      case ts.SyntaxKind.MethodDeclaration:
      case ts.SyntaxKind.Constructor:
      case ts.SyntaxKind.GetAccessor:
      case ts.SyntaxKind.SetAccessor:
        const functionLikeDeclarationBase = node as ts.FunctionLikeDeclarationBase
        handleNode(functionLikeDeclarationBase.name, file, sourceFile)
        handleNodes(functionLikeDeclarationBase.parameters, file, sourceFile)
        handleNode(functionLikeDeclarationBase.body, file, sourceFile)
        handleNode(functionLikeDeclarationBase.asteriskToken, file, sourceFile)
        handleNode(functionLikeDeclarationBase.questionToken, file, sourceFile)
        handleNode(functionLikeDeclarationBase.type, file, sourceFile)
        handleNodes(functionLikeDeclarationBase.typeParameters, file, sourceFile)
        break
      case ts.SyntaxKind.CallSignature:
        const callSignatureDeclaration = node as ts.CallSignatureDeclaration
        handleNode(callSignatureDeclaration.name, file, sourceFile)
        handleNodes(callSignatureDeclaration.parameters, file, sourceFile)
        handleNode(callSignatureDeclaration.questionToken, file, sourceFile)
        handleNode(callSignatureDeclaration.type, file, sourceFile)
        handleNodes(callSignatureDeclaration.typeParameters, file, sourceFile)
        break
      case ts.SyntaxKind.ConstructSignature:
        const constructSignatureDeclaration = node as ts.ConstructSignatureDeclaration
        handleNode(constructSignatureDeclaration.name, file, sourceFile)
        handleNodes(constructSignatureDeclaration.parameters, file, sourceFile)
        handleNode(constructSignatureDeclaration.questionToken, file, sourceFile)
        handleNode(constructSignatureDeclaration.type, file, sourceFile)
        handleNodes(constructSignatureDeclaration.typeParameters, file, sourceFile)
        break
      case ts.SyntaxKind.IndexSignature:
        const indexSignatureDeclaration = node as ts.IndexSignatureDeclaration
        handleNode(indexSignatureDeclaration.name, file, sourceFile)
        handleNodes(indexSignatureDeclaration.parameters, file, sourceFile)
        handleNode(indexSignatureDeclaration.questionToken, file, sourceFile)
        handleNode(indexSignatureDeclaration.type, file, sourceFile)
        handleNodes(indexSignatureDeclaration.typeParameters, file, sourceFile)
        break
      case ts.SyntaxKind.TypePredicate:
        const typePredicateNode = node as ts.TypePredicateNode
        handleNode(typePredicateNode.type, file, sourceFile)
        handleNode(typePredicateNode.parameterName, file, sourceFile)
        break
      case ts.SyntaxKind.TypeReference:
        const typeReferenceNode = node as ts.TypeReferenceNode
        handleNode(typeReferenceNode.typeName, file, sourceFile)
        handleNodes(typeReferenceNode.typeArguments, file, sourceFile)
        break
      case ts.SyntaxKind.FunctionType:
      case ts.SyntaxKind.ConstructorType:
        const signatureDeclarationBase = node as ts.SignatureDeclarationBase
        handleNode(signatureDeclarationBase.name, file, sourceFile)
        handleNodes(signatureDeclarationBase.parameters, file, sourceFile)
        handleNode(signatureDeclarationBase.type, file, sourceFile)
        handleNodes(signatureDeclarationBase.typeParameters, file, sourceFile)
        break
      case ts.SyntaxKind.TypeQuery:
        const typeQueryNode = node as ts.TypeQueryNode
        handleNode(typeQueryNode.exprName, file, sourceFile)
        break
      case ts.SyntaxKind.TypeLiteral:
        const typeLiteralNode = node as ts.TypeLiteralNode
        handleNodes(typeLiteralNode.members, file, sourceFile)
        break
      case ts.SyntaxKind.ArrayType:
        const arrayTypeNode = node as ts.ArrayTypeNode
        handleNode(arrayTypeNode.elementType, file, sourceFile)
        break
      case ts.SyntaxKind.TupleType:
        const tupleTypeNode = node as ts.TupleTypeNode
        handleNodes(tupleTypeNode.elementTypes, file, sourceFile)
        break
      case ts.SyntaxKind.OptionalType:
        break
      case ts.SyntaxKind.RestType:
        const restTypeNode = node as ts.RestTypeNode
        handleNode(restTypeNode.type, file, sourceFile)
        break
      case ts.SyntaxKind.UnionType:
        const unionTypeNode = node as ts.UnionTypeNode
        handleNodes(unionTypeNode.types, file, sourceFile)
        break
      case ts.SyntaxKind.IntersectionType:
        const intersectionTypeNode = node as ts.IntersectionTypeNode
        handleNodes(intersectionTypeNode.types, file, sourceFile)
        break
      case ts.SyntaxKind.ConditionalType:
        const conditionalTypeNode = node as ts.ConditionalTypeNode
        handleNode(conditionalTypeNode.checkType, file, sourceFile)
        handleNode(conditionalTypeNode.extendsType, file, sourceFile)
        handleNode(conditionalTypeNode.trueType, file, sourceFile)
        handleNode(conditionalTypeNode.falseType, file, sourceFile)
        break
      case ts.SyntaxKind.InferType:
        const inferTypeNode = node as ts.InferTypeNode
        handleNode(inferTypeNode.typeParameter, file, sourceFile)
        break
      case ts.SyntaxKind.ParenthesizedType:
        const parenthesizedTypeNode = node as ts.ParenthesizedTypeNode
        handleNode(parenthesizedTypeNode.type, file, sourceFile)
        break
      case ts.SyntaxKind.ThisType:
        break
      case ts.SyntaxKind.TypeOperator:
        const typeOperatorNode = node as ts.TypeOperatorNode
        handleNode(typeOperatorNode.type, file, sourceFile)
        break
      case ts.SyntaxKind.IndexedAccessType:
        const indexedAccessTypeNode = node as ts.IndexedAccessTypeNode
        handleNode(indexedAccessTypeNode.objectType, file, sourceFile)
        handleNode(indexedAccessTypeNode.indexType, file, sourceFile)
        break
      case ts.SyntaxKind.MappedType:
        const mappedTypeNode = node as ts.MappedTypeNode
        handleNode(mappedTypeNode.questionToken, file, sourceFile)
        handleNode(mappedTypeNode.readonlyToken, file, sourceFile)
        handleNode(mappedTypeNode.type, file, sourceFile)
        handleNode(mappedTypeNode.typeParameter, file, sourceFile)
        break
      case ts.SyntaxKind.LiteralType:
        const literalTypeNode = node as ts.LiteralTypeNode
        handleNode(literalTypeNode.literal, file, sourceFile)
        break
      case ts.SyntaxKind.ImportType:
        const importTypeNode = node as ts.ImportTypeNode
        handleNode(importTypeNode.qualifier, file, sourceFile)
        handleNode(importTypeNode.argument, file, sourceFile)
        handleNodes(importTypeNode.typeArguments, file, sourceFile)
        break
      case ts.SyntaxKind.ObjectBindingPattern:
        const objectBindingPattern = node as ts.ObjectBindingPattern
        handleNodes(objectBindingPattern.elements, file, sourceFile)
        break
      case ts.SyntaxKind.ArrayBindingPattern:
        const arrayBindingPattern = node as ts.ArrayBindingPattern
        handleNodes(arrayBindingPattern.elements, file, sourceFile)
        break
      case ts.SyntaxKind.BindingElement:
        const bindingElement = node as ts.BindingElement
        handleNode(bindingElement.name, file, sourceFile)
        handleNode(bindingElement.initializer, file, sourceFile)
        handleNode(bindingElement.dotDotDotToken, file, sourceFile)
        handleNode(bindingElement.propertyName, file, sourceFile)
        break
      case ts.SyntaxKind.ArrayLiteralExpression:
        const arrayLiteralExpression = node as ts.ArrayLiteralExpression
        handleNodes(arrayLiteralExpression.elements, file, sourceFile)
        break
      case ts.SyntaxKind.ObjectLiteralExpression:
        const objectLiteralExpression = node as ts.ObjectLiteralExpression
        handleNodes(objectLiteralExpression.properties, file, sourceFile)
        break
      case ts.SyntaxKind.PropertyAccessExpression:
        const propertyAccessExpression = node as ts.PropertyAccessExpression
        handleNode(propertyAccessExpression.expression, file, sourceFile)
        handleNode(propertyAccessExpression.name, file, sourceFile)
        break
      case ts.SyntaxKind.ElementAccessExpression:
        const elementAccessExpression = node as ts.ElementAccessExpression
        handleNode(elementAccessExpression.expression, file, sourceFile)
        handleNode(elementAccessExpression.argumentExpression, file, sourceFile)
        break
      case ts.SyntaxKind.CallExpression:
        const callExpression = node as ts.CallExpression
        handleNode(callExpression.expression, file, sourceFile)
        handleNodes(callExpression.arguments, file, sourceFile)
        handleNodes(callExpression.typeArguments, file, sourceFile)
        break
      case ts.SyntaxKind.NewExpression:
        const newExpression = node as ts.NewExpression
        handleNode(newExpression.expression, file, sourceFile)
        handleNodes(newExpression.arguments, file, sourceFile)
        handleNodes(newExpression.typeArguments, file, sourceFile)
        break
      case ts.SyntaxKind.TaggedTemplateExpression:
        const taggedTemplateExpression = node as ts.TaggedTemplateExpression
        handleNode(taggedTemplateExpression.template, file, sourceFile)
        break
      case ts.SyntaxKind.TypeAssertionExpression:
        const typeAssertion = node as ts.TypeAssertion
        handleNode(typeAssertion.expression, file, sourceFile)
        handleNode(typeAssertion.type, file, sourceFile)
        break
      case ts.SyntaxKind.ParenthesizedExpression:
        const parenthesizedExpression = node as ts.ParenthesizedExpression
        handleNode(parenthesizedExpression.expression, file, sourceFile)
        break
      case ts.SyntaxKind.FunctionExpression:
        const functionExpression = node as ts.FunctionExpression
        handleNode(functionExpression.name, file, sourceFile)
        handleNodes(functionExpression.parameters, file, sourceFile)
        handleNode(functionExpression.body, file, sourceFile)
        handleNode(functionExpression.asteriskToken, file, sourceFile)
        handleNode(functionExpression.questionToken, file, sourceFile)
        handleNode(functionExpression.type, file, sourceFile)
        handleNodes(functionExpression.typeParameters, file, sourceFile)
        break
      case ts.SyntaxKind.ArrowFunction:
        const arrowFunction = node as ts.ArrowFunction
        handleNode(arrowFunction.name, file, sourceFile)
        handleNodes(arrowFunction.parameters, file, sourceFile)
        handleNode(arrowFunction.body, file, sourceFile)
        handleNode(arrowFunction.asteriskToken, file, sourceFile)
        handleNode(arrowFunction.questionToken, file, sourceFile)
        handleNode(arrowFunction.type, file, sourceFile)
        handleNodes(arrowFunction.typeParameters, file, sourceFile)
        handleNode(arrowFunction.equalsGreaterThanToken, file, sourceFile)
        break
      case ts.SyntaxKind.DeleteExpression:
        const deleteExpression = node as ts.DeleteExpression
        handleNode(deleteExpression.expression, file, sourceFile)
        break
      case ts.SyntaxKind.TypeOfExpression:
        const typeOfExpression = node as ts.TypeOfExpression
        handleNode(typeOfExpression.expression, file, sourceFile)
        break
      case ts.SyntaxKind.VoidExpression:
        const voidExpression = node as ts.VoidExpression
        handleNode(voidExpression.expression, file, sourceFile)
        break
      case ts.SyntaxKind.AwaitExpression:
        const awaitExpression = node as ts.AwaitExpression
        handleNode(awaitExpression.expression, file, sourceFile)
        break
      case ts.SyntaxKind.PrefixUnaryExpression:
        const prefixUnaryExpression = node as ts.PrefixUnaryExpression
        handleNode(prefixUnaryExpression.operand, file, sourceFile)
        break
      case ts.SyntaxKind.PostfixUnaryExpression:
        const postfixUnaryExpression = node as ts.PostfixUnaryExpression
        handleNode(postfixUnaryExpression.operand, file, sourceFile)
        break
      case ts.SyntaxKind.BinaryExpression:
        const binaryExpression = node as ts.BinaryExpression
        handleNode(binaryExpression.left, file, sourceFile)
        handleNode(binaryExpression.right, file, sourceFile)
        handleNode(binaryExpression.operatorToken, file, sourceFile)
        break
      case ts.SyntaxKind.ConditionalExpression:
        const conditionalExpression = node as ts.ConditionalExpression
        handleNode(conditionalExpression.condition, file, sourceFile)
        handleNode(conditionalExpression.colonToken, file, sourceFile)
        handleNode(conditionalExpression.questionToken, file, sourceFile)
        handleNode(conditionalExpression.whenTrue, file, sourceFile)
        handleNode(conditionalExpression.whenFalse, file, sourceFile)
        break
      case ts.SyntaxKind.TemplateExpression:
        const templateExpression = node as ts.TemplateExpression
        handleNodes(templateExpression.templateSpans, file, sourceFile)
        break
      case ts.SyntaxKind.YieldExpression:
        const yieldExpression = node as ts.YieldExpression
        handleNode(yieldExpression.asteriskToken, file, sourceFile)
        handleNode(yieldExpression.expression, file, sourceFile)
        break
      case ts.SyntaxKind.SpreadElement:
        const spreadElement = node as ts.SpreadElement
        handleNode(spreadElement.expression, file, sourceFile)
        break
      case ts.SyntaxKind.ClassExpression:
        const classExpression = node as ts.ClassExpression
        handleNode(classExpression.name, file, sourceFile)
        handleNodes(classExpression.typeParameters, file, sourceFile)
        handleNodes(classExpression.members, file, sourceFile)
        handleNodes(classExpression.heritageClauses, file, sourceFile)
        break
      case ts.SyntaxKind.OmittedExpression:
        break
      case ts.SyntaxKind.ExpressionWithTypeArguments:
        const expressionWithTypeArguments = node as ts.ExpressionWithTypeArguments
        handleNode(expressionWithTypeArguments.expression, file, sourceFile)
        handleNodes(expressionWithTypeArguments.typeArguments, file, sourceFile)
        break
      case ts.SyntaxKind.AsExpression:
        const asExpression = node as ts.AsExpression
        handleNode(asExpression.expression, file, sourceFile)
        handleNode(asExpression.type, file, sourceFile)
        break
      case ts.SyntaxKind.NonNullExpression:
        const nonNullExpression = node as ts.NonNullExpression
        handleNode(nonNullExpression.expression, file, sourceFile)
        break
      case ts.SyntaxKind.MetaProperty:
        const metaProperty = node as ts.MetaProperty
        handleNode(metaProperty.name, file, sourceFile)
        break
      case ts.SyntaxKind.TemplateSpan:
        const templateSpan = node as ts.TemplateSpan
        handleNode(templateSpan.expression, file, sourceFile)
        handleNode(templateSpan.literal, file, sourceFile)
        break
      case ts.SyntaxKind.SemicolonClassElement:
        const semicolonClassElement = node as ts.SemicolonClassElement
        handleNode(semicolonClassElement.name, file, sourceFile)
        break
      case ts.SyntaxKind.Block:
        const block = node as ts.Block
        handleNodes(block.statements, file, sourceFile)
        break
      case ts.SyntaxKind.VariableStatement:
        const variableStatement = node as ts.VariableStatement
        handleNode(variableStatement.declarationList, file, sourceFile)
        break
      case ts.SyntaxKind.EmptyStatement:
        break
      case ts.SyntaxKind.ExpressionStatement:
        const expressionStatement = node as ts.ExpressionStatement
        handleNode(expressionStatement.expression, file, sourceFile)
        break
      case ts.SyntaxKind.IfStatement:
        const ifStatement = node as ts.IfStatement
        handleNode(ifStatement.expression, file, sourceFile)
        handleNode(ifStatement.thenStatement, file, sourceFile)
        handleNode(ifStatement.elseStatement, file, sourceFile)
        break
      case ts.SyntaxKind.DoStatement:
        const doStatement = node as ts.DoStatement
        handleNode(doStatement.expression, file, sourceFile)
        handleNode(doStatement.statement, file, sourceFile)
        break
      case ts.SyntaxKind.WhileStatement:
        const whileStatement = node as ts.WhileStatement
        handleNode(whileStatement.statement, file, sourceFile)
        handleNode(whileStatement.expression, file, sourceFile)
        break
      case ts.SyntaxKind.ForStatement:
        const forStatement = node as ts.ForStatement
        handleNode(forStatement.initializer, file, sourceFile)
        handleNode(forStatement.condition, file, sourceFile)
        handleNode(forStatement.incrementor, file, sourceFile)
        handleNode(forStatement.statement, file, sourceFile)
        break
      case ts.SyntaxKind.ForInStatement:
        const forInStatement = node as ts.ForInStatement
        handleNode(forInStatement.initializer, file, sourceFile)
        handleNode(forInStatement.expression, file, sourceFile)
        handleNode(forInStatement.statement, file, sourceFile)
        break
      case ts.SyntaxKind.ForOfStatement:
        const forOfStatement = node as ts.ForOfStatement
        handleNode(forOfStatement.initializer, file, sourceFile)
        handleNode(forOfStatement.statement, file, sourceFile)
        handleNode(forOfStatement.expression, file, sourceFile)
        handleNode(forOfStatement.awaitModifier, file, sourceFile)
        break
      case ts.SyntaxKind.ContinueStatement:
      case ts.SyntaxKind.BreakStatement:
        break
      case ts.SyntaxKind.ReturnStatement:
        const returnStatement = node as ts.ReturnStatement
        handleNode(returnStatement.expression, file, sourceFile)
        break
      case ts.SyntaxKind.WithStatement:
        const withStatement = node as ts.WithStatement
        handleNode(withStatement.expression, file, sourceFile)
        handleNode(withStatement.statement, file, sourceFile)
        break
      case ts.SyntaxKind.SwitchStatement:
        const switchStatement = node as ts.SwitchStatement
        handleNode(switchStatement.expression, file, sourceFile)
        handleNode(switchStatement.caseBlock, file, sourceFile)
        break
      case ts.SyntaxKind.LabeledStatement:
        const labeledStatement = node as ts.LabeledStatement
        handleNode(labeledStatement.label, file, sourceFile)
        handleNode(labeledStatement.statement, file, sourceFile)
        break
      case ts.SyntaxKind.ThrowStatement:
        const throwStatement = node as ts.ThrowStatement
        handleNode(throwStatement.expression, file, sourceFile)
        break
      case ts.SyntaxKind.TryStatement:
        const tryStatement = node as ts.TryStatement
        handleNode(tryStatement.tryBlock, file, sourceFile)
        handleNode(tryStatement.catchClause, file, sourceFile)
        handleNode(tryStatement.finallyBlock, file, sourceFile)
        break
      case ts.SyntaxKind.DebuggerStatement:
        break
      case ts.SyntaxKind.VariableDeclaration:
        const variableDeclaration = node as ts.VariableDeclaration
        handleNode(variableDeclaration.name, file, sourceFile)
        handleNode(variableDeclaration.type, file, sourceFile)
        handleNode(variableDeclaration.initializer, file, sourceFile)
        break
      case ts.SyntaxKind.VariableDeclarationList:
        const declarationList = node as ts.VariableDeclarationList
        handleNodes(declarationList.declarations, file, sourceFile)
        break
      case ts.SyntaxKind.FunctionDeclaration:
        const functionDeclaration = node as ts.FunctionDeclaration
        handleNode(functionDeclaration.name, file, sourceFile)
        handleNodes(functionDeclaration.parameters, file, sourceFile)
        handleNode(functionDeclaration.body, file, sourceFile)
        handleNode(functionDeclaration.asteriskToken, file, sourceFile)
        handleNode(functionDeclaration.questionToken, file, sourceFile)
        handleNode(functionDeclaration.type, file, sourceFile)
        handleNodes(functionDeclaration.typeParameters, file, sourceFile)
        break
      case ts.SyntaxKind.ClassDeclaration:
        const classDeclaration = node as ts.ClassDeclaration
        handleNode(classDeclaration.name, file, sourceFile)
        handleNodes(classDeclaration.members, file, sourceFile)
        handleNodes(classDeclaration.typeParameters, file, sourceFile)
        handleNodes(classDeclaration.heritageClauses, file, sourceFile)
        break
      case ts.SyntaxKind.InterfaceDeclaration:
        const interfaceDeclaration = node as ts.InterfaceDeclaration
        handleNode(interfaceDeclaration.name, file, sourceFile)
        handleNodes(interfaceDeclaration.members, file, sourceFile)
        handleNodes(interfaceDeclaration.typeParameters, file, sourceFile)
        handleNodes(interfaceDeclaration.heritageClauses, file, sourceFile)
        break
      case ts.SyntaxKind.TypeAliasDeclaration:
        const typeAliasDeclaration = node as ts.TypeAliasDeclaration
        handleNode(typeAliasDeclaration.name, file, sourceFile)
        handleNode(typeAliasDeclaration.type, file, sourceFile)
        handleNodes(typeAliasDeclaration.typeParameters, file, sourceFile)
        break
      case ts.SyntaxKind.EnumDeclaration:
        const enumDeclaration = node as ts.EnumDeclaration
        handleNode(enumDeclaration.name, file, sourceFile)
        handleNodes(enumDeclaration.members, file, sourceFile)
        break
      case ts.SyntaxKind.ModuleDeclaration:
        const moduleDeclaration = node as ts.ModuleDeclaration
        handleNode(moduleDeclaration.name, file, sourceFile)
        handleNode(moduleDeclaration.body, file, sourceFile)
        break
      case ts.SyntaxKind.ModuleBlock:
        const moduleBlock = node as ts.ModuleBlock
        handleNodes(moduleBlock.statements, file, sourceFile)
        break
      case ts.SyntaxKind.CaseBlock:
        const caseBlock = node as ts.CaseBlock
        handleNodes(caseBlock.clauses, file, sourceFile)
        break
      case ts.SyntaxKind.NamespaceExportDeclaration:
        const namespaceExportDeclaration = node as ts.NamespaceExportDeclaration
        handleNode(namespaceExportDeclaration.name, file, sourceFile)
        break
      case ts.SyntaxKind.ImportEqualsDeclaration:
        const importEqualsDeclaration = node as ts.ImportEqualsDeclaration
        handleNode(importEqualsDeclaration.name, file, sourceFile)
        handleNode(importEqualsDeclaration.moduleReference, file, sourceFile)
        break
      case ts.SyntaxKind.ImportDeclaration:
        const importDeclaration = node as ts.ImportDeclaration
        handleNode(importDeclaration.importClause, file, sourceFile)
        handleNode(importDeclaration.moduleSpecifier, file, sourceFile)
        break
      case ts.SyntaxKind.ImportClause:
        const importClause = node as ts.ImportClause
        handleNode(importClause.name, file, sourceFile)
        handleNode(importClause.namedBindings, file, sourceFile)
        break
      case ts.SyntaxKind.NamespaceImport:
        const namespaceImport = node as ts.NamespaceImport
        handleNode(namespaceImport.name, file, sourceFile)
        break
      case ts.SyntaxKind.NamedImports:
        const namedImports = node as ts.NamedImports
        handleNodes(namedImports.elements, file, sourceFile)
        break
      case ts.SyntaxKind.ImportSpecifier:
        const importSpecifier = node as ts.ImportSpecifier
        handleNode(importSpecifier.name, file, sourceFile)
        handleNode(importSpecifier.propertyName, file, sourceFile)
        break
      case ts.SyntaxKind.ExportAssignment:
        const exportAssignment = node as ts.ExportAssignment
        handleNode(exportAssignment.name, file, sourceFile)
        handleNode(exportAssignment.expression, file, sourceFile)
        break
      case ts.SyntaxKind.ExportDeclaration:
        const exportDeclaration = node as ts.ExportDeclaration
        handleNode(exportDeclaration.exportClause, file, sourceFile)
        handleNode(exportDeclaration.name, file, sourceFile)
        handleNode(exportDeclaration.moduleSpecifier, file, sourceFile)
        break
      case ts.SyntaxKind.NamedExports:
        const namedExports = node as ts.NamedExports
        handleNodes(namedExports.elements, file, sourceFile)
        break
      case ts.SyntaxKind.ExportSpecifier:
        const exportSpecifier = node as ts.ExportSpecifier
        handleNode(exportSpecifier.name, file, sourceFile)
        handleNode(exportSpecifier.propertyName, file, sourceFile)
        break
      case ts.SyntaxKind.MissingDeclaration:
        const missingDeclaration = node as ts.MissingDeclaration
        handleNode(missingDeclaration.name, file, sourceFile)
        break
      case ts.SyntaxKind.ExternalModuleReference:
        const externalModuleReference = node as ts.ExternalModuleReference
        handleNode(externalModuleReference.expression, file, sourceFile)
        break
      case ts.SyntaxKind.JsxElement:
        const jsxElement = node as ts.JsxElement
        handleNode(jsxElement.openingElement, file, sourceFile)
        handleNode(jsxElement.closingElement, file, sourceFile)
        handleNodes(jsxElement.children, file, sourceFile)
        break
      case ts.SyntaxKind.JsxSelfClosingElement:
        const jsxSelfClosingElement = node as ts.JsxSelfClosingElement
        handleNode(jsxSelfClosingElement.attributes, file, sourceFile)
        handleNode(jsxSelfClosingElement.tagName, file, sourceFile)
        break
      case ts.SyntaxKind.JsxOpeningElement:
        const jsxOpeningElement = node as ts.JsxOpeningElement
        handleNode(jsxOpeningElement.attributes, file, sourceFile)
        handleNode(jsxOpeningElement.tagName, file, sourceFile)
        break
      case ts.SyntaxKind.JsxClosingElement:
        const jsxClosingElement = node as ts.JsxClosingElement
        handleNode(jsxClosingElement.tagName, file, sourceFile)
        break
      case ts.SyntaxKind.JsxFragment:
        const jsxFragment = node as ts.JsxFragment
        handleNode(jsxFragment.openingFragment, file, sourceFile)
        handleNode(jsxFragment.closingFragment, file, sourceFile)
        handleNodes(jsxFragment.children, file, sourceFile)
        break
      case ts.SyntaxKind.JsxOpeningFragment:
        break
      case ts.SyntaxKind.JsxClosingFragment:
        break
      case ts.SyntaxKind.JsxAttribute:
        const jsxAttribute = node as ts.JsxAttribute
        handleNode(jsxAttribute.name, file, sourceFile)
        handleNode(jsxAttribute.initializer, file, sourceFile)
        break
      case ts.SyntaxKind.JsxAttributes:
        const jsxAttributes = node as ts.JsxAttributes
        handleNodes(jsxAttributes.properties, file, sourceFile)
        break
      case ts.SyntaxKind.JsxSpreadAttribute:
        const jsxSpreadAttribute = node as ts.JsxSpreadAttribute
        handleNode(jsxSpreadAttribute.name, file, sourceFile)
        handleNode(jsxSpreadAttribute.expression, file, sourceFile)
        break
      case ts.SyntaxKind.JsxExpression:
        const jsxExpression = node as ts.JsxExpression
        handleNode(jsxExpression.dotDotDotToken, file, sourceFile)
        handleNode(jsxExpression.expression, file, sourceFile)
        break
      case ts.SyntaxKind.CaseClause:
        const caseClause = node as ts.CaseClause
        handleNodes(caseClause.statements, file, sourceFile)
        handleNode(caseClause.expression, file, sourceFile)
        break
      case ts.SyntaxKind.DefaultClause:
        const defaultClause = node as ts.DefaultClause
        handleNodes(defaultClause.statements, file, sourceFile)
        break
      case ts.SyntaxKind.HeritageClause:
        const heritageClause = node as ts.HeritageClause
        handleNodes(heritageClause.types, file, sourceFile)
        break
      case ts.SyntaxKind.CatchClause:
        const catchClause = node as ts.CatchClause
        handleNode(catchClause.variableDeclaration, file, sourceFile)
        handleNode(catchClause.block, file, sourceFile)
        break
      case ts.SyntaxKind.PropertyAssignment:
        const propertyAssignmentExpression = node as ts.PropertyAssignment
        handleNode(propertyAssignmentExpression.name, file, sourceFile)
        handleNode(propertyAssignmentExpression.questionToken, file, sourceFile)
        handleNode(propertyAssignmentExpression.initializer, file, sourceFile)
        break
      case ts.SyntaxKind.ShorthandPropertyAssignment:
        const shorthandPropertyAssignment = node as ts.ShorthandPropertyAssignment
        handleNode(shorthandPropertyAssignment.name, file, sourceFile)
        handleNode(shorthandPropertyAssignment.questionToken, file, sourceFile)
        handleNode(shorthandPropertyAssignment.equalsToken, file, sourceFile)
        handleNode(shorthandPropertyAssignment.objectAssignmentInitializer, file, sourceFile)
        break
      case ts.SyntaxKind.SpreadAssignment:
        const spreadAssignment = node as ts.SpreadAssignment
        handleNode(spreadAssignment.name, file, sourceFile)
        handleNode(spreadAssignment.expression, file, sourceFile)
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

  for (const sourceFile of program.getSourceFiles()) {
    let file = sourceFile.fileName
    if (!file.includes('node_modules')) {
      file = path.relative(process.cwd(), file)
      sourceFile.forEachChild(node => {
        handleNode(node, file, sourceFile)
      })
    }
  }

  return { correctCount, totalCount, anys }
}
