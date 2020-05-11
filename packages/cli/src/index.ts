import minimist from 'minimist'
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

-p, --project   string?   tell the CLI where is the tsconfig.json
--detail        boolean?  show detail
--at-least      number?   fail if coverage rate < this value
--debug         boolean?  show debug info
--strict        boolean?  strict mode
--ignore-catch  boolean?  ignore catch
--cache         boolean?  enable cache
--ignore-files  string[]? ignore files
-h,--help       boolean?  show help
--is            number?   fail if coverage rate !== this value
--update        boolean?  update "typeCoverage" in package.json to current result
  `)
}

async function executeCommandLine() {
  const argv = minimist(process.argv.slice(2), { '--': true }) as unknown as ParsedArgs

  const showVersion = argv.v || argv.version
  if (showVersion) {
    showToolVersion()
    return
  }

  if (argv.h || argv.help) {
    printHelp()
    process.exit(0)
  }

  suppressError = argv.suppressError

  const { correctCount, totalCount, anys } = await lint(
    argv.p || argv.project || '.',
    {
      debug: argv.debug,
      strict: argv.strict,
      enableCache: argv.cache,
      ignoreCatch: argv['ignore-catch'],
      ignoreFiles: argv['ignore-files']
    }
  )
  const percent = Math.floor(10000 * correctCount / totalCount) / 100

  const { atLeast, is } = await getTarget(argv)
  const atLeastFailed = atLeast && percent < atLeast
  const isFailed = is && percent !== is

  if (argv.detail || atLeastFailed || isFailed) {
    for (const { file, line, character, text } of anys) {
      console.log(`${path.resolve(process.cwd(), file)}:${line + 1}:${character + 1}: ${text}`)
    }
  }
  const percentString = percent.toFixed(2)
  console.log(`${correctCount} / ${totalCount} ${percentString}%`)

  if (argv.update) {
    await saveTarget(+percentString)
  }

  if (atLeastFailed) {
    throw new Error(`The type coverage rate(${percentString}%) is lower than the target(${atLeast}%).`)
  }
  if (isFailed) {
    throw new Error(`The type coverage rate(${percentString}%) is not the target(${is}%).`)
  }
}

interface ParsedArgs {
  v: boolean
  version: boolean
  h: boolean
  help: boolean
  suppressError: boolean
  p: string
  project: string
  debug: boolean
  strict: boolean
  cache: boolean
  detail: boolean
  ['ignore-catch']: boolean
  ['ignore-files']?: string | string[]
  ['at-least']: number
  is: number
  update: boolean
}

async function getTarget(argv: ParsedArgs) {
  let atLeast: number | undefined
  let is: number | undefined
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
        atLeast = currentPackageJson.typeCoverage.atLeast
      } else if (currentPackageJson.typeCoverage.is) {
        is = currentPackageJson.typeCoverage.is
      }
    }
  }
  if (argv['at-least']) {
    atLeast = argv['at-least']
  }
  if (argv.is) {
    is = argv.is
  }
  return { atLeast, is }
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
