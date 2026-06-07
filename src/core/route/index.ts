import type * as Reflect from '../reflect/index.ts'

import { Path } from '../../_lib/index.ts'

import { compose, makeContext, withMemo, provide, type ContextOptions } from './provider/index.ts'
import { groupByKind, slugBase } from './adapter/index.ts'
import type { Route } from './types.ts'

export type * from './provider/index.ts'
export * from './debug/index.ts'
export type * from './types.ts'

export type DocRoutes = {
  routes: Route[]
  slugBase: string
  declarations: Reflect.Declaration[]
}

export const builder = (opts: ContextOptions) => {
  const base = 'l'
  const cx = makeContext(opts, (c) => withMemo(provide(c, compose(groupByKind, slugBase(base), opts.adapter))))
  const routes: Route[] = []
  const declarations: Reflect.Declaration[] = []

  return {
    declare: (decl: Reflect.Declaration) => {
      const route = cx.provider.declare(decl.id)
      if (route) {
        routes.push(route)
        declarations.push(decl)
      }
    },
    markdown: (p: { title: string; slug?: string; content: string }) => {
      const slug = p.slug ?? Path.toSlug(p.title)
      routes.push({ kind: 'page', title: p.title, slug, sidebar: {}, body: [p.content] })
    },
    build: (): DocRoutes => {
      const navigable = reachable(routes)
      return {
        routes: routes.filter((r) => r.kind !== 'doc' || navigable.has(r.decl)),
        declarations: declarations.filter((d) => navigable.has(d.id)),
        slugBase: base,
      }
    },
  }
}

/**
 * The declarations the UI can actually reach: every doc route placed in the
 * sidebar, grown transitively along "referenced in" backlinks. Internal,
 * unrouted declarations surface nowhere and are dropped — references to them
 * simply have no slug and degrade to text.
 */
const reachable = (routes: Route[]): Set<number> => {
  const byId = new Map<number, Route>()
  for (const r of routes) if (r.kind === 'doc') byId.set(r.decl, r)

  const keep = new Set<number>()
  const queue: number[] = []
  const add = (id: number) => {
    if (byId.has(id) && !keep.has(id)) (keep.add(id), queue.push(id))
  }

  for (const r of routes) if (r.kind === 'doc' && r.sidebar !== undefined) add(r.decl)
  while (queue.length) {
    const r = byId.get(queue.pop()!)
    if (r?.kind !== 'doc') continue
    for (const ref of r.referenced) add(ref.target)
  }

  return keep
}
