// Regression test for https://github.com/plantain-00/type-coverage/issues/144
// `${configDir}` (TypeScript 5.5) inside compilerOptions of an extended tsconfig
// (e.g. "paths": { "@/*": ["${configDir}/src/*"] }) was not substituted, so
// imports resolved through those paths failed and inferred types became any.
//
// Run after building the core package (tsc -p packages/core/src):
//   node --test packages/core/test/config-dir.test.mjs
import assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { test } from 'node:test'

import { lint } from '../dist/index.js'
import { getProjectRootNamesAndCompilerOptions } from '../dist/tsconfig.js'

test('${configDir} in compilerOptions of an extended tsconfig is substituted', async (t) => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'type-coverage-config-dir-'))
  t.after(() => fs.rm(fixture, { recursive: true, force: true }))
  await fs.mkdir(path.join(fixture, 'shared'))
  await fs.mkdir(path.join(fixture, 'src'))
  await fs.writeFile(path.join(fixture, 'shared/tsconfig.base.json'), JSON.stringify({
    compilerOptions: {
      strict: true, noEmit: true, target: 'es2022', module: 'commonjs', moduleResolution: 'node',
      rootDir: '${configDir}src',
      paths: {
        '@/*': ['${configDir}/src/*'],
        'literal/*': ['src/${configDir}/*'],
        'repeat/*': ['${configDir}/src/${configDir}/*'],
      },
    },
  }))
  await fs.writeFile(path.join(fixture, 'tsconfig.json'), JSON.stringify({ extends: './shared/tsconfig.base.json', include: ['src'] }))
  await fs.writeFile(path.join(fixture, 'src/types.ts'), "export const POSSIBLE_TYPES = ['audio', 'video'] as const\nexport type PossibleType = typeof POSSIBLE_TYPES[number]\n")
  await fs.writeFile(path.join(fixture, 'src/index.ts'), "import { POSSIBLE_TYPES } from '@/types'\nexport function getType(type: string) { return POSSIBLE_TYPES.find((t) => t === type) }\n")

  const result = await lint(fixture, { notOnlyInCWD: true })
  assert.equal(result.totalCount > 0, true)
  assert.equal(result.correctCount, result.totalCount)

  const { compilerOptions } = await getProjectRootNamesAndCompilerOptions(fixture)
  assert.equal(compilerOptions.rootDir, path.join(fixture, 'src'))
  assert.deepEqual(compilerOptions.paths['literal/*'], ['src/${configDir}/*'])
  assert.deepEqual(compilerOptions.paths['repeat/*'], [path.join(fixture, 'src/${configDir}/*')])
})
