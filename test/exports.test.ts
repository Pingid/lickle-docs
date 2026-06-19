import { test, expect } from 'vitest'

import type * as T from '../src/core/reflect/types.ts'
import { scanFixture, byName } from './fixture.ts'

/** All `export` declarations in the scanned module. */
const exportsOf = (idx: ReturnType<typeof scanFixture>): T.Declaration<'export'>[] =>
  [...idx.declarations()].filter((d): d is T.Declaration<'export'> => d.kind === 'export')

test('export default <identifier> points at its target', () => {
  const idx = scanFixture(`
    const value = 42
    export default value
  `)
  const exp = exportsOf(idx).find((e) => e.names.some((n) => n.name === 'default'))
  expect(exp, 'expected a default export').toBeTruthy()
  const entry = exp!.names.find((n) => n.name === 'default')!
  expect(entry.ref).toBe(byName(idx, 'value').id)
})

test('export default function keeps its declaration', () => {
  const idx = scanFixture(`export default function greet() { return 'hi' }`)
  const fn = byName<'function'>(idx, 'greet')
  expect(fn.kind).toBe('function')
  expect(fn.exported).toBe(true)
})

test('export = <identifier> resolves to the target', () => {
  const idx = scanFixture(`
    class Lib { run() {} }
    export = Lib
  `)
  const exp = exportsOf(idx).find((e) => e.names.some((n) => n.name === 'export='))
  expect(exp, 'expected an export= assignment').toBeTruthy()
  expect(exp!.names[0]!.ref).toBe(byName(idx, 'Lib').id)
})
