import * as minimist from "minimist";
import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
import * as packageJson from "../package.json";

let suppressError = false;

function showToolVersion() {
    console.log(`Version: ${packageJson.version}`);
}

function globAsync(pattern: string, ignore?: string | string[]) {
    return new Promise<string[]>((resolve, reject) => {
        glob(pattern, { ignore }, (error, matches) => {
            if (error) {
                reject(error);
            } else {
                resolve(matches);
            }
        });
    });
}

async function executeCommandLine() {
    const argv = minimist(process.argv.slice(2), { "--": true });

    const showVersion: boolean = argv.v || argv.version;
    if (showVersion) {
        showToolVersion();
        return;
    }

    suppressError = argv.suppressError;

    const project: string = argv.p || argv.project || ".";
    let configFilePath: string;
    let basename: string;
    const projectStats = fs.statSync(project);
    if (projectStats.isDirectory()) {
        configFilePath = path.resolve(project, "tsconfig.json");
        basename = project;
    } else if (projectStats.isFile()) {
        configFilePath = project;
        basename = path.basename(project);
    } else {
        throw new Error("paramter '-p' should be a file or directory.");
    }

    const { config, error } = ts.readConfigFile(configFilePath, p => fs.readFileSync(p).toString());
    if (error) {
        throw error;
    }
    const include: string[] | undefined = config.include;
    const exclude: string[] | undefined = config.exclude || ["./node_modules/**"];
    let rootNames: string[];
    if (config.files) {
        rootNames = config.files;
    } else if (include && Array.isArray(include) && include.length > 0) {
        rootNames = await globAsync(include.length === 1 ? include[0] : `{${include.join(",")}}`, exclude);
    } else {
        rootNames = await globAsync(`${basename}/**/*.{ts,tsx}`, exclude);
    }
    config.compilerOptions.moduleResolution = undefined;
    const program = ts.createProgram(rootNames, config.compilerOptions);
    const checker = program.getTypeChecker();

    let correctCount = 0;
    let totalCount = 0;

    const detail: boolean = argv.detail;
    const debug: boolean = argv.debug;

    function collectData(node: ts.Node, file: string, sourceFile: ts.SourceFile) {
        const type = checker.getTypeAtLocation(node);
        if (type) {
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
            totalCount++;
            if (type.flags === 1 && (type as any).intrinsicName === "any") {
                if (debug) {
                    console.log(`type === any: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)}`);
                } else if (detail) {
                    console.log(`${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)}`);
                }
            } else {
                correctCount++;
                if (debug) {
                    console.log(`type !== any: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)} ${node.kind}(kind) ${type.flags}(flag) ${(type as any).intrinsicName || ""}`);
                }
            }
        }
    }

    function handleNodes(nodes: ts.NodeArray<ts.Node> | undefined, file: string, sourceFile: ts.SourceFile): void {
        if (nodes === undefined) {
            return;
        }

        for (const node of nodes) {
            handleNode(node, file, sourceFile);
        }
    }

    function handleNode(node: ts.Node | undefined, file: string, sourceFile: ts.SourceFile): void {
        if (node === undefined) {
            return;
        }

        if (debug) {
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
            console.log(`node: ${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)} ${node.kind}(kind)`);
        }

        switch (node.kind) {
            case ts.SyntaxKind.EndOfFileToken:
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.RegularExpressionLiteral:
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                return;
            case ts.SyntaxKind.Identifier:
                collectData(node, file, sourceFile);
                break;
            case ts.SyntaxKind.FalseKeyword:
            case ts.SyntaxKind.NullKeyword:
                return;
            case ts.SyntaxKind.ThisKeyword:
                collectData(node, file, sourceFile);
                break;
            case ts.SyntaxKind.TrueKeyword:
                return;
            case ts.SyntaxKind.QualifiedName:
                const qualifiedName = node as ts.QualifiedName;
                handleNode(qualifiedName.left, file, sourceFile);
                handleNode(qualifiedName.right, file, sourceFile);
                break;
            case ts.SyntaxKind.Parameter:
                const parameter = node as ts.ParameterDeclaration;
                handleNode(parameter.name, file, sourceFile);
                handleNode(parameter.initializer, file, sourceFile);
                break;
            case ts.SyntaxKind.PropertyDeclaration:
                const propertyDeclaration = node as ts.PropertyDeclaration;
                handleNode(propertyDeclaration.name, file, sourceFile);
                handleNode(propertyDeclaration.initializer, file, sourceFile);
                break;
            case ts.SyntaxKind.MethodDeclaration:
                const methodDeclaration = node as ts.MethodDeclaration;
                handleNodes(methodDeclaration.parameters, file, sourceFile);
                handleNode(methodDeclaration.body, file, sourceFile);
                break;
            case ts.SyntaxKind.Constructor:
                const constructorDeclaration = node as ts.ConstructorDeclaration;
                handleNode(constructorDeclaration.name, file, sourceFile);
                handleNodes(constructorDeclaration.parameters, file, sourceFile);
                handleNode(constructorDeclaration.body, file, sourceFile);
                break;
            case ts.SyntaxKind.GetAccessor:
                const getAccessorDeclaration = node as ts.GetAccessorDeclaration;
                handleNode(getAccessorDeclaration.name, file, sourceFile);
                handleNodes(getAccessorDeclaration.parameters, file, sourceFile);
                handleNode(getAccessorDeclaration.body, file, sourceFile);
                break;
            case ts.SyntaxKind.IndexSignature:
                const indexSignatureDeclaration = node as ts.IndexSignatureDeclaration;
                handleNode(indexSignatureDeclaration.name, file, sourceFile);
                handleNodes(indexSignatureDeclaration.parameters, file, sourceFile);
                break;
            case ts.SyntaxKind.ObjectBindingPattern:
                const objectBindingPattern = node as ts.ObjectBindingPattern;
                handleNodes(objectBindingPattern.elements, file, sourceFile);
                break;
            case ts.SyntaxKind.ArrayBindingPattern:
                const arrayBindingPattern = node as ts.ArrayBindingPattern;
                handleNodes(arrayBindingPattern.elements, file, sourceFile);
                break;
            case ts.SyntaxKind.BindingElement:
                const bindingElement = node as ts.BindingElement;
                handleNode(bindingElement.name, file, sourceFile);
                handleNode(bindingElement.initializer, file, sourceFile);
                break;
            case ts.SyntaxKind.ArrayLiteralExpression:
                const arrayLiteralExpression = node as ts.ArrayLiteralExpression;
                handleNodes(arrayLiteralExpression.elements, file, sourceFile);
                break;
            case ts.SyntaxKind.ObjectLiteralExpression:
                const objectLiteralExpression = node as ts.ObjectLiteralExpression;
                handleNodes(objectLiteralExpression.properties, file, sourceFile);
                break;
            case ts.SyntaxKind.PropertyAccessExpression:
                const propertyAccessExpression = node as ts.PropertyAccessExpression;
                handleNode(propertyAccessExpression.expression, file, sourceFile);
                handleNode(propertyAccessExpression.name, file, sourceFile);
                break;
            case ts.SyntaxKind.ElementAccessExpression:
                const elementAccessExpression = node as ts.ElementAccessExpression;
                handleNode(elementAccessExpression.expression, file, sourceFile);
                handleNode(elementAccessExpression.argumentExpression, file, sourceFile);
                break;
            case ts.SyntaxKind.CallExpression:
                const callExpression = node as ts.CallExpression;
                handleNode(callExpression.expression, file, sourceFile);
                handleNodes(callExpression.arguments, file, sourceFile);
                break;
            case ts.SyntaxKind.NewExpression:
                const newExpression = node as ts.NewExpression;
                handleNode(newExpression.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.TypeAssertionExpression:
                const typeAssertion = node as ts.TypeAssertion;
                handleNode(typeAssertion.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.ParenthesizedExpression:
                const parenthesizedExpression = node as ts.ParenthesizedExpression;
                handleNode(parenthesizedExpression.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.FunctionExpression:
                const functionExpression = node as ts.FunctionExpression;
                handleNode(functionExpression.body, file, sourceFile);
                handleNode(functionExpression.name, file, sourceFile);
                break;
            case ts.SyntaxKind.ArrowFunction:
                const arrowFunction = node as ts.ArrowFunction;
                handleNode(arrowFunction.body, file, sourceFile);
                break;
            case ts.SyntaxKind.DeleteExpression:
                const deleteExpression = node as ts.DeleteExpression;
                handleNode(deleteExpression.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.TypeOfExpression:
                const typeOfExpression = node as ts.TypeOfExpression;
                handleNode(typeOfExpression.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.VoidExpression:
                const voidExpression = node as ts.VoidExpression;
                handleNode(voidExpression.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.AwaitExpression:
                const awaitExpression = node as ts.AwaitExpression;
                handleNode(awaitExpression.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.PrefixUnaryExpression:
                const prefixUnaryExpression = node as ts.PrefixUnaryExpression;
                handleNode(prefixUnaryExpression.operand, file, sourceFile);
                break;
            case ts.SyntaxKind.PostfixUnaryExpression:
                const postfixUnaryExpression = node as ts.PostfixUnaryExpression;
                handleNode(postfixUnaryExpression.operand, file, sourceFile);
                break;
            case ts.SyntaxKind.BinaryExpression:
                const binaryExpression = node as ts.BinaryExpression;
                handleNode(binaryExpression.left, file, sourceFile);
                handleNode(binaryExpression.right, file, sourceFile);
                break;
            case ts.SyntaxKind.ConditionalExpression:
                const conditionalExpression = node as ts.ConditionalExpression;
                handleNode(conditionalExpression.whenTrue, file, sourceFile);
                handleNode(conditionalExpression.whenFalse, file, sourceFile);
                break;
            case ts.SyntaxKind.TemplateExpression:
                const templateExpression = node as ts.TemplateExpression;
                handleNodes(templateExpression.templateSpans, file, sourceFile);
                break;
            case ts.SyntaxKind.SpreadElement:
                const spreadElement = node as ts.SpreadElement;
                handleNode(spreadElement.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.AsExpression:
                const asExpression = node as ts.AsExpression;
                handleNode(asExpression.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.NonNullExpression:
                const nonNullExpression = node as ts.NonNullExpression;
                handleNode(nonNullExpression.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.TemplateSpan:
                const templateSpan = node as ts.TemplateSpan;
                handleNode(templateSpan.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.Block:
                const block = node as ts.Block;
                handleNodes(block.statements, file, sourceFile);
                break;
            case ts.SyntaxKind.VariableStatement:
                const variableStatement = node as ts.VariableStatement;
                handleNode(variableStatement.declarationList, file, sourceFile);
                break;
            case ts.SyntaxKind.EmptyStatement:
                return;
            case ts.SyntaxKind.ExpressionStatement:
                const expressionStatement = node as ts.ExpressionStatement;
                handleNode(expressionStatement.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.IfStatement:
                const ifStatement = node as ts.IfStatement;
                handleNode(ifStatement.expression, file, sourceFile);
                handleNode(ifStatement.thenStatement, file, sourceFile);
                handleNode(ifStatement.elseStatement, file, sourceFile);
                break;
            case ts.SyntaxKind.WhileStatement:
                const whileStatement = node as ts.WhileStatement;
                handleNode(whileStatement.statement, file, sourceFile);
                handleNode(whileStatement.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.ForStatement:
                const forStatement = node as ts.ForStatement;
                handleNode(forStatement.initializer, file, sourceFile);
                handleNode(forStatement.condition, file, sourceFile);
                handleNode(forStatement.incrementor, file, sourceFile);
                handleNode(forStatement.statement, file, sourceFile);
                break;
            case ts.SyntaxKind.ForInStatement:
                const forInStatement = node as ts.ForInStatement;
                handleNode(forInStatement.initializer, file, sourceFile);
                handleNode(forInStatement.expression, file, sourceFile);
                handleNode(forInStatement.statement, file, sourceFile);
                break;
            case ts.SyntaxKind.ForOfStatement:
                const forOfStatement = node as ts.ForOfStatement;
                handleNode(forOfStatement.statement, file, sourceFile);
                break;
            case ts.SyntaxKind.ContinueStatement:
            case ts.SyntaxKind.BreakStatement:
                return;
            case ts.SyntaxKind.ReturnStatement:
                const returnStatement = node as ts.ReturnStatement;
                handleNode(returnStatement.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.SwitchStatement:
                const switchStatement = node as ts.SwitchStatement;
                handleNode(switchStatement.expression, file, sourceFile);
                handleNode(switchStatement.caseBlock, file, sourceFile);
                break;
            case ts.SyntaxKind.ThrowStatement:
                const throwStatement = node as ts.ThrowStatement;
                handleNode(throwStatement.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.TryStatement:
                const tryStatement = node as ts.TryStatement;
                handleNode(tryStatement.tryBlock, file, sourceFile);
                handleNode(tryStatement.catchClause, file, sourceFile);
                handleNode(tryStatement.finallyBlock, file, sourceFile);
                break;
            case ts.SyntaxKind.VariableDeclaration:
                const variableDeclaration = node as ts.VariableDeclaration;
                handleNode(variableDeclaration.name, file, sourceFile);
                handleNode(variableDeclaration.initializer, file, sourceFile);
                break;
            case ts.SyntaxKind.VariableDeclarationList:
                const declarationList = node as ts.VariableDeclarationList;
                handleNodes(declarationList.declarations, file, sourceFile);
                break;
            case ts.SyntaxKind.FunctionDeclaration:
                const functionDeclaration = node as ts.FunctionDeclaration;
                handleNode(functionDeclaration.body, file, sourceFile);
                handleNodes(functionDeclaration.parameters, file, sourceFile);
                break;
            case ts.SyntaxKind.ClassDeclaration:
                const classDeclaration = node as ts.ClassDeclaration;
                handleNode(classDeclaration.name, file, sourceFile);
                handleNodes(classDeclaration.members, file, sourceFile);
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
            case ts.SyntaxKind.EnumDeclaration:
                return;
            case ts.SyntaxKind.ModuleDeclaration:
                const moduleDeclaration = node as ts.ModuleDeclaration;
                handleNode(moduleDeclaration.body, file, sourceFile);
                break;
            case ts.SyntaxKind.ModuleBlock:
                const moduleBlock = node as ts.ModuleBlock;
                handleNodes(moduleBlock.statements, file, sourceFile);
                break;
            case ts.SyntaxKind.CaseBlock:
                const caseBlock = node as ts.CaseBlock;
                handleNodes(caseBlock.clauses, file, sourceFile);
                break;
            case ts.SyntaxKind.NamespaceExportDeclaration:
                const namespaceExportDeclaration = node as ts.NamespaceExportDeclaration;
                handleNode(namespaceExportDeclaration.name, file, sourceFile);
                break;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                const importEqualsDeclaration = node as ts.ImportEqualsDeclaration;
                handleNode(importEqualsDeclaration.name, file, sourceFile);
                handleNode(importEqualsDeclaration.moduleReference, file, sourceFile);
                break;
            case ts.SyntaxKind.ImportDeclaration:
                const importDeclaration = node as ts.ImportDeclaration;
                handleNode(importDeclaration.importClause, file, sourceFile);
                break;
            case ts.SyntaxKind.ImportClause:
                const importClause = node as ts.ImportClause;
                handleNode(importClause.name, file, sourceFile);
                handleNode(importClause.namedBindings, file, sourceFile);
                break;
            case ts.SyntaxKind.NamespaceImport:
                const namespaceImport = node as ts.NamespaceImport;
                handleNode(namespaceImport.name, file, sourceFile);
                break;
            case ts.SyntaxKind.NamedImports:
                const namedImports = node as ts.NamedImports;
                handleNodes(namedImports.elements, file, sourceFile);
                break;
            case ts.SyntaxKind.ImportSpecifier:
                const importSpecifier = node as ts.ImportSpecifier;
                handleNode(importSpecifier.name, file, sourceFile);
                handleNode(importSpecifier.propertyName, file, sourceFile);
                break;
            case ts.SyntaxKind.ExportAssignment:
                const exportAssignment = node as ts.ExportAssignment;
                handleNode(exportAssignment.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.ExportDeclaration:
                const exportDeclaration = node as ts.ExportDeclaration;
                handleNode(exportDeclaration.exportClause, file, sourceFile);
                break;
            case ts.SyntaxKind.NamedExports:
                const namedExports = node as ts.NamedExports;
                handleNodes(namedExports.elements, file, sourceFile);
                break;
            case ts.SyntaxKind.ExportSpecifier:
                const exportSpecifier = node as ts.ExportSpecifier;
                handleNode(exportSpecifier.name, file, sourceFile);
                break;
            case ts.SyntaxKind.ExternalModuleReference:
                const externalModuleReference = node as ts.ExternalModuleReference;
                handleNode(externalModuleReference.expression, file, sourceFile);
                break;
            case ts.SyntaxKind.CaseClause:
                const caseClause = node as ts.CaseClause;
                handleNodes(caseClause.statements, file, sourceFile);
                break;
            case ts.SyntaxKind.DefaultClause:
                const defaultClause = node as ts.DefaultClause;
                handleNodes(defaultClause.statements, file, sourceFile);
                break;
            case ts.SyntaxKind.CatchClause:
                const catchClause = node as ts.CatchClause;
                handleNode(catchClause.variableDeclaration, file, sourceFile);
                handleNode(catchClause.block, file, sourceFile);
                break;
            case ts.SyntaxKind.PropertyAssignment:
                const propertyAssignmentExpression = node as ts.PropertyAssignment;
                handleNode(propertyAssignmentExpression.initializer, file, sourceFile);
                break;
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                const shorthandPropertyAssignment = node as ts.ShorthandPropertyAssignment;
                handleNode(shorthandPropertyAssignment.name, file, sourceFile);
                break;
            case ts.SyntaxKind.SpreadAssignment:
                const spreadAssignment = node as ts.SpreadAssignment;
                handleNode(spreadAssignment.name, file, sourceFile);
                handleNode(spreadAssignment.expression, file, sourceFile);
                break;
            default:
                console.log(`warning: unhandled node kind: ${node.kind}`);
        }
    }

    for (const file of rootNames) {
        const sourceFile = program.getSourceFile(file);
        sourceFile.forEachChild(node => {
            handleNode(node, file, sourceFile);
        });
    }

    const percent = Math.round(100 * correctCount / totalCount);
    console.log(`${correctCount} / ${totalCount} ${percent}%`);

    const atLeast: number | undefined = argv["at-least"];
    if (atLeast && percent < atLeast) {
        throw new Error(`The type coverage rate(${percent}%) is lower than ${atLeast}`);
    }
}

executeCommandLine().then(() => {
    console.log("type-coverage success.");
}, error => {
    if (error instanceof Error) {
        console.log(error.message);
    } else {
        console.log(error);
    }
    if (!suppressError) {
        process.exit(1);
    }
});
