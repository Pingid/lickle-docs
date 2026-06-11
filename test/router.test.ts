import { test, expect } from 'vitest'

import type { Route, DocLink, Group, Sidebar } from '../src/core/route/types.ts'
import { createRouter, groupItems } from '../src/core/route/client/index.ts'

test('groupItems buckets by group name and orders buckets by order', () => {
  const item = (id: number, group?: Group) => ({ id, group })
  const grouped = groupItems(
    [item(1, { name: 'types', order: 2 }), item(2, { name: 'fns', order: 1 }), item(3, { name: 'types', order: 2 })],
    (i) => i.group,
  )
  expect(grouped.map((g) => g.group)).toEqual(['fns', 'types'])
  expect(grouped.find((g) => g.group === 'types')!.items.map((i) => i.id)).toEqual([1, 3])
})

test('groupItems keeps first-seen order on ties and an unnamed "" bucket', () => {
  const item = (id: number, group?: Group) => ({ id, group })
  const grouped = groupItems(
    [item(1, { name: 'b', order: 0 }), item(2), item(3, { name: 'a', order: 0 })],
    (i) => i.group,
  )
  expect(grouped.map((g) => g.group)).toEqual(['b', '', 'a'])
})

const route = (over: {
  slug: string
  decl?: number
  links?: DocLink[]
  referenced?: DocLink[]
  sidebar?: Sidebar
  title?: string
}): Route => ({
  kind: 'doc',
  title: over.title ?? over.slug,
  slug: over.slug,
  decl: over.decl ?? 0,
  links: over.links ?? [],
  referenced: over.referenced ?? [],
  ...(over.sidebar ? { sidebar: over.sidebar } : {}),
})

test('createRouter prefixes doc slugs and resolves get() by slug and id', () => {
  const r = route({ slug: 'a', decl: 7 })
  const router = createRouter({ routes: [r], prefix: { doc: 'l' } })
  expect(router.get({ slug: 'l/a' })?.slug).toBe('l/a')
  expect(router.get({ id: 7 })?.slug).toBe('l/a')
  expect(router.get({ id: 99 })).toBeUndefined()
})

test('createRouter normalizes slugs: collapses repeated slashes and roots', () => {
  const r = route({ slug: '//foo//bar', decl: 1 })
  const router = createRouter({ routes: [r], prefix: {} })
  expect(router.get({ id: 1 })?.slug).toBe('/foo/bar')
})

test('link targets resolve to their routes via get()', () => {
  const child = route({ slug: 'p/c', decl: 2 })
  const mod = route({ slug: 'p', decl: 1, links: [{ target: 2, alias: 'c', group: { name: 'fns', order: 0 } }] })
  const router = createRouter({ routes: [mod, child], prefix: { doc: 'l' } })
  const links = (router.get({ id: 1 }) as Extract<Route, { kind: 'doc' }>).links
  expect(groupItems(links, (l) => l.group).map((g) => g.group)).toEqual(['fns'])
  expect(router.get({ id: links[0]!.target })?.slug).toBe('l/p/c')
})

test('doc routes carry their referenced backlinks, grouped by group', () => {
  const r = route({
    slug: 'f',
    decl: 2,
    referenced: [{ target: 5, alias: 'X', group: { name: 'refs', order: 0 } }],
  })
  const router = createRouter({ routes: [r], prefix: { doc: 'l' } })
  const doc = router.get({ id: 2 }) as Extract<Route, { kind: 'doc' }>
  expect(groupItems(doc.referenced, (x) => x.group).map((g) => g.group)).toEqual(['refs'])
  expect(doc.referenced[0]!.target).toBe(5)
})

test('legacy parent-pointer sidebars upgrade: parent-less routes root, children nest by slug', () => {
  const root = route({ slug: 'p', decl: 1, sidebar: {} })
  const child = route({ slug: 'p/c', decl: 2, sidebar: { parent: 'p', group: { name: 'fns', order: 0 } } as never })
  const router = createRouter({ routes: [root, child], prefix: { doc: 'l' } })

  const roots = router.sidebar.flatMap((g) => g.items)
  expect(roots.map((r) => r.slug)).toEqual(['l/p'])
  expect(roots[0]!.children.flatMap((g) => g.items).map((r) => r.slug)).toEqual(['l/p/c'])
})
