import minimist from 'minimist'
import * as packageJson from '../package.json'
import { lint } from './core'

let suppressError = false

function showToolVersion() {
  console.log(`Version: ${packageJson.version}`)
}

// tslint:disable-next-line:cognitive-complexity no-big-function
async function executeCommandLine() {
  const argv = minimist(process.argv.slice(2), { '--': true })

  const showVersion: boolean = argv.v || argv.version
  if (showVersion) {
    showToolVersion()
    return
  }

  suppressError = argv.suppressError

  const { correctCount, totalCount, anys } = await lint(argv.p || argv.project || '.', argv.detail, argv.debug)
  for (const { file, line, character, text } of anys) {
    console.log(`${file}:${line + 1}:${character + 1}: ${text}`)
  }
  const percent = Math.round(10000 * correctCount / totalCount) / 100
  console.log(`${correctCount} / ${totalCount} ${percent.toFixed(2)}%`)

  let atLeast: number | undefined
  if (packageJson.typeCoverage && packageJson.typeCoverage.atLeast) {
    atLeast = packageJson.typeCoverage.atLeast
  }
  if (argv['at-least']) {
    atLeast = argv['at-least']
  }
  if (atLeast && percent < atLeast) {
    throw new Error(`The type coverage rate(${percent.toFixed(2)}%) is lower than the target(${atLeast}%). \nYou can add '--detail' or use VSCode plugin to show detailed informations.`)
  }
}

executeCommandLine().then(() => {
  console.log('type-coverage success.')
}, error => {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log(error)
  }
  if (!suppressError) {
    process.exit(1)
  }
})
