// Regression test for https://github.com/plantain-00/type-coverage/issues/158
// `type-coverage -p <relative path>` measured nothing and exited 0 when the
// project directory was not the cwd: the config dir derived from -p stayed
// relative, so the globbed files did not match the program's sources.
//
// Run after building the core package (tsc -p packages/core/src):
//   node --test packages/core/test/relative-project-path.test.mjs
import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { test } from 'node:test'
import process from 'node:process'

import { lint } from '../dist/index.js'

test('a relative -p resolves against the project dir, not the cwd', async (t) => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'type-coverage-relative-p-'))
  t.after(() => fs.rm(parent, { recursive: true, force: true }))
  const projectDirName = 'proj'
  await fs.mkdir(path.join(parent, projectDirName, 'src'), { recursive: true })
  await fs.writeFile(path.join(parent, projectDirName, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { strict: true, noEmit: true, target: 'es2022', module: 'commonjs' },
    include: ['src'],
  }))
  await fs.writeFile(path.join(parent, projectDirName, 'src/a.ts'), 'export const n: number = 1\n')

  const originalCwd = process.cwd()
  process.chdir(parent)
  try {
    // Relative project path, with the project NOT the cwd — before the fix this
    // measured 0 / 0 and "succeeded".
    const result = await lint(path.join(projectDirName, 'tsconfig.json'), { notOnlyInCWD: true })
    assert.equal(result.totalCount > 0, true)
    assert.equal(result.correctCount, result.totalCount)

    // An absolute project path, which already worked, still does.
    const absolute = await lint(path.join(parent, projectDirName, 'tsconfig.json'), { notOnlyInCWD: true })
    assert.equal(absolute.totalCount, result.totalCount)
  } finally {
    process.chdir(originalCwd)
  }
})
