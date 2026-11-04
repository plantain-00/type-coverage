// Regression test for the follow-up to https://github.com/plantain-00/type-coverage/issues/158
// When the resolved program matches no files, type-coverage used to print
// `0 / 0` and exit 0, silently disabling a CI coverage gate. The CLI now fails
// loudly (non-zero exit + explanatory message) in that case.
//
// Run after building the CLI (the normal `build` step produces
// packages/cli/dist/index.js):
//   node --test packages/core/test/zero-files.test.mjs
import assert from 'node:assert'
import { execFile } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const cli = path.resolve(import.meta.dirname, '../../cli/dist/index.js')

async function makeProject() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'type-coverage-zero-files-'))
  await fs.mkdir(path.join(dir, 'src'), { recursive: true })
  await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0' }))
  await fs.writeFile(path.join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, target: 'es2022', module: 'commonjs' },
    include: ['src'],
  }))
  await fs.writeFile(path.join(dir, 'src/a.ts'), 'export const n: number = 1\n')
  return dir
}

test('fails loudly when no files are measured', async (t) => {
  const dir = await makeProject()
  t.after(() => fs.rm(dir, { recursive: true, force: true }))

  // --ignore-files excludes every source file, so the program measures nothing.
  await assert.rejects(
    () => execFileAsync(process.execPath, [cli, '-p', 'tsconfig.json', '--ignore-files', '**/*.ts'], { cwd: dir }),
    (err) => {
      assert.notEqual(err.code, 0)
      const out = `${err.stdout || ''}${err.stderr || ''}`
      assert.match(out, /No files were measured/)
      return true
    },
  )
})

test('still succeeds when files are measured', async (t) => {
  const dir = await makeProject()
  t.after(() => fs.rm(dir, { recursive: true, force: true }))

  const { stdout } = await execFileAsync(process.execPath, [cli, '-p', 'tsconfig.json'], { cwd: dir })
  assert.match(stdout, /type-coverage success\./)
})
