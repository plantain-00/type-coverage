import minimist = require('minimist')
import * as fs from 'fs'
import * as util from 'util'
import * as path from 'path'

import * as packageJson from '../package.json'
import { lint } from 'type-coverage-core'

let suppressError = false
let jsonOutput = false

interface LintResult {
  character: number
  filePath: string
  line: number
  text: string
}

interface Output {
  atLeastFailed?: boolean
  isFailed?: boolean | 0
  succeeded: boolean
  correctCount?: number
  totalCount?: number
  percent?: number
  percentString?: string
  atLeast?: boolean | number 
  is?: number
  details?: LintResult[]
  error?: string | unknown
}

const output: Output = {
  succeeded: false,
}

const existsAsync = util.promisify(fs.exists)
const readFileAsync = util.promisify(fs.readFile)
const writeFileAsync = util.promisify(fs.writeFile)

function showToolVersion() {
  console.log(`Version: ${packageJson.version}`)
}

function printHelp() {
  console.log(`type-coverage [options] [-- file1.ts file2.ts ...]

-p, --project               string?   tell the CLI where is the tsconfig.json
--detail                    boolean?  show detail
--at-least                  number?   fail if coverage rate < this value
--debug                     boolean?  show debug info
--strict                    boolean?  strict mode
--ignore-catch              boolean?  ignore catch
--cache                     boolean?  enable cache
--ignore-files              string[]? ignore files
--ignore-unread             boolean?  allow writes to variables with implicit any types
-h,--help                   boolean?  show help
--is                        number?   fail if coverage rate !== this value
--update                    boolean?  update "typeCoverage" in package.json to current result
--update-if-higher          boolean?  update "typeCoverage" in package.json to current result if new type coverage is higher
--ignore-nested             boolean?  ignore any in type arguments, eg: Promise<any>
--ignore-as-assertion       boolean?  ignore as assertion, eg: foo as string
--ignore-type-assertion     boolean?  ignore type assertion, eg: <string>foo
--ignore-non-null-assertion boolean?  ignore non-null assertion, eg: foo!
--ignore-object             boolean?  Object type not counted as any, eg: foo: Object
--ignore-empty-type         boolean?  empty type not counted as any, eg: foo: {}
--show-relative-path        boolean?  show relative path in detail message
--history-file              string?   file name where history is saved
--no-detail-when-failed     boolean?  not show detail message when the CLI failed
--report-semantic-error     boolean?  report typescript semantic error
-- file1.ts file2.ts ...    string[]? only checks these files, useful for usage with tools like lint-staged
--cache-directory           string?   set cache directory
--not-only-in-cwd           boolean?  include results outside current working directory
--json-output               boolean?  output results as JSON
  `)
}

interface BaseArgs {
  suppressError: boolean
  project: string
  debug: boolean
  strict: boolean
  ignoreUnreadAnys: boolean;
  cache: boolean
  detail: boolean
  is: number
  update: boolean
}
interface CliArgs extends BaseArgs {
  '--': string[]
  p: string
  v: boolean
  version: boolean
  h: boolean
  help: boolean
  ['ignore-catch']: boolean
  ['ignore-files']?: string | string[]
  ['at-least']: number
  ['ignore-unread']: boolean
  ['show-relative-path']: boolean

  ['ignore-nested']: boolean
  ['ignore-as-assertion']: boolean
  ['ignore-type-assertion']: boolean
  ['ignore-non-null-assertion']: boolean
  ['ignore-object']: boolean
  ['ignore-empty-type']: boolean

  ['history-file']: string
  ['no-detail-when-failed']: boolean
  ['update-if-higher']: boolean

  ['report-semantic-error']: boolean
  ['cache-directory']: string
  ['not-only-in-cwd']: boolean
  ['json-output']: boolean
}

interface PkgArgs extends BaseArgs {
  ignoreCatch: boolean
  ignoreFiles?: string | string[]
  ignoreUnread: boolean
  atLeast: boolean
  showRelativePath: boolean

  ignoreNested: boolean
  ignoreAsAssertion: boolean
  ignoreTypeAssertion: boolean
  ignoreNonNullAssertion: boolean
  ignoreObject: boolean
  ignoreEmptyType: boolean

  historyFile: string
  noDetailWhenFailed: boolean
  updateIfHigher: boolean
  reportSemanticError: boolean
  cacheDirectory: string
  notOnlyInCWD: boolean
  jsonOutput: boolean
}

interface PackageJson {
  typeCoverage?: PkgArgs
}

type AllArgs = PkgArgs & CliArgs

