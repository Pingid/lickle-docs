import type * as Reflect from '../reflect/index.ts'

import { Slug } from '../../_lib/index.ts'

import { compose, makeContext, withMemo, provide, type ContextOptions } from './provider/index.ts'
import { groupByKind } from './adapter/index.ts'
import type { Route } from './types.ts'

export type * from './provider/index.ts'
export * from './debug/index.ts'
export type * from './types.ts'

export type DocRoutes = { items: Route[]; declarations: Reflect.Declaration[] }

export const builder = (opts: ContextOptions) => {
  const cx = makeContext(opts, (c) => withMemo(provide(c, compose(groupByKind, opts.adapter))))

  const navigable = new Set<number>()
  const routes: Route[] = []
  const declarations: Reflect.Declaration[] = []
  let pageRouteMatched = false
  return {
    declare: (decl: Reflect.Declaration) => {
      const route = cx.provider.declare(decl.id)
      if (route) {
        routes.push(route)
        declarations.push(decl)
        if (cx.docs.isRoot(decl.id)) navigable.add(decl.id)
        for (const ref of route.referenced) navigable.add(ref.target)
        for (const link of route.links) navigable.add(link.target)
      }
    },
    markdown: (p: { title: string; slug?: string; content: string }) => {
      if ((!pageRouteMatched && !p.slug) || p.slug === '/' || p.slug === '') {
        pageRouteMatched = true
        routes.push({ kind: 'page', title: p.title, slug: '/', sidebar: {}, body: [p.content] })
        return
      }
      const slug = p.slug?.trim().replace(/^\/$/, '').length ? Slug.normalize(p.slug) : Slug.toSlug(p.title)
      routes.push({ kind: 'page', title: p.title, slug, sidebar: {}, body: [p.content] })
    },
    build: (): DocRoutes => {
      return {
        items: routes.filter((r) => r.kind !== 'doc' || navigable.has(r.decl)),
        declarations: declarations.filter((d) => navigable.has(d.id)),
      }
    },
  }
}
