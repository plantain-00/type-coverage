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
    const exclude: string[] | undefined = config.exclude || ["node_modules/"];
    let rootNames: string[];
    if (config.files) {
        rootNames = config.files;
    } else if (include && Array.isArray(include) && include.length > 0) {
        rootNames = await globAsync(include.length === 1 ? include[0] : `{${include.join(",")}}`, exclude);
    } else {
        rootNames = await globAsync(`{${basename}/**/*.ts,${basename}/**/*.tsx}`, exclude);
    }
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
                if (detail || debug) {
                    console.log(`${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)}`);
                }
            } else {
                correctCount++;
                if (debug) {
                    console.log(`${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)} ${node.kind}(kind) ${type.flags}(flag) ${(type as any).intrinsicName || ""}`);
                }
            }
        }
    }

    function handleNode(node: ts.Node | undefined, file: string, sourceFile: ts.SourceFile): void {
        if (node === undefined) {
            return;
        }

        if (debug) {
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
            console.log(`${file}:${line + 1}:${character + 1}: ${node.getText(sourceFile)} ${node.kind}(kind)`);
        }

        if (node.kind === ts.SyntaxKind.CallExpression) {
            const callExpression = node as ts.CallExpression;
            handleNode(callExpression.expression, file, sourceFile);
            for (const parameter of callExpression.arguments) {
                handleNode(parameter, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.ForOfStatement) {
            const forOfStatement = node as ts.ForOfStatement;
            handleNode(forOfStatement.statement, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.ArrowFunction
            || node.kind === ts.SyntaxKind.ModuleDeclaration) {
            const declaration = node as ts.ArrowFunction | ts.ModuleDeclaration;
            handleNode(declaration.body, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.PropertyAssignment) {
            const propertyAssignmentExpression = node as ts.PropertyAssignment;
            handleNode(propertyAssignmentExpression.initializer, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.PrefixUnaryExpression
            || node.kind === ts.SyntaxKind.PostfixUnaryExpression) {
            const prefixUnaryExpression = node as ts.PrefixUnaryExpression | ts.PostfixUnaryExpression;
            handleNode(prefixUnaryExpression.operand, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
            const propertyAccessExpression = node as ts.PropertyAccessExpression;
            handleNode(propertyAccessExpression.expression, file, sourceFile);
            handleNode(propertyAccessExpression.name, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.ExportSpecifier) {
            const exportSpecifier = node as ts.ExportSpecifier;
            handleNode(exportSpecifier.name, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.VariableDeclaration) {
            const expression = node as ts.VariableDeclaration;
            handleNode(expression.name, file, sourceFile);
            handleNode(expression.initializer, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.ExportDeclaration) {
            const exportDeclaration = node as ts.ExportDeclaration;
            handleNode(exportDeclaration.exportClause, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.TemplateSpan
            || node.kind === ts.SyntaxKind.ReturnStatement
            || node.kind === ts.SyntaxKind.AsExpression
            || node.kind === ts.SyntaxKind.SpreadElement
            || node.kind === ts.SyntaxKind.ExpressionStatement
            || node.kind === ts.SyntaxKind.AwaitExpression
            || node.kind === ts.SyntaxKind.NewExpression
            || node.kind === ts.SyntaxKind.ParenthesizedExpression
            || node.kind === ts.SyntaxKind.TypeOfExpression
            || node.kind === ts.SyntaxKind.NonNullExpression
            || node.kind === ts.SyntaxKind.ThrowStatement
            || node.kind === ts.SyntaxKind.ExportAssignment
            || node.kind === ts.SyntaxKind.DeleteExpression
            || node.kind === ts.SyntaxKind.VoidExpression
            || node.kind === ts.SyntaxKind.TypeAssertionExpression) {
            const expression = node as ts.TemplateSpan
                | ts.ReturnStatement
                | ts.AsExpression
                | ts.SpreadElement
                | ts.ExpressionStatement
                | ts.AwaitExpression
                | ts.NewExpression
                | ts.ParenthesizedExpression
                | ts.TypeOfExpression
                | ts.NonNullExpression
                | ts.ThrowStatement
                | ts.ExportAssignment
                | ts.DeleteExpression
                | ts.VoidExpression
                | ts.TypeAssertion;
            handleNode(expression.expression, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.Block
            || node.kind === ts.SyntaxKind.CaseClause
            || node.kind === ts.SyntaxKind.DefaultClause) {
            const statements = (node as ts.Block | ts.CaseClause | ts.DefaultClause).statements;
            for (const statement of statements) {
                handleNode(statement, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.IfStatement) {
            const ifStatement = node as ts.IfStatement;
            handleNode(ifStatement.expression, file, sourceFile);
            handleNode(ifStatement.thenStatement, file, sourceFile);
            handleNode(ifStatement.elseStatement, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.BinaryExpression) {
            const binaryExpression = node as ts.BinaryExpression;
            handleNode(binaryExpression.left, file, sourceFile);
            handleNode(binaryExpression.right, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.VariableStatement) {
            const variableStatement = node as ts.VariableStatement;
            handleNode(variableStatement.declarationList, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.TemplateExpression) {
            const templateExpression = node as ts.TemplateExpression;
            for (const span of templateExpression.templateSpans) {
                handleNode(span, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.ArrayLiteralExpression) {
            const arrayLiteralExpression = node as ts.ArrayLiteralExpression;
            for (const element of arrayLiteralExpression.elements) {
                handleNode(element, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            const objectLiteralExpression = node as ts.ObjectLiteralExpression;
            for (const property of objectLiteralExpression.properties) {
                handleNode(property, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.NamedExports) {
            const namedExports = node as ts.NamedExports;
            for (const element of namedExports.elements) {
                handleNode(element, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.ModuleBlock) {
            const moduleBlock = node as ts.ModuleBlock;
            for (const statement of moduleBlock.statements) {
                handleNode(statement, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.SwitchStatement) {
            const switchStatement = node as ts.SwitchStatement;
            handleNode(switchStatement.expression, file, sourceFile);
            handleNode(switchStatement.caseBlock, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.ConditionalExpression) {
            const conditionalExpression = node as ts.ConditionalExpression;
            handleNode(conditionalExpression.whenTrue, file, sourceFile);
            handleNode(conditionalExpression.whenFalse, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.CaseBlock) {
            const caseBlock = node as ts.CaseBlock;
            for (const clause of caseBlock.clauses) {
                handleNode(clause, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.ForStatement) {
            const forStatement = node as ts.ForStatement;
            handleNode(forStatement.initializer, file, sourceFile);
            handleNode(forStatement.condition, file, sourceFile);
            handleNode(forStatement.incrementor, file, sourceFile);
            handleNode(forStatement.statement, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.TryStatement) {
            const tryStatement = node as ts.TryStatement;
            handleNode(tryStatement.tryBlock, file, sourceFile);
            handleNode(tryStatement.catchClause, file, sourceFile);
            handleNode(tryStatement.finallyBlock, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.VariableDeclarationList) {
            const declarationList = node as ts.VariableDeclarationList;
            for (const declaration of declarationList.declarations) {
                handleNode(declaration, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.CatchClause) {
            const catchClause = node as ts.CatchClause;
            handleNode(catchClause.variableDeclaration, file, sourceFile);
            handleNode(catchClause.block, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.ForInStatement) {
            const forInStatement = node as ts.ForInStatement;
            handleNode(forInStatement.initializer, file, sourceFile);
            handleNode(forInStatement.expression, file, sourceFile);
            handleNode(forInStatement.statement, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.WhileStatement) {
            const whileStatement = node as ts.WhileStatement;
            handleNode(whileStatement.statement, file, sourceFile);
            handleNode(whileStatement.expression, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.ElementAccessExpression) {
            const elementAccessExpression = node as ts.ElementAccessExpression;
            handleNode(elementAccessExpression.expression, file, sourceFile);
            handleNode(elementAccessExpression.argumentExpression, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.FunctionExpression) {
            const functionExpression = node as ts.FunctionExpression;
            handleNode(functionExpression.body, file, sourceFile);
            handleNode(functionExpression.name, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
            const functionDeclaration = node as ts.FunctionDeclaration;
            handleNode(functionDeclaration.body, file, sourceFile);
            for (const parameter of functionDeclaration.parameters) {
                handleNode(parameter, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.Identifier) {
            collectData(node, file, sourceFile);
        } else if (node.kind === ts.SyntaxKind.ObjectBindingPattern) {
            const objectBindingPattern = node as ts.ObjectBindingPattern;
            for (const element of objectBindingPattern.elements) {
                handleNode(element, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.BindingElement) {
            const bindingElement = node as ts.BindingElement;
            collectData(bindingElement.name, file, sourceFile);
            if (bindingElement.initializer) {
                collectData(bindingElement.initializer, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.Parameter) {
            const parameter = node as ts.ParameterDeclaration;
            collectData(parameter.name, file, sourceFile);
            if (parameter.initializer) {
                collectData(parameter.initializer, file, sourceFile);
            }
        } else if (node.kind === ts.SyntaxKind.EndOfFileToken
            || node.kind === ts.SyntaxKind.NumericLiteral
            || node.kind === ts.SyntaxKind.StringLiteral
            || node.kind === ts.SyntaxKind.ImportDeclaration
            || node.kind === ts.SyntaxKind.MethodDeclaration
            || node.kind === ts.SyntaxKind.InterfaceDeclaration
            || node.kind === ts.SyntaxKind.ShorthandPropertyAssignment
            || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral
            || node.kind === ts.SyntaxKind.EnumDeclaration
            || node.kind === ts.SyntaxKind.TypeAliasDeclaration
            || node.kind === ts.SyntaxKind.ImportEqualsDeclaration
            || node.kind === ts.SyntaxKind.ClassDeclaration
            || node.kind === ts.SyntaxKind.NullKeyword
            || node.kind === ts.SyntaxKind.TrueKeyword
            || node.kind === ts.SyntaxKind.FalseKeyword
            || node.kind === ts.SyntaxKind.ThisKeyword
            || node.kind === ts.SyntaxKind.BreakStatement
            || node.kind === ts.SyntaxKind.ContinueStatement
            || node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
            // do nothing
        } else {
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
