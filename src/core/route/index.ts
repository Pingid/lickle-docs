import type { Route, DocStatement } from './types.ts'

import type * as Reflect from '../reflect/index.ts'

import { compose, makeContext, withMemo, provide, type ContextOptions } from './provider/index.ts'
import { groupByKind, slugBase } from './adapter/index.ts'
import { groupOrder, pluralLabel } from './naming.ts'

export type * from './provider/index.ts'
export * from './debug/index.ts'
export type * from './types.ts'

export const docRoutes = (opts: ContextOptions): { routes: Route[]; slugBase: string } => {
  const base = 'l'
  const used = trackExposed()
  const cx = makeContext(opts, (c) =>
    withMemo(provide(c, compose(groupByKind, slugBase(base), opts.adapter, used.adapter))),
  )

  const routes: Route[] = []
  for (const decl of opts.docs.declarations()) {
    const r = cx.provider.route(decl.id)
    if (r) routes.push(r)
  }

  const navigable = reachable(routes, used.seen)

  return {
    slugBase: base,
    routes: routes
      .filter((r) => {
        const s = statement(r)
        return !s || navigable.has(s.id)
      })
      .sort((a, b) => {
        const a1 = statement(a)
        const b1 = statement(b)
        if (!a1 || !b1) return 0
        return groupOrder(pluralLabel(cx.docs.get(a1.id)!.kind)) - groupOrder(pluralLabel(cx.docs.get(b1.id)!.kind))
      }),
  }
}

const statement = (route: Route): DocStatement | undefined =>
  route.body.find((b): b is DocStatement => b.kind === 'doc:statement')

/**
 * Adapter that records the directly-navigable declarations as they're built:
 * those shown in the sidebar or as a member. Pairs with {@link reachable} to
 * seed the navigability closure without re-scanning the route data.
 */
const trackExposed = () => {
  const seen = new Set<number>()
  const adapter = compose({
    sidebar: (value, decl) => {
      if (value !== undefined) seen.add(decl.id)
      return value
    },
    modules: (value, decl) => {
      if (value.length) seen.add(decl.id)
      return value
    },
  })
  return { adapter, seen }
}

/**
 * Grow `seed` (the directly-navigable routes) into the full set reachable in the
 * UI by following each kept page's "referenced in" backlinks transitively.
 * Routes that surface nowhere are dropped by default.
 */
const reachable = (routes: Route[], seed: Set<number>): Set<number> => {
  const byId = new Map<number, Route>()
  for (const r of routes) {
    const s = statement(r)
    if (s) byId.set(s.id, r)
  }

  const keep = new Set<number>()
  const queue: number[] = []
  const add = (id: number) => {
    if (byId.has(id) && !keep.has(id)) (keep.add(id), queue.push(id))
  }

  for (const id of seed) add(id)
  while (queue.length) {
    const r = byId.get(queue.pop()!)!
    for (const b of r.body) if (b.kind === 'doc:referenced') for (const ref of b.referenced) add(ref.target)
  }

  return keep
}

/**
 * Trim the declaration set shipped to the client to only what the UI can
 * render: every declaration a route points at via a `doc:statement`. The UI
 * resolves declarations by id exclusively through these routes — page bodies,
 * member rows, "referenced in", sidebar cues and search all key off
 * `doc:statement.id` — so internal/unrouted declarations are dead weight.
 * References to a dropped declaration simply have no slug and degrade to text.
 */
export const compact = (p: { docs: Reflect.Index; routes: Route[] }): Reflect.Declaration[] => {
  const needed = new Set<number>()
  for (const route of p.routes) {
    for (const body of route.body) {
      if (body.kind === 'doc:statement') needed.add(body.id)
    }
  }
  return [...p.docs.declarations()].filter((d) => needed.has(d.id))
}
