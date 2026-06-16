import { expect, it } from 'vitest'

import { multiScanFixture, byName } from './fixture.ts'

// Two entrypoints share one module: `a` star-exports it directly (depth 1),
// `b` re-exports it as a namespace (depth 2).
const FILES = {
  'shared.ts': `export interface Foo { a: number }\nexport const bar = (x: number): number => x\n`,
  'a.ts': `export * from './shared'\n`,
  'b.ts': `export * as Stuff from './shared'\n`,
}
const ENTRIES = [
  { as: './a', file: 'a.ts' },
  { as: './b', file: 'b.ts' },
]

it('a declaration re-exported through several entrypoints is exposed by each', () => {
  const idx = multiScanFixture(FILES, ENTRIES)
  const foo = byName(idx, 'Foo').id
  expect(idx.isExposed(foo)).toBe(true)
  // exposed both flat (under `a`) and as a namespace member (under `b` → Stuff).
  expect(idx.exposedBy(foo).length).toBeGreaterThanOrEqual(2)
})

const MIXED = `export interface I { a: number }\nexport type T = number\nexport const v = 1\nexport const f = (x: number): number => x\n`

it('export type * exposes types but not value declarations', () => {
  const idx = multiScanFixture({ 'm.ts': MIXED, 'g.ts': `export type * from './m'\n` }, [{ as: './g', file: 'g.ts' }])
  expect(idx.isExposed(byName(idx, 'I').id)).toBe(true)
  expect(idx.isExposed(byName(idx, 'T').id)).toBe(true)
  expect(idx.isExposed(byName(idx, 'v').id)).toBe(false)
  expect(idx.isExposed(byName(idx, 'f').id)).toBe(false)
})

it('type-only constraint carries into namespace members transitively', () => {
  const idx = multiScanFixture({ 'm.ts': MIXED, 'h.ts': `export type * as Types from './m'\n` }, [
    { as: './h', file: 'h.ts' },
  ])
  expect(idx.isExposed(byName(idx, 'f').id)).toBe(false)
  expect(idx.isExposed(byName(idx, 'T').id)).toBe(true)
})

it('a value export of the same module subsumes an earlier type-only one', () => {
  const idx = multiScanFixture(
    { 'm.ts': MIXED, 'i.ts': `export type * as T1 from './m'\nexport * as V1 from './m'\n` },
    [{ as: './i', file: 'i.ts' }],
  )
  expect(idx.isExposed(byName(idx, 'f').id)).toBe(true)
  expect(idx.isExposed(byName(idx, 'v').id)).toBe(true)

  // the module records once, under the first-seen alias
  const [root] = [...idx.roots()]
  const edges = idx.exposes(root!.id)
  expect(edges).toHaveLength(1)
  expect(edges[0]!.alias).toBe('T1')
})
