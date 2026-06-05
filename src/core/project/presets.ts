import mm from 'micromatch'

import { createRouteProvider, type RouteProvider } from './routing.ts'
import { reshape, kindLayout, type Exposed } from './builder.ts'

/**
 * Merge any number of partial providers into a full one. Later parts win on
 * conflicting hooks; unset hooks fall back to the stock behaviour.
 *
 * @example
 * ```ts
 * provider: compose(groupByKind(), hide('_*'), sortAlphabetically())
 * ```
 */
export const compose = (...parts: Partial<RouteProvider>[]): RouteProvider =>
  createRouteProvider(Object.assign({}, ...parts))

/**
 * Group each route's children by declaration kind under synthetic headings
 * (`functions`, `types`, …), ordered canonically, names sorted within. This is
 * also the default layout, so you only need it to re-assert kind grouping
 * alongside other overrides.
 */
export const groupByKind = (): Partial<RouteProvider> => ({ children: kindLayout })

/** Sort every route's children alphabetically by name (no grouping). */
export const sortAlphabetically = (): Partial<RouteProvider> => ({
  children: (cx, kids) => reshape(cx, kids, ({ all, byName }) => [...all].sort(byName)),
})

/**
 * Hide declarations whose name matches any glob from the sidebar. The pages
 * stay reachable by URL and by cross-references — use {@link filterChildren}
 * to drop them from the tree entirely.
 */
export const hide = (...patterns: string[]): Partial<RouteProvider> => ({
  nav: (cx) => !patterns.some((p) => mm.isMatch(cx.decl.name, p)),
})

/** Keep only the children matching `predicate`; the rest are dropped from the tree. */
export const filterChildren = (predicate: (d: Exposed) => boolean): Partial<RouteProvider> => ({
  children: (cx, kids) => reshape(cx, kids, ({ all }) => all.filter(predicate)),
})

export const groupBy = (label: (d: Exposed) => string | undefined): Partial<RouteProvider> => ({
  children: (cx, kids) =>
    reshape(cx, kids, ({ all, group }) => {
      const buckets = new Map<string, Exposed[]>()
      const order: (Exposed | string)[] = [] // Exposed = ungrouped (inline); string = a group's slot

      for (const d of all) {
        const key = label(d)
        if (key === undefined) {
          order.push(d)
          continue
        }
        if (!buckets.has(key)) {
          buckets.set(key, [])
          order.push(key)
        }
        buckets.get(key)!.push(d)
      }

      return order.map((item) => (typeof item === 'string' ? group(item, buckets.get(item)!) : item))
    }),
})