async function executeCommandLine() {
  const argv = minimist(process.argv.slice(2), { '--': true }) as unknown as CliArgs

  const showVersion = argv.v || argv.version
  if (showVersion) {
    showToolVersion()
    return
  }

  if (argv.h || argv.help) {
    printHelp()
    process.exit(0)
  }

  const {
    atLeast,
    debug,
    detail,
    enableCache,
    ignoreCatch,
    ignoreFiles,
    ignoreUnread,
    is,
    project,
    strict,
    update,
    updateIfHigher,
    ignoreNested,
    ignoreAsAssertion,
    ignoreTypeAssertion,
    ignoreNonNullAssertion,
    ignoreObject,
    ignoreEmptyType,
    showRelativePath,
    historyFile,
    noDetailWhenFailed,
    reportSemanticError,
    cacheDirectory,
    notOnlyInCWD,
  } = await getTarget(argv);

  const { correctCount, totalCount, anys } = await lint(project, {
      debug,
      strict,
      enableCache,
      ignoreCatch,
      ignoreFiles,
      ignoreUnreadAnys: ignoreUnread,
      ignoreNested,
      ignoreAsAssertion,
      ignoreTypeAssertion,
      ignoreNonNullAssertion,
      ignoreObject,
      ignoreEmptyType,
      reportSemanticError,
      cacheDirectory,
      notOnlyInCWD,
      files: argv['--'].length > 0 ? argv['--'] : undefined,
  });

  const percent = Math.floor(10000 * correctCount / totalCount) / 100
  const atLeastFailed = typeof atLeast === 'number' && percent < atLeast
  const isFailed = is && percent !== is

  if (detail || (!noDetailWhenFailed && (atLeastFailed || isFailed))) {
    output.details = []
    for (const { file, line, character, text } of anys) {
      const filePath = showRelativePath ? file : path.resolve(process.cwd(), file)
      output.details.push({
        character,
        filePath,
        line,
        text
      })
    }
  }
  const percentString = percent.toFixed(2)

  output.atLeast = atLeast
  output.atLeastFailed = atLeastFailed
  output.correctCount = correctCount
  output.is = is
  output.isFailed = isFailed
  output.percent = percent
  output.percentString = percentString
  output.totalCount = totalCount

  if (update) {
    await saveTarget(+percentString)
  } else if (updateIfHigher) {
    await saveTarget(+percentString, true)
  }
  if (historyFile) {
    await saveHistory(+percentString, historyFile)
  }

  if (atLeastFailed) {
    throw new Error(`The type coverage rate(${percentString}%) is lower than the target(${atLeast}%).`)
  }
  if (isFailed) {
    throw new Error(`The type coverage rate(${percentString}%) is not the target(${is}%).`)
  }
}


