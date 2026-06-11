import { expect, it } from 'vitest'

import { placeIn, place } from '../src/core/route/adapter/index.ts'
import type { Adapter, Route } from '../src/core/route/index.ts'

import { multiRoutesFixture, byName } from './fixture.ts'

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

it('default placement: shortest chain from the earliest entrypoint wins', () => {
  const fx = multiRoutesFixture(FILES, ENTRIES)
  const foo = routeOf(fx, 'Foo')
  expect(foo.slug).toBe('a/Foo')
  expect(foo.title).toBe('Foo')
  expect(foo.sidebar?.parent).toBe('a')
})

it('an exposure hook relocates slug, title and sidebar placement together', () => {
  const relocate: Adapter = {
    exposure: (path, d) =>
      d.name === 'Foo' ? (d.exposure.ancestors().find((p) => p[0]?.entry()?.as === './b') ?? path) : path,
  }
  const fx = multiRoutesFixture(FILES, ENTRIES, relocate)
  const foo = routeOf(fx, 'Foo')
  expect(foo.slug).toBe('b/Stuff/Foo')
  expect(foo.title).toBe('Stuff.Foo')
  expect(foo.sidebar?.parent).toBe('b/Stuff')
  // untouched siblings keep the default placement
  expect(routeOf(fx, 'bar').slug).toBe('a/bar')
})

it('placeIn prefers the named entrypoint for everything it exposes', () => {
  const fx = multiRoutesFixture(FILES, ENTRIES, placeIn('./b'))
  expect(routeOf(fx, 'Foo').slug).toBe('b/Stuff/Foo')
  expect(routeOf(fx, 'bar').slug).toBe('b/Stuff/bar')
})

it('other exposers keep listing a relocated declaration and link to its new page', () => {
  const fx = multiRoutesFixture(FILES, ENTRIES, placeIn('./b'))
  const fooId = byName(fx.index, 'Foo').id
  const a = fx.routes.find((r): r is Extract<Route, { kind: 'doc' }> => r.kind === 'doc' && r.slug === 'a')
  expect(a?.links.some((l) => l.target === fooId)).toBe(true)
  expect(fx.router.get({ id: fooId })?.slug).toBe('l/b/Stuff/Foo')
})

it('place pins individual declarations by name', () => {
  const fx = multiRoutesFixture(FILES, ENTRIES, place({ Foo: 'b/Stuff' }))
  expect(routeOf(fx, 'Foo').slug).toBe('b/Stuff/Foo')
  expect(routeOf(fx, 'bar').slug).toBe('a/bar')
})

it('an empty path hides the sidebar entry and falls back to source-path placement', () => {
  const hide: Adapter = { exposure: (path, d) => (d.name === 'Foo' ? [] : path) }
  const fx = multiRoutesFixture(FILES, ENTRIES, hide)
  const foo = routeOf(fx, 'Foo')
  expect(foo.sidebar).toBeUndefined()
  expect(foo.slug).toBe('shared/Foo')
  expect(foo.title).toBe('Foo')
})
