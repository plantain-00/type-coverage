import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { test } from 'node:test'

import { lint } from '../dist/index.js'
import { getProjectRootNamesAndCompilerOptions } from '../dist/tsconfig.js'

test('custom excludes do not traverse self-linked node_modules packages', async (t) => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'type-coverage-symlink-'))
  t.after(() => fs.rm(fixture, { recursive: true, force: true }))
  await fs.mkdir(path.join(fixture, 'node_modules'))
  await fs.mkdir(path.join(fixture, 'src'))
  await fs.writeFile(path.join(fixture, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {},
    exclude: ['lib'],
  }))
  await fs.writeFile(path.join(fixture, 'src/index.ts'), 'export const value = 1\n')
  await fs.symlink(fixture, path.join(fixture, 'node_modules', 'self-linked-package-'.repeat(10)), 'junction')

  const { rootNames } = await getProjectRootNamesAndCompilerOptions(fixture)
  assert.deepEqual(rootNames, [path.join(fixture, 'src/index.ts')])
})

test('still follows links to project source directories', async (t) => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'type-coverage-source-link-'))
  t.after(() => fs.rm(fixture, { recursive: true, force: true }))
  await fs.mkdir(path.join(fixture, 'shared'))
  await fs.writeFile(path.join(fixture, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {},
    include: ['src/**/*.ts'],
    exclude: ['lib'],
  }))
  await fs.writeFile(path.join(fixture, 'shared/index.ts'), 'export const value = 1\n')
  await fs.symlink(path.join(fixture, 'shared'), path.join(fixture, 'src'), 'junction')

  const { rootNames } = await getProjectRootNamesAndCompilerOptions(fixture)
  assert.deepEqual(rootNames, [path.join(fixture, 'src/index.ts')])
})


test('retains explicitly included dependency declarations for type inference', async (t) => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'type-coverage-declarations-'))
  t.after(() => fs.rm(fixture, { recursive: true, force: true }))
  await fs.mkdir(path.join(fixture, 'node_modules/custom'), { recursive: true })
  await fs.mkdir(path.join(fixture, 'src'))
  await fs.writeFile(path.join(fixture, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { types: [], strict: true },
    include: ['src/**/*.ts', 'node_modules/custom/globals.d.ts'],
  }))
  await fs.writeFile(path.join(fixture, 'node_modules/custom/globals.d.ts'), 'declare const shared: any;\n')
  await fs.writeFile(path.join(fixture, 'src/index.ts'), 'export const result = shared.value;\n')

  const { rootNames } = await getProjectRootNamesAndCompilerOptions(fixture)
  assert.ok(rootNames.includes(path.join(fixture, 'node_modules/custom/globals.d.ts')))
  const result = await lint(fixture, { notOnlyInCWD: true })
  assert.equal(result.correctCount, 0)
  assert.equal(result.totalCount, 3)
})

for (const allowJs of [false, true]) {
  test(`follows tsconfig allowJs=${allowJs} when discovering source files`, async (t) => {
    const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'type-coverage-javascript-'))
    t.after(() => fs.rm(fixture, { recursive: true, force: true }))
    await fs.mkdir(path.join(fixture, 'src'))
    await fs.writeFile(path.join(fixture, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { allowJs },
      include: ['src/**/*'],
    }))
    await fs.writeFile(path.join(fixture, 'src/index.ts'), 'export const typed = 1\n')
    await fs.writeFile(path.join(fixture, 'src/helper.js'), 'export const value = 1\n')

    const { rootNames, compilerOptions } = await getProjectRootNamesAndCompilerOptions(fixture)
    assert.ok(rootNames.includes(path.join(fixture, 'src/index.ts')))
    assert.equal(rootNames.includes(path.join(fixture, 'src/helper.js')), allowJs)
    assert.equal(compilerOptions.allowJs, allowJs)
  })
}
