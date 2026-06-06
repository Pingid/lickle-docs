import { test, expect } from 'vitest'

import { createRouter, groupItems, normalizeSlug } from '../src/core/route/client/index.ts'
import type { Route, Group } from '../src/core/route/types.ts'

test('normalizeSlug roots, prefixes, and collapses leading "//"', () => {
  expect(normalizeSlug(undefined)).toBe('/')
  expect(normalizeSlug('')).toBe('/')
  expect(normalizeSlug('foo')).toBe('/foo')
  expect(normalizeSlug('//foo')).toBe('/foo')
  expect(normalizeSlug('/foo')).toBe('/foo')
})

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

const route = (over: Partial<Route> & { slug: string }): Route => ({ title: over.slug, body: [], ...over })

const stmt = (id: number, modules: { target: number; alias: string; group?: Group }[] = []) =>
  ({ kind: 'doc:statement', id, alias: String(id), exported: true, modules }) as const

test('createRouter resolves get() by normalized slug and by statement id', () => {
  const r = route({ slug: 'a', body: [stmt(7)] })
  const router = createRouter({ routes: [r], slugBase: 'l' })
  expect(router.get({ slug: 'a' })?.slug).toBe('/a')
  expect(router.get({ slug: '/a' })?.slug).toBe('/a')
  expect(router.get({ id: 7 })?.slug).toBe('/a')
  expect(router.get({ id: 99 })).toBeUndefined()
})

test('members() groups module backlinks and returns [] for unknown ids', () => {
  const child = route({
    slug: 'l/p/c',
    body: [stmt(2, [{ target: 1, alias: 'c', group: { name: 'fns', order: 0 } }])],
  })
  const router = createRouter({ routes: [route({ slug: 'l/p', body: [stmt(1)] }), child], slugBase: 'l' })
  const groups = router.members(1)
  expect(groups.map((g) => g.group)).toEqual(['fns'])
  expect(groups[0].items[0].route.slug).toBe('/l/p/c')
  expect(router.members(404)).toEqual([])
})

test('referenced() groups type backlinks and returns [] for unknown ids', () => {
  const r = route({
    slug: 'l/f',
    body: [stmt(2), { kind: 'doc:referenced', referenced: [{ target: 5, alias: 'X', group: { name: 'refs', order: 0 } }] }],
  })
  const router = createRouter({ routes: [r], slugBase: 'l' })
  expect(router.referenced(5).map((g) => g.group)).toEqual(['refs'])
  expect(router.referenced(5)[0].items[0].route.slug).toBe('/l/f')
  expect(router.referenced(123)).toEqual([])
})

test('sidebar.roots() are parent-less routes; children() respects slugBase', () => {
  const root = route({ slug: 'l/p', body: [stmt(1)], sidebar: {} })
  const child = route({ slug: 'l/p/c', body: [stmt(2)], sidebar: { parent: 'l/p', group: { name: 'fns', order: 0 } } })
  const router = createRouter({ routes: [root, child], slugBase: 'l' })

  expect(router.sidebar.roots().map((r) => r.slug)).toEqual(['/l/p'])
  const kids = router.sidebar.children('l/p')
  expect(kids.flatMap((g) => g.items.map((r) => r.slug))).toEqual(['/l/p/c'])
  expect(router.sidebar.children('outside')).toEqual([])
})
