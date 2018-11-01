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
  const percent = Math.round(100 * correctCount / totalCount)
  console.log(`${correctCount} / ${totalCount} ${percent}%`)

  const atLeast: number | undefined = argv['at-least']
  if (atLeast && percent < atLeast) {
    throw new Error(`The type coverage rate(${percent}%) is lower than the target(${atLeast}%). \nYou can add '--detail' to show more informations.`)
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
