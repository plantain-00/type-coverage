// Regression test for https://github.com/plantain-00/type-coverage/issues/154
// `type-coverage --strict` overflowed the stack on types that name themselves
// as a type argument (e.g. `_Selector<Selector>`), because
// typeIsAnyOrInTypeArguments recursed into typeArguments with no visited set.
//
// Run after building the core package (tsc -p packages/core/src):
//   node --test packages/core/test/self-referential-type.test.mjs
import assert from 'node:assert'
import * as path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { lint } from '../dist/index.js'

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'self-referential')

test('strict mode does not overflow the stack on a self-referential type', async () => {
  const result = await lint(fixture, { strict: true })
  assert.equal(result.totalCount > 0, true)
  assert.equal(result.correctCount, result.totalCount)
})
