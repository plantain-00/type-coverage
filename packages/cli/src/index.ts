import minimist from 'minimist'
import * as fs from 'fs'
import * as util from 'util'
import * as path from 'path'

import * as packageJson from '../package.json'
import { lint } from 'type-coverage-core'

let suppressError = false
const existsAsync = util.promisify(fs.exists)
const readFileAsync = util.promisify(fs.readFile)

function showToolVersion() {
  console.log(`Version: ${packageJson.version}`)
}

// tslint:disable-next-line:cognitive-complexity no-big-function
async function executeCommandLine() {
  const argv = minimist(process.argv.slice(2), { '--': true }) as unknown as ParsedArgs

  const showVersion = argv.v || argv.version
  if (showVersion) {
    showToolVersion()
    return
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
  const atLeast = await getAtLeast(argv)
  const failed = atLeast && percent < atLeast
  if (argv.detail || failed) {
    for (const { file, line, character, text } of anys) {
      console.log(`${path.resolve(process.cwd(), file)}:${line + 1}:${character + 1}: ${text}`)
    }
  }
  console.log(`${correctCount} / ${totalCount} ${percent.toFixed(2)}%`)
  if (failed) {
    throw new Error(`The type coverage rate(${percent.toFixed(2)}%) is lower than the target(${atLeast}%).`)
  }
}

interface ParsedArgs {
  v: boolean
  version: boolean
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
}

async function getAtLeast(argv: ParsedArgs) {
  let atLeast: number | undefined
  const packageJsonPath = path.resolve(process.cwd(), 'package.json')
  if (await existsAsync(packageJsonPath)) {
    const currentPackageJson: {
      typeCoverage?: {
        atLeast?: number
      }
    } = JSON.parse((await readFileAsync(packageJsonPath)).toString())
    if (currentPackageJson.typeCoverage && currentPackageJson.typeCoverage.atLeast) {
      atLeast = currentPackageJson.typeCoverage.atLeast
    }
  }
  if (argv['at-least']) {
    atLeast = argv['at-least']
  }
  return atLeast
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
