import { test, expect } from 'vitest'

import { routesFixture, memberTitles, memberGroups } from './fixture.ts'
import type { ClientRouter } from '../src/core/route/client/index.ts'
import { type Adapter } from '../src/core/route/index.ts'

/** The declaration id of the doc route at `slug`. */
const idAt = (router: ClientRouter, slug: string): number => {
  const route = router.get({ slug })
  if (!route) throw new Error(`no route at ${slug}`)
  if (route.kind !== 'doc') throw new Error(`route at ${slug} is not a declaration`)
  return route.decl
}

/** Aliases of the declarations that reference (link back to) the route at `slug`. */
const backlinks = (router: ClientRouter, slug: string): string[] => {
  const route = router.get({ slug })!
  if (route.kind !== 'doc') return []
  return route.referenced.map((r) => r.alias)
}

/** Titles of the doc routes that reference (link back to) the declaration `id`. */
const referencedBy = (router: ClientRouter, id: number): string[] =>
  router.items.filter((r) => r.kind === 'doc' && r.referenced.some((x) => x.target === id)).map((r) => r.title)

// --- slugs & member nesting/grouping --------------------------------------

test('top-level and nested exports get prefixed, qualified slugs', () => {
  const { router } = routesFixture(`
    export namespace Outer {
      export const inner = 1
    }
    export const top = 2
  `)
  expect(router.get({ slug: 'l/fixture' }), 'root module route exists').toBeTruthy()
  expect(router.get({ slug: 'l/fixture/top' }), 'top-level export').toBeTruthy()
  expect(router.get({ slug: 'l/fixture/Outer' }), 'namespace').toBeTruthy()
  expect(router.get({ slug: 'l/fixture/Outer/inner' }), 'namespace member').toBeTruthy()
})

test('root lists only direct members; nested members live under their namespace', () => {
  const { router } = routesFixture(`
    export namespace Outer {
      export const inner = 1
      export function deep() {}
    }
    export const top = 2
  `)
  const root = idAt(router, 'l/fixture')
  expect(memberTitles(router, root)).toEqual(['Outer', 'top'])

  const outer = idAt(router, 'l/fixture/Outer')
  expect(memberTitles(router, outer).sort()).toEqual(['Outer.deep', 'Outer.inner'])
})

test('members are grouped by kind (plural) and ordered functions → variables → types', () => {
  const { router } = routesFixture(`
    export type A = string
    export const b = 1
    export function c() {}
    export interface D {}
    export class E {}
  `)
  const root = idAt(router, 'l/fixture')
  expect(memberGroups(router, root)).toEqual(['functions', 'variables', 'types', 'classes', 'interfaces'])
  expect(memberTitles(router, root)).toEqual(['c', 'b', 'A', 'E', 'D'])
})

// --- sidebar, referenced-in, reachable, compact ---------------------------

test('sidebar roots hold the entrypoint; children nest under it', () => {
  const { router } = routesFixture(`
    export const a = 1
    export function b() {}
  `)
  expect(router.sidebar.flatMap((g) => g.items).map((r) => r.title)).toEqual(['fixture'])
  const root = idAt(router, 'l/fixture')
  expect(memberTitles(router, root).sort()).toEqual(['a', 'b'])
})

test('a parameter type reference is recorded as a backlink on the referenced type', () => {
  const { router } = routesFixture(`
    export type Foo = { x: number }
    export function use(a: Foo) { return a.x }
  `)
  expect(backlinks(router, 'l/fixture/Foo')).toEqual(['use'])
  // The inverse view: what `use` references.
  const useId = idAt(router, 'l/fixture/use')
  expect(referencedBy(router, useId)).toEqual(['Foo'])
})

test('reachable keeps a non-exported referrer but drops fully-unreferenced declarations', () => {
  const { router } = routesFixture(`
    export type Foo = { x: number }
    function helper(a: Foo) { return a.x }
    export const usesHelper = helper

    const orphan = 99
  `)
  const titles = router.items.map((r) => r.title)
  expect(titles, 'referrer of an export is kept').toContain('helper')
  expect(titles).toContain('usesHelper')
  expect(titles, 'unreferenced non-export is pruned').not.toContain('orphan')
})

test('builder declarations back exactly the doc routes', () => {
  const { routes, declarations } = routesFixture(`
    const secret = 1
    export const shown = 2
  `)
  const names = declarations.map((d) => d.name)
  expect(names).toContain('shown')
  expect(names).not.toContain('secret')
  expect(declarations.length).toBe(routes.filter((r) => r.kind === 'doc').length)
})

// --- alias / title / exports / adapter ------------------------------------

test('namespace member title is the qualified alias; decl name is the simple name', () => {
  const { router, index } = routesFixture(`
    export namespace Outer {
      export function inner() {}
    }
  `)
  const route = router.get({ slug: 'l/fixture/Outer/inner' })!
  expect(route.title).toBe('Outer.inner')
  expect(route.kind === 'doc' && index.get(route.decl)?.name).toBe('inner')
})

test('export { x as y } exposes the target under the alias and produces no extra route', () => {
  const { router } = routesFixture(`
    const internalThing = 1
    export { internalThing as renamed }
  `)
  const route = router.get({ slug: 'l/fixture/renamed' })
  expect(route, 'aliased export is routed').toBeTruthy()
  expect(route!.title).toBe('renamed')
  expect(router.get({ slug: 'l/fixture/internalThing' })).toBeUndefined()
})

test('non-exported top-level declarations are excluded from the sidebar', () => {
  const { router } = routesFixture(`
    const secret = 1
    export const shown = 2
  `)
  const root = idAt(router, 'l/fixture')
  expect(memberTitles(router, root)).toEqual(['shown'])
})

test('a custom adapter slug hook composes onto the default output', () => {
  const adapter: Adapter = { slug: (slug) => `${slug}-X` }
  const { router } = routesFixture(`export const a = 1`, adapter)
  expect(router.get({ slug: 'l/fixture-X' }), 'root slug is transformed').toBeTruthy()
  expect(router.get({ slug: 'l/fixture/a-X' }), 'member slug is transformed').toBeTruthy()
})