async function getTarget(argv: CliArgs) {

    let pkgCfg:PkgArgs | undefined;
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    if (await existsAsync(packageJsonPath)) {
        const currentPackageJson = JSON.parse((await readFileAsync(packageJsonPath)).toString()) as PackageJson;
        const typeCoverage = currentPackageJson.typeCoverage
        if (typeCoverage) {
            pkgCfg = typeCoverage
        }
    }

    const isCliArg = (key:keyof AllArgs):key is keyof CliArgs => key in argv
    const isPkgArg = (key:keyof AllArgs):key is keyof PkgArgs => pkgCfg ? key in pkgCfg : false

    function getArgOrCfgVal<K extends keyof AllArgs>(keys:K[]) {
        for (const key of keys) {
            if (isCliArg(key)) {
                return argv[key]
            }
            if (pkgCfg && isPkgArg(key)) {
                return pkgCfg[key]
            }
        }
        return undefined
    }

    suppressError = getArgOrCfgVal(['suppressError']) || false
    jsonOutput = getArgOrCfgVal(['json-output', 'jsonOutput']) || false

    const atLeast = getArgOrCfgVal(['at-least', 'atLeast'])
    const debug = getArgOrCfgVal(['debug'])
    const detail = getArgOrCfgVal(['detail'])
    const enableCache = getArgOrCfgVal(['cache'])
    const ignoreCatch = getArgOrCfgVal(['ignore-catch', 'ignoreCatch'])
    const ignoreFiles = getArgOrCfgVal(['ignore-files', 'ignoreFiles'])
    const ignoreUnread = getArgOrCfgVal(['ignore-unread', 'ignoreUnread'])
    const is = getArgOrCfgVal(['is'])
    const project = getArgOrCfgVal(['p', 'project']) || '.'
    const strict = getArgOrCfgVal(['strict'])
    const update = getArgOrCfgVal(['update'])
    const updateIfHigher = getArgOrCfgVal(['update-if-higher', 'updateIfHigher'])
    const ignoreNested = getArgOrCfgVal(['ignore-nested', 'ignoreNested'])
    const ignoreAsAssertion = getArgOrCfgVal(['ignore-as-assertion', 'ignoreAsAssertion'])
    const ignoreTypeAssertion = getArgOrCfgVal(['ignore-type-assertion', 'ignoreTypeAssertion'])
    const ignoreNonNullAssertion = getArgOrCfgVal(['ignore-non-null-assertion', 'ignoreNonNullAssertion'])
    const ignoreObject = getArgOrCfgVal(['ignore-object', 'ignoreObject'])
    const ignoreEmptyType = getArgOrCfgVal(['ignore-empty-type', 'ignoreEmptyType'])
    const showRelativePath = getArgOrCfgVal(['show-relative-path', 'showRelativePath'])
    const historyFile = getArgOrCfgVal(['history-file', 'historyFile'])
    const noDetailWhenFailed = getArgOrCfgVal(['no-detail-when-failed', 'noDetailWhenFailed'])
    const reportSemanticError = getArgOrCfgVal(['report-semantic-error', 'reportSemanticError'])
    const cacheDirectory = getArgOrCfgVal(['cache-directory', 'cacheDirectory'])
    const notOnlyInCWD = getArgOrCfgVal(['not-only-in-cwd', 'notOnlyInCWD'])

    return {
      atLeast,
      debug,
      detail,
      enableCache,
      ignoreCatch,
      ignoreFiles,
      ignoreUnread,
      is,
      project,
      strict,
      update,
      updateIfHigher,
      ignoreNested,
      ignoreAsAssertion,
      ignoreTypeAssertion,
      ignoreNonNullAssertion,
      ignoreObject,
      ignoreEmptyType,
      showRelativePath,
      historyFile,
      noDetailWhenFailed,
      reportSemanticError,
      cacheDirectory,
      notOnlyInCWD,
    };
}

async function saveTarget(target: number, ifHigher?: boolean) {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json')
  if (await existsAsync(packageJsonPath)) {
    const currentPackageJson: {
      typeCoverage?: {
        atLeast?: number
        is?: number
      }
    } = JSON.parse((await readFileAsync(packageJsonPath)).toString())
    if (currentPackageJson.typeCoverage) {
      if (currentPackageJson.typeCoverage.atLeast != null) {
        if (!ifHigher || target > currentPackageJson.typeCoverage.atLeast) {
          currentPackageJson.typeCoverage.atLeast = target
        }
      } else if (currentPackageJson.typeCoverage.is != null) {
        if (!ifHigher || target > currentPackageJson.typeCoverage.is) {
          currentPackageJson.typeCoverage.is = target
        }
      }
      await writeFileAsync(packageJsonPath, JSON.stringify(currentPackageJson, null, 2) + '\n')
    }
  }
}

async function saveHistory(percentage: number, historyFile?:string) {
  if (historyFile) {
    const historyFilePath = path.resolve(process.cwd(), historyFile);
    if (await existsAsync(historyFilePath)) {
      const date = new Date().toISOString()
      const historyFile: Record<string, number> = JSON.parse((await readFileAsync(historyFilePath)).toString());
      historyFile[date] = percentage
      await writeFileAsync(historyFilePath, JSON.stringify(historyFile, null, 2) + '\n');
    } else {
      const date = new Date().toISOString()
      const historyFile: Record<string, number> = {}
      historyFile[date] = percentage
      await writeFileAsync(historyFilePath, JSON.stringify(historyFile, null, 2) + '\n');
    }
  } 
}

function printOutput(output: Output, asJson: boolean) {
  if(asJson) {
    console.log(JSON.stringify(output, null, 2))
    return
  }

  const {details, correctCount, error, totalCount, percentString, succeeded} = output

  for(const detail of details || []) {
    const { filePath, line, character, text } = detail
    console.log(`${filePath}:${line + 1}:${character + 1}: ${text}`)
  }
  
  if(percentString) {
    console.log(`${correctCount} / ${totalCount} ${percentString}%`)
  }

  if(succeeded) {
    console.log('type-coverage success.')
  } else {
    console.log(error)
  }

}

executeCommandLine().then(() => {
  output.succeeded = true;
  printOutput(output, jsonOutput)
}, (error: Error | string) => {
  output.succeeded = false;
  if (error instanceof Error) {
    output.error = error.message
  } else {
    output.error = error
  }

  printOutput(output, jsonOutput)

  if (!suppressError) {
    process.exit(1)
  }
})
