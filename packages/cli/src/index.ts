import minimist = require('minimist')
import * as fs from 'fs'
import * as util from 'util'
import * as path from 'path'

import * as packageJson from '../package.json'
import { lint } from 'type-coverage-core'

let suppressError = false
const existsAsync = util.promisify(fs.exists)
const readFileAsync = util.promisify(fs.readFile)
const writeFileAsync = util.promisify(fs.writeFile)

function showToolVersion() {
  console.log(`Version: ${packageJson.version}`)
}

function printHelp() {
  console.log(`type-coverage [options]

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
--ignore-nested             boolean?  ignore any in type arguments, eg: Promise<any>
--ignore-as-assertion       boolean?  ignore as assertion, eg: foo as string
--ignore-type-assertion     boolean?  ignore type assertion, eg: <string>foo
--ignore-non-null-assertion boolean?  ignore non-null assertion, eg: foo!
--show-relative-path        boolean?  show relative path in detail message
--history-file              string?   file name where history is saved
--no-detail-when-failed     boolean?  not show detail message when the CLI failed
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

  ['history-file']: string
  ['no-detail-when-failed']: boolean
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

  historyFile: string
  noDetailWhenFailed: boolean
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
    ignoreNested,
    ignoreAsAssertion,
    ignoreTypeAssertion,
    ignoreNonNullAssertion,
    showRelativePath,
    historyFile,
    noDetailWhenFailed,
  } = await getTarget(argv);

  const { correctCount, totalCount, anys } = await lint(project, {
      debug,
      strict,
      enableCache,
      ignoreCatch,
      ignoreFiles,
      ignoreUnreadAnys: ignoreUnread,
      ignoreNested,
      ignoreAsAssertion: ignoreAsAssertion,
      ignoreTypeAssertion,
      ignoreNonNullAssertion,
  });

  const percent = Math.floor(10000 * correctCount / totalCount) / 100
  const atLeastFailed = atLeast && percent < atLeast
  const isFailed = is && percent !== is

  if (detail || (!noDetailWhenFailed && (atLeastFailed || isFailed))) {
    for (const { file, line, character, text } of anys) {
      const filePath = showRelativePath ? file : path.resolve(process.cwd(), file)
      console.log(`${filePath}:${line + 1}:${character + 1}: ${text}`)
    }
  }
  const percentString = percent.toFixed(2)
  console.log(`${correctCount} / ${totalCount} ${percentString}%`)

  if (update) {
    await saveTarget(+percentString)
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
    const ignoreNested = getArgOrCfgVal(['ignore-nested', 'ignoreNested'])
    const ignoreAsAssertion = getArgOrCfgVal(['ignore-as-assertion', 'ignoreAsAssertion'])
    const ignoreTypeAssertion = getArgOrCfgVal(['ignore-type-assertion', 'ignoreTypeAssertion'])
    const ignoreNonNullAssertion = getArgOrCfgVal(['ignore-non-null-assertion', 'ignoreNonNullAssertion'])
    const showRelativePath = getArgOrCfgVal(['show-relative-path', 'showRelativePath'])
    const historyFile = getArgOrCfgVal(['history-file', 'historyFile'])
    const noDetailWhenFailed = getArgOrCfgVal(['no-detail-when-failed', 'noDetailWhenFailed'])

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
      ignoreNested,
      ignoreAsAssertion,
      ignoreTypeAssertion,
      ignoreNonNullAssertion,
      showRelativePath,
      historyFile,
      noDetailWhenFailed,
    };
}

async function saveTarget(target: number) {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json')
  if (await existsAsync(packageJsonPath)) {
    const currentPackageJson: {
      typeCoverage?: {
        atLeast?: number
        is?: number
      }
    } = JSON.parse((await readFileAsync(packageJsonPath)).toString())
    if (currentPackageJson.typeCoverage) {
      if (currentPackageJson.typeCoverage.atLeast) {
        currentPackageJson.typeCoverage.atLeast = target
      } else if (currentPackageJson.typeCoverage.is) {
        currentPackageJson.typeCoverage.is = target
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
      const historyFile = JSON.parse((await readFileAsync(historyFilePath)).toString());
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

executeCommandLine().then(() => {
  console.log('type-coverage success.')
}, (error: Error | string) => {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log(error)
  }
  if (!suppressError) {
    process.exit(1)
  }
})
