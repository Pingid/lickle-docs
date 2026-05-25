import { test } from 'node:test'
import assert from 'node:assert/strict'

import { scanFixture, byName } from './fixture.ts'
import type * as T from '../src/core/reflect/types.ts'

/** All `export` declarations in the scanned module. */
const exportsOf = (idx: ReturnType<typeof scanFixture>): T.Declaration<'export'>[] =>
  [...idx.declarations()].filter((d): d is T.Declaration<'export'> => d.kind === 'export')

test('export default <identifier> points at its target', () => {
  const idx = scanFixture(`
    const value = 42
    export default value
  `)
  const exp = exportsOf(idx).find((e) => e.names.some((n) => n.name === 'default'))
  assert.ok(exp, 'expected a default export')
  const entry = exp!.names.find((n) => n.name === 'default')!
  assert.equal(entry.ref, byName(idx, 'value').id)
})

test('export default function keeps its declaration', () => {
  const idx = scanFixture(`export default function greet() { return 'hi' }`)
  const fn = byName<'function'>(idx, 'greet')
  assert.equal(fn.kind, 'function')
  assert.equal(fn.exported, true)
})

test('export = <identifier> resolves to the target', () => {
  const idx = scanFixture(`
    class Lib { run() {} }
    export = Lib
  `)
  const exp = exportsOf(idx).find((e) => e.names.some((n) => n.name === 'export='))
  assert.ok(exp, 'expected an export= assignment')
  assert.equal(exp!.names[0]!.ref, byName(idx, 'Lib').id)
})
