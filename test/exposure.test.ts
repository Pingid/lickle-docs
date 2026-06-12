import { expect, it } from 'vitest'

import type { Route } from '../src/core/route/index.ts'

import { multiRoutesFixture, byName, memberTitles, memberAliases } from './fixture.ts'

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

type Fixture = ReturnType<typeof multiRoutesFixture>
const routeOf = (fx: Fixture, name: string): Extract<Route, { kind: 'doc' }> => {
  const decl = byName(fx.index, name)
  const route = fx.routes.find((r) => r.kind === 'doc' && r.decl === decl.id)
  if (!route) throw new Error(`no route for "${name}"`)
  return route as Extract<Route, { kind: 'doc' }>
}

/** Slugs (unprefixed) of the routes whose sidebar lists `id` as a child edge. */
const listedBy = (fx: Fixture, id: number): string[] =>
  fx.routes.filter((r) => r.sidebar?.children?.some((e) => e.target === id)).map((r) => r.slug)

it('multi-exposed declarations get bare slugs and appear in every exposer sidebar', () => {
  const fx = multiRoutesFixture(FILES, ENTRIES)
  const foo = routeOf(fx, 'Foo')
  // exposed by both `a` (flat) and the shared module (under b) — no single home
  expect(foo.slug).toBe('Foo')
  // chains spell it differently ('Foo' vs 'Stuff.Foo') — bare name wins
  expect(foo.title).toBe('Foo')
  expect(new Set(listedBy(fx, foo.decl))).toEqual(new Set(['a', 'b/Stuff']))
})

it('single-exposer slugs compose recursively under the exposing module', () => {
  const fx = multiRoutesFixture(
    {
      'leaf.ts': `export const x = 1\n`,
      'mid.ts': `export * as B from './leaf'\n`,
      'c.ts': `export * as A from './mid'\n`,
    },
    [{ as: './c', file: 'c.ts' }],
  )
  expect(routeOf(fx, 'x').slug).toBe('c/A/B/x')
  expect(routeOf(fx, 'x').title).toBe('A.B.x')
})

it('titles keep the qualified chain when every exposer spells it the same', () => {
  const fx = multiRoutesFixture(
    {
      'adapter.ts': `export const filter = (x: number): number => x\n`,
      'd.ts': `export * as Adapter from './adapter'\n`,
      'e.ts': `export * as Adapter from './adapter'\n`,
    },
    [
      { as: './d', file: 'd.ts' },
      { as: './e', file: 'e.ts' },
    ],
  )
  // the adapter module is multi-exposed under a unanimous alias
  expect(routeOf(fx, 'filter').slug).toBe('Adapter/filter')
  expect(routeOf(fx, 'filter').title).toBe('Adapter.filter')
})

it('colliding bare slugs relocate to source-path slugs', () => {
  const fx = multiRoutesFixture(
    {
      'f1.ts': `export interface Foo { a: number }\n`,
      'f2.ts': `export interface Foo { b: string }\n`,
      'f.ts': `export * from './f1'\nexport * as N1 from './f1'\nexport * from './f2'\nexport * as N2 from './f2'\n`,
    },
    [{ as: './f', file: 'f.ts' }],
  )
  const foos = fx.routes
    .filter((r): r is Extract<Route, { kind: 'doc' }> => r.kind === 'doc')
    .filter((r) => fx.index.get(r.decl)?.name === 'Foo')
  expect(foos.map((r) => r.slug).sort()).toEqual(['f1/Foo', 'f2/Foo'])
  // edges resolve by id, so links land on the relocated pages
  for (const route of foos) {
    expect(fx.router.get({ id: route.decl })?.slug).toBe(`l/${route.slug}`)
  }
})

const MIXED = `export interface I { a: number }\nexport type T = number\nexport const v = 1\nexport const f = (x: number): number => x\n`

it('export type * exposes types but not value declarations', () => {
  const fx = multiRoutesFixture({ 'm.ts': MIXED, 'g.ts': `export type * from './m'\n` }, [{ as: './g', file: 'g.ts' }])
  expect(fx.index.isExposed(byName(fx.index, 'I').id)).toBe(true)
  expect(fx.index.isExposed(byName(fx.index, 'T').id)).toBe(true)
  expect(fx.index.isExposed(byName(fx.index, 'v').id)).toBe(false)
  expect(fx.index.isExposed(byName(fx.index, 'f').id)).toBe(false)

  const [root] = [...fx.index.roots()]
  expect(memberTitles(fx.router, root!.id).sort()).toEqual(['I', 'T'])
})

it('type-only constraint carries into namespace members transitively', () => {
  const fx = multiRoutesFixture({ 'm.ts': MIXED, 'h.ts': `export type * as Types from './m'\n` }, [
    { as: './h', file: 'h.ts' },
  ])
  expect(fx.index.isExposed(byName(fx.index, 'f').id)).toBe(false)

  const [root] = [...fx.index.roots()]
  const typesModule = fx.index.exposes(root!.id)[0]!.exposer
  expect(memberAliases(fx.router, typesModule).sort()).toEqual(['Types.I', 'Types.T'])
})

it('a value export of the same module subsumes an earlier type-only one', () => {
  const fx = multiRoutesFixture(
    { 'm.ts': MIXED, 'i.ts': `export type * as T1 from './m'\nexport * as V1 from './m'\n` },
    [{ as: './i', file: 'i.ts' }],
  )
  expect(fx.index.isExposed(byName(fx.index, 'f').id)).toBe(true)
  expect(fx.index.isExposed(byName(fx.index, 'v').id)).toBe(true)

  // the module records once, under the first-seen alias
  const [root] = [...fx.index.roots()]
  const edges = fx.index.exposes(root!.id)
  expect(edges).toHaveLength(1)
  expect(edges[0]!.alias).toBe('T1')
})

it('sidebar aliases qualify relative to their branch', () => {
  const fx = multiRoutesFixture(FILES, ENTRIES)
  const [a, b] = [...fx.index.roots()]
  const shared = fx.index.exposes(b!.id)[0]!.exposer

  expect(memberAliases(fx.router, a!.id).sort()).toEqual(['Foo', 'bar'].sort())
  expect(memberAliases(fx.router, b!.id)).toEqual(['Stuff'])
  expect(memberAliases(fx.router, shared).sort()).toEqual(['Stuff.Foo', 'Stuff.bar'].sort())
})
