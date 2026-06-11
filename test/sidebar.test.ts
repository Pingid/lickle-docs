import { expect, it } from 'vitest'

import type { Route, GroupedItems, SidebarRoute } from '../src/core/route/types.ts'
import { createRouter } from '../src/core/route/client/index.ts'
import { section } from '../src/core/route/adapter/index.ts'
import type { Adapter } from '../src/core/route/index.ts'

import { multiRoutesFixture, byName } from './fixture.ts'

const FILES = {
  'shared.ts': `export interface Foo { a: number }\nexport const bar = (x: number): number => x\n`,
  'a.ts': `export * from './shared'\n`,
  'b.ts': `export * as Stuff from './shared'\n`,
}
const ENTRIES = [
  { as: './a', file: 'a.ts' },
  { as: './b', file: 'b.ts' },
]

/** Every sidebar node documenting the given declaration, across all branches. */
const occurrences = (groups: GroupedItems<SidebarRoute>[], decl: number): SidebarRoute[] =>
  groups.flatMap((g) =>
    g.items.flatMap((n) => [...(n.kind === 'doc' && n.decl === decl ? [n] : []), ...occurrences(n.children, decl)]),
  )

const doc = (over: { decl: number; slug: string; title?: string; sidebar?: Route['sidebar'] }): Route => ({
  kind: 'doc',
  decl: over.decl,
  title: over.title ?? over.slug,
  slug: over.slug,
  links: [],
  referenced: [],
  ...(over.sidebar ? { sidebar: over.sidebar } : {}),
})

it('the same declaration listed by two parents renders under both', () => {
  const x = doc({ decl: 3, slug: 'p/x' })
  const p1 = doc({ decl: 1, slug: 'p', sidebar: { root: 1, children: [{ target: 3, alias: 'x' }] } })
  const p2 = doc({ decl: 2, slug: 'q', sidebar: { root: 2, children: [{ target: 3, alias: 'x' }] } })
  const router = createRouter({ routes: [p1, p2, x], prefix: { doc: 'l' } })
  expect(occurrences(router.sidebar, 3)).toHaveLength(2)
})

it('a cyclic edge stops at the repeated ancestor instead of recursing', () => {
  const a = doc({ decl: 1, slug: 'a', sidebar: { root: 1, children: [{ target: 2, alias: 'b' }] } })
  const b = doc({ decl: 2, slug: 'a/b', sidebar: { children: [{ target: 1, alias: 'a' }] } })
  const router = createRouter({ routes: [a, b], prefix: { doc: 'l' } })
  const [rootA] = occurrences(router.sidebar, 1)
  expect(rootA).toBeDefined()
  const [nestedB] = occurrences(rootA!.children, 2)
  expect(nestedB).toBeDefined()
  // the edge back to `a` is dropped, so `b` has no children
  expect(nestedB!.children).toEqual([])
})

it('edges to unknown declarations are dropped', () => {
  const p = doc({ decl: 1, slug: 'p', sidebar: { root: 1, children: [{ target: 99, alias: 'gone' }] } })
  const router = createRouter({ routes: [p], prefix: { doc: 'l' } })
  expect(occurrences(router.sidebar, 1)[0]!.children).toEqual([])
})

it('section() lists declarations at the root while their canonical entry remains', () => {
  const fx = multiRoutesFixture(FILES, ENTRIES, section('essentials', ['Foo']))
  const fooId = byName(fx.index, 'Foo').id

  const nodes = occurrences(fx.router.sidebar, fooId)
  expect(nodes).toHaveLength(2)

  // one occurrence is a root in the curated group, listed first
  expect(fx.router.sidebar[0]?.group).toBe('essentials')
  expect(fx.router.sidebar[0]?.items.map((n) => (n.kind === 'doc' ? n.decl : undefined))).toEqual([fooId])
  // both occurrences link to the same canonical page
  expect(new Set(nodes.map((n) => n.slug)).size).toBe(1)
})

it('a sidebar hook can append an edge to duplicate a declaration under another parent', () => {
  const dup: Adapter = {
    sidebar: (value, d) => {
      if (!d.isEntry() || d.entry()?.as !== './b') return value
      const stuff = d.exposure.children()[0]
      const foo = stuff?.members().find((m) => m.name === 'Foo')
      if (!foo) return value
      return { ...(value ?? {}), children: [...(value?.children ?? []), { target: foo.id, alias: 'Foo' }] }
    },
  }
  const fx = multiRoutesFixture(FILES, ENTRIES, dup)
  const fooId = byName(fx.index, 'Foo').id
  // canonical placement under `a`, plus the appended edge under `b`
  expect(occurrences(fx.router.sidebar, fooId)).toHaveLength(2)
})

it('legacy parent-pointer sidebars upgrade to children edges', () => {
  const root = doc({ decl: 1, slug: 'p', sidebar: { order: 1 } as never })
  const child = doc({ decl: 2, slug: 'p/c', sidebar: { parent: 'p', group: { name: 'fns', order: 0 } } as never })
  const router = createRouter({ routes: [root, child], prefix: { doc: 'l' } })

  const roots = router.sidebar.flatMap((g) => g.items)
  expect(roots.map((r) => r.slug)).toEqual(['l/p'])
  const children = roots[0]!.children
  expect(children.map((g) => g.group)).toEqual(['fns'])
  expect(children.flatMap((g) => g.items).map((r) => r.slug)).toEqual(['l/p/c'])
})
