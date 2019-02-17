import ts from 'typescript'
import * as path from 'path'
import * as utils from 'tsutils/util'
import * as fs from 'fs'
import { promisify } from 'util'
import * as crypto from 'crypto'

import { getTsConfigFilePath, getTsConfig, getRootNames } from './tsconfig'
import { FileContext, AnyInfo, TypeCheckResult, SourceFileInfo } from './interfaces'

const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)
const mkdirAsync = promisify(fs.mkdir)

// tslint:disable-next-line:no-big-function cognitive-complexity
export async function lint(
  project: string,
  detail: boolean,
  debug: boolean,
  files?: string[],
  oldProgram?: ts.Program,
  strict = false,
  enableCache = false
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

  const ingoreMap: { [file: string]: Set<number> } = {}

  function collectAny(node: ts.Node, { file, sourceFile, typeCheckResult }: FileContext) {
    const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile))
    if (ingoreMap[file] && ingoreMap[file].has(line)) {
      return false
    }
    if (debug) {
      console.log(`type === any: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)}`)
    } else if (detail) {
      typeCheckResult.anys.push({ file, line, character, text: node.getText(sourceFile) })
    }
    return true
  }

  function collectNotAny(node: ts.Node, { file, sourceFile, typeCheckResult }: FileContext, type: ts.Type) {
    typeCheckResult.correctCount++
    if (debug) {
      const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile))
      console.log(`type !== any: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)} ${node.kind}(kind) ${type.flags}(flag) ${(type as any).intrinsicName || ''}`)
    }
  }

  function collectData(node: ts.Node, context: FileContext) {
    const type = checker.getTypeAtLocation(node)
    if (type) {
      context.typeCheckResult.totalCount++
      if (typeIsStrictAny(type, strict)) {
        const success = collectAny(node, context)
        if (!success) {
          collectNotAny(node, context, type)
        }
      } else {
        collectNotAny(node, context, type)
      }
    }
  }

  function handleNodes(nodes: ts.NodeArray<ts.Node> | undefined, context: FileContext): void {
    if (nodes === undefined) {
      return
    }

    for (const node of nodes) {
      handleNode(node, context)
    }
  }

  // tslint:disable-next-line:no-big-function
  function handleNode(node: ts.Node | undefined, context: FileContext): void {
    if (node === undefined) {
      return
    }

    if (debug) {
      const { line, character } = ts.getLineAndCharacterOfPosition(context.sourceFile, node.getStart(context.sourceFile))
      console.log(`node: ${context.file}:${line + 1}:${character + 1}: ${node.getText(context.sourceFile)} ${node.kind}(kind)`)
    }

    handleNodes(node.decorators, context)
    handleNodes(node.modifiers, context)

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
        handleNode(qualifiedName.left, context)
        handleNode(qualifiedName.right, context)
        break
      case ts.SyntaxKind.ComputedPropertyName:
        const computedPropertyName = node as ts.ComputedPropertyName
        handleNode(computedPropertyName.expression, context)
        break
      case ts.SyntaxKind.TypeParameter:
        const typeParameterDeclaration = node as ts.TypeParameterDeclaration
        handleNode(typeParameterDeclaration.name, context)
        handleNode(typeParameterDeclaration.default, context)
        handleNode(typeParameterDeclaration.expression, context)
        handleNode(typeParameterDeclaration.constraint, context)
        break
      case ts.SyntaxKind.Parameter:
        const parameterDeclaration = node as ts.ParameterDeclaration
        handleNode(parameterDeclaration.dotDotDotToken, context)
        handleNode(parameterDeclaration.name, context)
        handleNode(parameterDeclaration.initializer, context)
        handleNode(parameterDeclaration.type, context)
        handleNode(parameterDeclaration.questionToken, context)
        break
      case ts.SyntaxKind.Decorator:
        const decorator = node as ts.Decorator
        handleNode(decorator.expression, context)
        break
      case ts.SyntaxKind.PropertySignature:
        const propertySignature = node as ts.PropertySignature
        handleNode(propertySignature.name, context)
        handleNode(propertySignature.questionToken, context)
        handleNode(propertySignature.type, context)
        handleNode(propertySignature.initializer, context)
        break
      case ts.SyntaxKind.PropertyDeclaration:
        const propertyDeclaration = node as ts.PropertyDeclaration
        handleNode(propertyDeclaration.name, context)
        handleNode(propertyDeclaration.initializer, context)
        handleNode(propertyDeclaration.type, context)
        handleNode(propertyDeclaration.questionToken, context)
        break
      case ts.SyntaxKind.MethodSignature:
        const methodSignature = node as ts.MethodSignature
        handleNode(methodSignature.name, context)
        handleNodes(methodSignature.parameters, context)
        handleNode(methodSignature.questionToken, context)
        handleNode(methodSignature.type, context)
        handleNodes(methodSignature.typeParameters, context)
        break
      case ts.SyntaxKind.MethodDeclaration:
      case ts.SyntaxKind.Constructor:
      case ts.SyntaxKind.GetAccessor:
      case ts.SyntaxKind.SetAccessor:
        const functionLikeDeclarationBase = node as ts.FunctionLikeDeclarationBase
        handleNode(functionLikeDeclarationBase.name, context)
        handleNodes(functionLikeDeclarationBase.parameters, context)
        handleNode(functionLikeDeclarationBase.body, context)
        handleNode(functionLikeDeclarationBase.asteriskToken, context)
        handleNode(functionLikeDeclarationBase.questionToken, context)
        handleNode(functionLikeDeclarationBase.type, context)
        handleNodes(functionLikeDeclarationBase.typeParameters, context)
        break
      case ts.SyntaxKind.CallSignature:
        const callSignatureDeclaration = node as ts.CallSignatureDeclaration
        handleNode(callSignatureDeclaration.name, context)
        handleNodes(callSignatureDeclaration.parameters, context)
        handleNode(callSignatureDeclaration.questionToken, context)
        handleNode(callSignatureDeclaration.type, context)
        handleNodes(callSignatureDeclaration.typeParameters, context)
        break
      case ts.SyntaxKind.ConstructSignature:
        const constructSignatureDeclaration = node as ts.ConstructSignatureDeclaration
        handleNode(constructSignatureDeclaration.name, context)
        handleNodes(constructSignatureDeclaration.parameters, context)
        handleNode(constructSignatureDeclaration.questionToken, context)
        handleNode(constructSignatureDeclaration.type, context)
        handleNodes(constructSignatureDeclaration.typeParameters, context)
        break
      case ts.SyntaxKind.IndexSignature:
        const indexSignatureDeclaration = node as ts.IndexSignatureDeclaration
        handleNode(indexSignatureDeclaration.name, context)
        handleNodes(indexSignatureDeclaration.parameters, context)
        handleNode(indexSignatureDeclaration.questionToken, context)
        handleNode(indexSignatureDeclaration.type, context)
        handleNodes(indexSignatureDeclaration.typeParameters, context)
        break
      case ts.SyntaxKind.TypePredicate:
        const typePredicateNode = node as ts.TypePredicateNode
        handleNode(typePredicateNode.type, context)
        handleNode(typePredicateNode.parameterName, context)
        break
      case ts.SyntaxKind.TypeReference:
        const typeReferenceNode = node as ts.TypeReferenceNode
        handleNode(typeReferenceNode.typeName, context)
        handleNodes(typeReferenceNode.typeArguments, context)
        break
      case ts.SyntaxKind.FunctionType:
      case ts.SyntaxKind.ConstructorType:
        const signatureDeclarationBase = node as ts.SignatureDeclarationBase
        handleNode(signatureDeclarationBase.name, context)
        handleNodes(signatureDeclarationBase.parameters, context)
        handleNode(signatureDeclarationBase.type, context)
        handleNodes(signatureDeclarationBase.typeParameters, context)
        break
      case ts.SyntaxKind.TypeQuery:
        const typeQueryNode = node as ts.TypeQueryNode
        handleNode(typeQueryNode.exprName, context)
        break
      case ts.SyntaxKind.TypeLiteral:
        const typeLiteralNode = node as ts.TypeLiteralNode
        handleNodes(typeLiteralNode.members, context)
        break
      case ts.SyntaxKind.ArrayType:
        const arrayTypeNode = node as ts.ArrayTypeNode
        handleNode(arrayTypeNode.elementType, context)
        break
      case ts.SyntaxKind.TupleType:
        const tupleTypeNode = node as ts.TupleTypeNode
        handleNodes(tupleTypeNode.elementTypes, context)
        break
      case ts.SyntaxKind.OptionalType:
        break
      case ts.SyntaxKind.RestType:
        const restTypeNode = node as ts.RestTypeNode
        handleNode(restTypeNode.type, context)
        break
      case ts.SyntaxKind.UnionType:
        const unionTypeNode = node as ts.UnionTypeNode
        handleNodes(unionTypeNode.types, context)
        break
      case ts.SyntaxKind.IntersectionType:
        const intersectionTypeNode = node as ts.IntersectionTypeNode
        handleNodes(intersectionTypeNode.types, context)
        break
      case ts.SyntaxKind.ConditionalType:
        const conditionalTypeNode = node as ts.ConditionalTypeNode
        handleNode(conditionalTypeNode.checkType, context)
        handleNode(conditionalTypeNode.extendsType, context)
        handleNode(conditionalTypeNode.trueType, context)
        handleNode(conditionalTypeNode.falseType, context)
        break
      case ts.SyntaxKind.InferType:
        const inferTypeNode = node as ts.InferTypeNode
        handleNode(inferTypeNode.typeParameter, context)
        break
      case ts.SyntaxKind.ParenthesizedType:
        const parenthesizedTypeNode = node as ts.ParenthesizedTypeNode
        handleNode(parenthesizedTypeNode.type, context)
        break
      case ts.SyntaxKind.ThisType:
        break
      case ts.SyntaxKind.TypeOperator:
        const typeOperatorNode = node as ts.TypeOperatorNode
        handleNode(typeOperatorNode.type, context)
        break
      case ts.SyntaxKind.IndexedAccessType:
        const indexedAccessTypeNode = node as ts.IndexedAccessTypeNode
        handleNode(indexedAccessTypeNode.objectType, context)
        handleNode(indexedAccessTypeNode.indexType, context)
        break
      case ts.SyntaxKind.MappedType:
        const mappedTypeNode = node as ts.MappedTypeNode
        handleNode(mappedTypeNode.questionToken, context)
        handleNode(mappedTypeNode.readonlyToken, context)
        handleNode(mappedTypeNode.type, context)
        handleNode(mappedTypeNode.typeParameter, context)
        break
      case ts.SyntaxKind.LiteralType:
        const literalTypeNode = node as ts.LiteralTypeNode
        handleNode(literalTypeNode.literal, context)
        break
      case ts.SyntaxKind.ImportType:
        const importTypeNode = node as ts.ImportTypeNode
        handleNode(importTypeNode.qualifier, context)
        handleNode(importTypeNode.argument, context)
        handleNodes(importTypeNode.typeArguments, context)
        break
      case ts.SyntaxKind.ObjectBindingPattern:
        const objectBindingPattern = node as ts.ObjectBindingPattern
        handleNodes(objectBindingPattern.elements, context)
        break
      case ts.SyntaxKind.ArrayBindingPattern:
        const arrayBindingPattern = node as ts.ArrayBindingPattern
        handleNodes(arrayBindingPattern.elements, context)
        break
      case ts.SyntaxKind.BindingElement:
        const bindingElement = node as ts.BindingElement
        handleNode(bindingElement.name, context)
        handleNode(bindingElement.initializer, context)
        handleNode(bindingElement.dotDotDotToken, context)
        handleNode(bindingElement.propertyName, context)
        break
      case ts.SyntaxKind.ArrayLiteralExpression:
        const arrayLiteralExpression = node as ts.ArrayLiteralExpression
        handleNodes(arrayLiteralExpression.elements, context)
        break
      case ts.SyntaxKind.ObjectLiteralExpression:
        const objectLiteralExpression = node as ts.ObjectLiteralExpression
        handleNodes(objectLiteralExpression.properties, context)
        break
      case ts.SyntaxKind.PropertyAccessExpression:
        const propertyAccessExpression = node as ts.PropertyAccessExpression
        handleNode(propertyAccessExpression.expression, context)
        handleNode(propertyAccessExpression.name, context)
        break
      case ts.SyntaxKind.ElementAccessExpression:
        const elementAccessExpression = node as ts.ElementAccessExpression
        handleNode(elementAccessExpression.expression, context)
        handleNode(elementAccessExpression.argumentExpression, context)
        break
      case ts.SyntaxKind.CallExpression:
        const callExpression = node as ts.CallExpression
        handleNode(callExpression.expression, context)
        handleNodes(callExpression.arguments, context)
        handleNodes(callExpression.typeArguments, context)
        break
      case ts.SyntaxKind.NewExpression:
        const newExpression = node as ts.NewExpression
        handleNode(newExpression.expression, context)
        handleNodes(newExpression.arguments, context)
        handleNodes(newExpression.typeArguments, context)
        break
      case ts.SyntaxKind.TaggedTemplateExpression:
        const taggedTemplateExpression = node as ts.TaggedTemplateExpression
        handleNode(taggedTemplateExpression.template, context)
        break
      case ts.SyntaxKind.TypeAssertionExpression:
        const typeAssertion = node as ts.TypeAssertion
        handleNode(typeAssertion.expression, context)
        handleNode(typeAssertion.type, context)
        break
      case ts.SyntaxKind.ParenthesizedExpression:
        const parenthesizedExpression = node as ts.ParenthesizedExpression
        handleNode(parenthesizedExpression.expression, context)
        break
      case ts.SyntaxKind.FunctionExpression:
        const functionExpression = node as ts.FunctionExpression
        handleNode(functionExpression.name, context)
        handleNodes(functionExpression.parameters, context)
        handleNode(functionExpression.body, context)
        handleNode(functionExpression.asteriskToken, context)
        handleNode(functionExpression.questionToken, context)
        handleNode(functionExpression.type, context)
        handleNodes(functionExpression.typeParameters, context)
        break
      case ts.SyntaxKind.ArrowFunction:
        const arrowFunction = node as ts.ArrowFunction
        handleNode(arrowFunction.name, context)
        handleNodes(arrowFunction.parameters, context)
        handleNode(arrowFunction.body, context)
        handleNode(arrowFunction.asteriskToken, context)
        handleNode(arrowFunction.questionToken, context)
        handleNode(arrowFunction.type, context)
        handleNodes(arrowFunction.typeParameters, context)
        handleNode(arrowFunction.equalsGreaterThanToken, context)
        break
      case ts.SyntaxKind.DeleteExpression:
        const deleteExpression = node as ts.DeleteExpression
        handleNode(deleteExpression.expression, context)
        break
      case ts.SyntaxKind.TypeOfExpression:
        const typeOfExpression = node as ts.TypeOfExpression
        handleNode(typeOfExpression.expression, context)
        break
      case ts.SyntaxKind.VoidExpression:
        const voidExpression = node as ts.VoidExpression
        handleNode(voidExpression.expression, context)
        break
      case ts.SyntaxKind.AwaitExpression:
        const awaitExpression = node as ts.AwaitExpression
        handleNode(awaitExpression.expression, context)
        break
      case ts.SyntaxKind.PrefixUnaryExpression:
        const prefixUnaryExpression = node as ts.PrefixUnaryExpression
        handleNode(prefixUnaryExpression.operand, context)
        break
      case ts.SyntaxKind.PostfixUnaryExpression:
        const postfixUnaryExpression = node as ts.PostfixUnaryExpression
        handleNode(postfixUnaryExpression.operand, context)
        break
      case ts.SyntaxKind.BinaryExpression:
        const binaryExpression = node as ts.BinaryExpression
        handleNode(binaryExpression.left, context)
        handleNode(binaryExpression.right, context)
        handleNode(binaryExpression.operatorToken, context)
        break
      case ts.SyntaxKind.ConditionalExpression:
        const conditionalExpression = node as ts.ConditionalExpression
        handleNode(conditionalExpression.condition, context)
        handleNode(conditionalExpression.colonToken, context)
        handleNode(conditionalExpression.questionToken, context)
        handleNode(conditionalExpression.whenTrue, context)
        handleNode(conditionalExpression.whenFalse, context)
        break
      case ts.SyntaxKind.TemplateExpression:
        const templateExpression = node as ts.TemplateExpression
        handleNodes(templateExpression.templateSpans, context)
        break
      case ts.SyntaxKind.YieldExpression:
        const yieldExpression = node as ts.YieldExpression
        handleNode(yieldExpression.asteriskToken, context)
        handleNode(yieldExpression.expression, context)
        break
      case ts.SyntaxKind.SpreadElement:
        const spreadElement = node as ts.SpreadElement
        handleNode(spreadElement.expression, context)
        break
      case ts.SyntaxKind.ClassExpression:
        const classExpression = node as ts.ClassExpression
        handleNode(classExpression.name, context)
        handleNodes(classExpression.typeParameters, context)
        handleNodes(classExpression.members, context)
        handleNodes(classExpression.heritageClauses, context)
        break
      case ts.SyntaxKind.OmittedExpression:
        break
      case ts.SyntaxKind.ExpressionWithTypeArguments:
        const expressionWithTypeArguments = node as ts.ExpressionWithTypeArguments
        handleNode(expressionWithTypeArguments.expression, context)
        handleNodes(expressionWithTypeArguments.typeArguments, context)
        break
      case ts.SyntaxKind.AsExpression:
        const asExpression = node as ts.AsExpression
        handleNode(asExpression.expression, context)
        handleNode(asExpression.type, context)
        break
      case ts.SyntaxKind.NonNullExpression:
        const nonNullExpression = node as ts.NonNullExpression
        handleNode(nonNullExpression.expression, context)
        break
      case ts.SyntaxKind.MetaProperty:
        const metaProperty = node as ts.MetaProperty
        handleNode(metaProperty.name, context)
        break
      case ts.SyntaxKind.TemplateSpan:
        const templateSpan = node as ts.TemplateSpan
        handleNode(templateSpan.expression, context)
        handleNode(templateSpan.literal, context)
        break
      case ts.SyntaxKind.SemicolonClassElement:
        const semicolonClassElement = node as ts.SemicolonClassElement
        handleNode(semicolonClassElement.name, context)
        break
      case ts.SyntaxKind.Block:
        const block = node as ts.Block
        handleNodes(block.statements, context)
        break
      case ts.SyntaxKind.VariableStatement:
        const variableStatement = node as ts.VariableStatement
        handleNode(variableStatement.declarationList, context)
        break
      case ts.SyntaxKind.EmptyStatement:
        break
      case ts.SyntaxKind.ExpressionStatement:
        const expressionStatement = node as ts.ExpressionStatement
        handleNode(expressionStatement.expression, context)
        break
      case ts.SyntaxKind.IfStatement:
        const ifStatement = node as ts.IfStatement
        handleNode(ifStatement.expression, context)
        handleNode(ifStatement.thenStatement, context)
        handleNode(ifStatement.elseStatement, context)
        break
      case ts.SyntaxKind.DoStatement:
        const doStatement = node as ts.DoStatement
        handleNode(doStatement.expression, context)
        handleNode(doStatement.statement, context)
        break
      case ts.SyntaxKind.WhileStatement:
        const whileStatement = node as ts.WhileStatement
        handleNode(whileStatement.statement, context)
        handleNode(whileStatement.expression, context)
        break
      case ts.SyntaxKind.ForStatement:
        const forStatement = node as ts.ForStatement
        handleNode(forStatement.initializer, context)
        handleNode(forStatement.condition, context)
        handleNode(forStatement.incrementor, context)
        handleNode(forStatement.statement, context)
        break
      case ts.SyntaxKind.ForInStatement:
        const forInStatement = node as ts.ForInStatement
        handleNode(forInStatement.initializer, context)
        handleNode(forInStatement.expression, context)
        handleNode(forInStatement.statement, context)
        break
      case ts.SyntaxKind.ForOfStatement:
        const forOfStatement = node as ts.ForOfStatement
        handleNode(forOfStatement.initializer, context)
        handleNode(forOfStatement.statement, context)
        handleNode(forOfStatement.expression, context)
        handleNode(forOfStatement.awaitModifier, context)
        break
      case ts.SyntaxKind.ContinueStatement:
      case ts.SyntaxKind.BreakStatement:
        break
      case ts.SyntaxKind.ReturnStatement:
        const returnStatement = node as ts.ReturnStatement
        handleNode(returnStatement.expression, context)
        break
      case ts.SyntaxKind.WithStatement:
        const withStatement = node as ts.WithStatement
        handleNode(withStatement.expression, context)
        handleNode(withStatement.statement, context)
        break
      case ts.SyntaxKind.SwitchStatement:
        const switchStatement = node as ts.SwitchStatement
        handleNode(switchStatement.expression, context)
        handleNode(switchStatement.caseBlock, context)
        break
      case ts.SyntaxKind.LabeledStatement:
        const labeledStatement = node as ts.LabeledStatement
        handleNode(labeledStatement.label, context)
        handleNode(labeledStatement.statement, context)
        break
      case ts.SyntaxKind.ThrowStatement:
        const throwStatement = node as ts.ThrowStatement
        handleNode(throwStatement.expression, context)
        break
      case ts.SyntaxKind.TryStatement:
        const tryStatement = node as ts.TryStatement
        handleNode(tryStatement.tryBlock, context)
        handleNode(tryStatement.catchClause, context)
        handleNode(tryStatement.finallyBlock, context)
        break
      case ts.SyntaxKind.DebuggerStatement:
        break
      case ts.SyntaxKind.VariableDeclaration:
        const variableDeclaration = node as ts.VariableDeclaration
        handleNode(variableDeclaration.name, context)
        handleNode(variableDeclaration.type, context)
        handleNode(variableDeclaration.initializer, context)
        break
      case ts.SyntaxKind.VariableDeclarationList:
        const declarationList = node as ts.VariableDeclarationList
        handleNodes(declarationList.declarations, context)
        break
      case ts.SyntaxKind.FunctionDeclaration:
        const functionDeclaration = node as ts.FunctionDeclaration
        handleNode(functionDeclaration.name, context)
        handleNodes(functionDeclaration.parameters, context)
        handleNode(functionDeclaration.body, context)
        handleNode(functionDeclaration.asteriskToken, context)
        handleNode(functionDeclaration.questionToken, context)
        handleNode(functionDeclaration.type, context)
        handleNodes(functionDeclaration.typeParameters, context)
        break
      case ts.SyntaxKind.ClassDeclaration:
        const classDeclaration = node as ts.ClassDeclaration
        handleNode(classDeclaration.name, context)
        handleNodes(classDeclaration.members, context)
        handleNodes(classDeclaration.typeParameters, context)
        handleNodes(classDeclaration.heritageClauses, context)
        break
      case ts.SyntaxKind.InterfaceDeclaration:
        const interfaceDeclaration = node as ts.InterfaceDeclaration
        handleNode(interfaceDeclaration.name, context)
        handleNodes(interfaceDeclaration.members, context)
        handleNodes(interfaceDeclaration.typeParameters, context)
        handleNodes(interfaceDeclaration.heritageClauses, context)
        break
      case ts.SyntaxKind.TypeAliasDeclaration:
        const typeAliasDeclaration = node as ts.TypeAliasDeclaration
        handleNode(typeAliasDeclaration.name, context)
        handleNode(typeAliasDeclaration.type, context)
        handleNodes(typeAliasDeclaration.typeParameters, context)
        break
      case ts.SyntaxKind.EnumDeclaration:
        const enumDeclaration = node as ts.EnumDeclaration
        handleNode(enumDeclaration.name, context)
        handleNodes(enumDeclaration.members, context)
        break
      case ts.SyntaxKind.ModuleDeclaration:
        const moduleDeclaration = node as ts.ModuleDeclaration
        handleNode(moduleDeclaration.name, context)
        handleNode(moduleDeclaration.body, context)
        break
      case ts.SyntaxKind.ModuleBlock:
        const moduleBlock = node as ts.ModuleBlock
        handleNodes(moduleBlock.statements, context)
        break
      case ts.SyntaxKind.CaseBlock:
        const caseBlock = node as ts.CaseBlock
        handleNodes(caseBlock.clauses, context)
        break
      case ts.SyntaxKind.NamespaceExportDeclaration:
        const namespaceExportDeclaration = node as ts.NamespaceExportDeclaration
        handleNode(namespaceExportDeclaration.name, context)
        break
      case ts.SyntaxKind.ImportEqualsDeclaration:
        const importEqualsDeclaration = node as ts.ImportEqualsDeclaration
        handleNode(importEqualsDeclaration.name, context)
        handleNode(importEqualsDeclaration.moduleReference, context)
        break
      case ts.SyntaxKind.ImportDeclaration:
        const importDeclaration = node as ts.ImportDeclaration
        handleNode(importDeclaration.importClause, context)
        handleNode(importDeclaration.moduleSpecifier, context)
        break
      case ts.SyntaxKind.ImportClause:
        const importClause = node as ts.ImportClause
        handleNode(importClause.name, context)
        handleNode(importClause.namedBindings, context)
        break
      case ts.SyntaxKind.NamespaceImport:
        const namespaceImport = node as ts.NamespaceImport
        handleNode(namespaceImport.name, context)
        break
      case ts.SyntaxKind.NamedImports:
        const namedImports = node as ts.NamedImports
        handleNodes(namedImports.elements, context)
        break
      case ts.SyntaxKind.ImportSpecifier:
        const importSpecifier = node as ts.ImportSpecifier
        handleNode(importSpecifier.name, context)
        handleNode(importSpecifier.propertyName, context)
        break
      case ts.SyntaxKind.ExportAssignment:
        const exportAssignment = node as ts.ExportAssignment
        handleNode(exportAssignment.name, context)
        handleNode(exportAssignment.expression, context)
        break
      case ts.SyntaxKind.ExportDeclaration:
        const exportDeclaration = node as ts.ExportDeclaration
        handleNode(exportDeclaration.exportClause, context)
        handleNode(exportDeclaration.name, context)
        handleNode(exportDeclaration.moduleSpecifier, context)
        break
      case ts.SyntaxKind.NamedExports:
        const namedExports = node as ts.NamedExports
        handleNodes(namedExports.elements, context)
        break
      case ts.SyntaxKind.ExportSpecifier:
        const exportSpecifier = node as ts.ExportSpecifier
        handleNode(exportSpecifier.name, context)
        handleNode(exportSpecifier.propertyName, context)
        break
      case ts.SyntaxKind.MissingDeclaration:
        const missingDeclaration = node as ts.MissingDeclaration
        handleNode(missingDeclaration.name, context)
        break
      case ts.SyntaxKind.ExternalModuleReference:
        const externalModuleReference = node as ts.ExternalModuleReference
        handleNode(externalModuleReference.expression, context)
        break
      case ts.SyntaxKind.JsxElement:
        const jsxElement = node as ts.JsxElement
        handleNode(jsxElement.openingElement, context)
        handleNode(jsxElement.closingElement, context)
        handleNodes(jsxElement.children, context)
        break
      case ts.SyntaxKind.JsxSelfClosingElement:
        const jsxSelfClosingElement = node as ts.JsxSelfClosingElement
        handleNode(jsxSelfClosingElement.attributes, context)
        handleNode(jsxSelfClosingElement.tagName, context)
        break
      case ts.SyntaxKind.JsxOpeningElement:
        const jsxOpeningElement = node as ts.JsxOpeningElement
        handleNode(jsxOpeningElement.attributes, context)
        handleNode(jsxOpeningElement.tagName, context)
        break
      case ts.SyntaxKind.JsxClosingElement:
        const jsxClosingElement = node as ts.JsxClosingElement
        handleNode(jsxClosingElement.tagName, context)
        break
      case ts.SyntaxKind.JsxFragment:
        const jsxFragment = node as ts.JsxFragment
        handleNode(jsxFragment.openingFragment, context)
        handleNode(jsxFragment.closingFragment, context)
        handleNodes(jsxFragment.children, context)
        break
      case ts.SyntaxKind.JsxOpeningFragment:
        break
      case ts.SyntaxKind.JsxClosingFragment:
        break
      case ts.SyntaxKind.JsxAttribute:
        const jsxAttribute = node as ts.JsxAttribute
        handleNode(jsxAttribute.name, context)
        handleNode(jsxAttribute.initializer, context)
        break
      case ts.SyntaxKind.JsxAttributes:
        const jsxAttributes = node as ts.JsxAttributes
        handleNodes(jsxAttributes.properties, context)
        break
      case ts.SyntaxKind.JsxSpreadAttribute:
        const jsxSpreadAttribute = node as ts.JsxSpreadAttribute
        handleNode(jsxSpreadAttribute.name, context)
        handleNode(jsxSpreadAttribute.expression, context)
        break
      case ts.SyntaxKind.JsxExpression:
        const jsxExpression = node as ts.JsxExpression
        handleNode(jsxExpression.dotDotDotToken, context)
        handleNode(jsxExpression.expression, context)
        break
      case ts.SyntaxKind.CaseClause:
        const caseClause = node as ts.CaseClause
        handleNodes(caseClause.statements, context)
        handleNode(caseClause.expression, context)
        break
      case ts.SyntaxKind.DefaultClause:
        const defaultClause = node as ts.DefaultClause
        handleNodes(defaultClause.statements, context)
        break
      case ts.SyntaxKind.HeritageClause:
        const heritageClause = node as ts.HeritageClause
        handleNodes(heritageClause.types, context)
        break
      case ts.SyntaxKind.CatchClause:
        const catchClause = node as ts.CatchClause
        handleNode(catchClause.variableDeclaration, context)
        handleNode(catchClause.block, context)
        break
      case ts.SyntaxKind.PropertyAssignment:
        const propertyAssignmentExpression = node as ts.PropertyAssignment
        handleNode(propertyAssignmentExpression.name, context)
        handleNode(propertyAssignmentExpression.questionToken, context)
        handleNode(propertyAssignmentExpression.initializer, context)
        break
      case ts.SyntaxKind.ShorthandPropertyAssignment:
        const shorthandPropertyAssignment = node as ts.ShorthandPropertyAssignment
        handleNode(shorthandPropertyAssignment.name, context)
        handleNode(shorthandPropertyAssignment.questionToken, context)
        handleNode(shorthandPropertyAssignment.equalsToken, context)
        handleNode(shorthandPropertyAssignment.objectAssignmentInitializer, context)
        break
      case ts.SyntaxKind.SpreadAssignment:
        const spreadAssignment = node as ts.SpreadAssignment
        handleNode(spreadAssignment.name, context)
        handleNode(spreadAssignment.expression, context)
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

  const allFiles: string[] = []
  const sourceFileInfos: SourceFileInfo[] = []
  const typeCheckResult = await readCache(enableCache)
  for (const sourceFile of program.getSourceFiles()) {
    let file = sourceFile.fileName
    if (!file.includes('node_modules') && (!files || files.includes(file))) {
      file = path.relative(process.cwd(), file)
      allFiles.push(file)
      const hash = enableCache ? calculateHash((await readFileAsync(file)).toString()) : ''
      const cache = typeCheckResult.cache.find((c) => c.file === file && c.hash === hash)
      sourceFileInfos.push({
        file,
        sourceFile,
        hash,
        cache
      })
    }
  }

  const dependencies: [string, string][] = []
  if (enableCache) {
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
  }

  function clearCacheOfDependencies(sourceFileInfo: SourceFileInfo) {
    for (const dependency of dependencies) {
      if (dependency[1] === sourceFileInfo.file) {
        const dependentSourceFileInfo = sourceFileInfos.find((s) => s.file === dependency[0])
        if (dependentSourceFileInfo && dependentSourceFileInfo.cache) {
          dependentSourceFileInfo.cache = undefined
          clearCacheOfDependencies(dependentSourceFileInfo)
        }
      }
    }
  }

  if (enableCache) {
    for (const sourceFileInfo of sourceFileInfos) {
      if (!sourceFileInfo.cache) {
        clearCacheOfDependencies(sourceFileInfo)
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
      anys.push(...cache.anys)
      continue
    }

    const context: FileContext = {
      file,
      sourceFile,
      typeCheckResult: {
        correctCount: 0,
        totalCount: 0,
        anys: []
      }
    }

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
    sourceFile.forEachChild(node => {
      handleNode(node, context)
    })

    correctCount += context.typeCheckResult.correctCount
    totalCount += context.typeCheckResult.totalCount
    anys.push(...context.typeCheckResult.anys)
    if (enableCache) {
      const resultCache = typeCheckResult.cache.find((c) => c.file === file)
      if (resultCache) {
        resultCache.hash = hash
        resultCache.correctCount = context.typeCheckResult.correctCount
        resultCache.totalCount = context.typeCheckResult.totalCount
        resultCache.anys = context.typeCheckResult.anys
      } else {
        typeCheckResult.cache.push({
          file,
          hash,
          ...context.typeCheckResult
        })
      }
    }
  }

  if (enableCache) {
    await mkdirIfmissing()
    await writeFileAsync(path.resolve(dirName, 'result.json'), JSON.stringify(typeCheckResult, null, 2))
  }

  return { correctCount, totalCount, anys, program }
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

function calculateHash(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex')
}

const dirName = '.type-coverage'

function statAsync(p: string) {
  return new Promise<fs.Stats | undefined>((resolve) => {
    fs.stat(p, (err, stats) => {
      if (err) {
        resolve(undefined)
      } else {
        resolve(stats)
      }
    })
  })
}

async function mkdirIfmissing() {
  const stats = await statAsync(dirName)
  if (!stats) {
    await mkdirAsync(dirName)
  }
}

async function readCache(enableCache: boolean) {
  if (!enableCache) {
    return {
      cache: []
    }
  }
  const filepath = path.resolve(dirName, 'result.json')
  const stats = await statAsync(filepath)
  if (stats && stats.isFile()) {
    const text = (await readFileAsync(filepath)).toString()
    return JSON.parse(text) as TypeCheckResult
  }
  return {
    cache: []
  }
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
