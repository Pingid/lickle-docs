import mm from 'micromatch'

import { createRouteProvider, type RouteProvider } from './routing.ts'
import { reshape, kindRank, type Exposed } from './builder.ts'

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
 * (`Functions`, `Types`, …), ordered canonically, names sorted within.
 */
export const groupByKind = (): Partial<RouteProvider> => ({
  children: (cx, kids) =>
    reshape(cx, kids, ({ all, group, byName }) =>
      [...groupBy(all, (d) => d.kind).entries()]
        .sort(([a], [b]) => kindRank(a) - kindRank(b))
        .map(([kind, items]) => group(pluralOf(kind), [...items].sort(byName))),
    ),
})

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

// ---------------- internal ----------------

const groupBy = <T, K>(items: T[], key: (t: T) => K): Map<K, T[]> => {
  const m = new Map<K, T[]>()
  for (const it of items) {
    const k = key(it)
    const arr = m.get(k)
    if (arr) arr.push(it)
    else m.set(k, [it])
  }
  return m
}

const PLURAL: Record<string, string> = {
  module: 'Modules',
  namespace: 'Namespaces',
  function: 'Functions',
  variable: 'Variables',
  'type-alias': 'Types',
  interface: 'Interfaces',
  class: 'Classes',
  enum: 'Enums',
  export: 'Exports',
}

const pluralOf = (kind: string): string => PLURAL[kind] ?? `${kind}s`
