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

  const { correctCount, totalCount } = await lint(argv.p || argv.project || '.', argv.detail, argv.debug)
  const percent = Math.round(100 * correctCount / totalCount)
  console.log(`${correctCount} / ${totalCount} ${percent}%`)

  const atLeast: number | undefined = argv['at-least']
  if (atLeast && percent < atLeast) {
    throw new Error(`The type coverage rate(${percent}%) is lower than ${atLeast}`)
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
