import type * as Reflect from '../reflect/index.ts'

import { Slug } from '../../_lib/index.ts'

import { compose, withMemo, provide, type RouteContext, type Adapter } from './provider/index.ts'
import { createFacade } from './provider/facade.ts'
import { groupByKind } from './adapter/index.ts'
import type { Route } from './types.ts'

export type * from './provider/index.ts'
export * from './debug/index.ts'
export type * from './types.ts'

export type DocRoutes = { routes: Route[]; declarations: Reflect.Declaration[] }

/** Inputs for {@link makeContext}. */
export type ContextOptions = {
  /** The reflection index of every scanned declaration. */
  docs: Reflect.Index
  /** The project name, used as the route prefix. */
  name: string
  /** Optional refinements applied over the base provider. */
  adapter?: Adapter
}

export const builder = (opts: ContextOptions) => {
  const cx = { ...opts, provider: {} as any }
  const provider = (c: RouteContext) => withMemo(provide(c, compose(groupByKind, opts.adapter)))
  cx.provider = provider(cx)

  const routes: Route[] = []

  // declarations that are linked to by the sidebar or other routes
  const linked = new Set<number>()

  let pageRouteMatched = false
  return {
    declare: (decl: Reflect.Declaration) => {
      const facade = createFacade(cx.docs, decl.id)
      const route = facade && cx.provider.declare(facade)
      if (route) {
        routes.push(route)

        if (route.sidebar?.root !== undefined) linked.add(decl.id)
        for (const edge of route.sidebar?.children ?? []) linked.add(edge.target)
        for (const ref of route.referenced) linked.add(ref.target)
        for (const link of route.links) linked.add(link.target)
      }
    },
    markdown: (p: { title: string; slug?: string; content: string }) => {
      if ((!pageRouteMatched && !p.slug) || p.slug === '/' || p.slug === '') {
        pageRouteMatched = true
        routes.push({ kind: 'page', title: p.title, slug: '/', sidebar: { root: 0 }, body: [p.content] })
        return
      }
      const slug = p.slug?.trim().replace(/^\/$/, '').length ? Slug.normalize(p.slug) : Slug.toSlug(p.title)
      routes.push({ kind: 'page', title: p.title, slug, sidebar: { root: 0 }, body: [p.content] })
    },
    build: (): DocRoutes => {
      let r: Route[] = []
      const d: Reflect.Declaration[] = []
      const routed = new Set<number>()

      for (const route of routes) {
        if (route.kind === 'page') {
          r.push(route)
          continue
        }
        if (linked.has(route.decl)) {
          const decl = cx.docs.get(route.decl)
          if (!decl) continue
          r.push(route)
          d.push(decl)
          routed.add(route.decl)
        }
      }

      // Drop edges to declarations that did not survive the linked filter.
      for (const route of r) {
        if (route.kind === 'doc') {
          route.links = route.links.filter((l) => routed.has(l.target))
          route.referenced = route.referenced.filter((ref) => routed.has(ref.target))
        }
        if (route.sidebar?.children) {
          route.sidebar = { ...route.sidebar, children: route.sidebar.children.filter((e) => routed.has(e.target)) }
        }
      }

      r = r.sort((a, b) => {
        if (a.kind === 'page') return -1
        return a.title.localeCompare(b.title)
      })

      return { routes: r, declarations: d }
    },
  }
}
