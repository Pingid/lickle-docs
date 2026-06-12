import * as Slug from '../../../_lib/slug/index.ts'

import type {
  DocLink,
  Group,
  Route,
  RoutePrefix,
  SlugPath,
  ClientRouter,
  GroupedItems,
  SidebarRoute,
} from '../types.ts'
export type * from '../types.ts'

/**
 * Index generated routes for the client: prefix every slug with `base`
 * (version path) and the per-kind `prefix` (project name for doc routes),
 * build slug/id lookup maps and assemble the grouped sidebar tree.
 *
 * Sidebar nodes come from parent-owned `sidebar.children` edges, so the same
 * route may render under several parents. Descent stops when an edge targets
 * a route already on its own ancestry path, so cycles are safe.
 * @internal
 */
export const createRouter = (p: { routes: Route[]; prefix?: RoutePrefix; base?: string }): ClientRouter => {
  const prefix = Slug.join(p.base?.replace(/^\/+|\/+$/g, ''))

  let matchedHome = false
  const getSlug = (route: Route) => {
    if (!matchedHome && (route.slug === '/' || route.slug === '')) {
      matchedHome = true
      return prefix || '/'
    }
    const slug = Slug.normalize(route.slug)
    const kind = route.kind === 'doc' ? p.prefix?.doc : p.prefix?.page
    return Slug.join(prefix || undefined, kind, slug)
  }

  const _byId = new Map<number, Route>()
  const _bySlug = new Map<SlugPath, Route>()
  // Pre-prefix slugs, kept for breadcrumb segments.
  const _rawSlug = new Map<Route, SlugPath>()

  const allRoutes: Route[] = []

  for (const route of p.routes) {
    const next = { ...route, slug: getSlug(route) }
    allRoutes.push(next)
    _bySlug.set(next.slug, next)
    _rawSlug.set(next, route.slug)
    if (next.kind === 'doc') _byId.set(next.decl, next)

    if (next.slug === '/') _bySlug.set('', next)
  }

  // Build a node for `route` reached from `ancestry` (slugs of its ancestors,
  // itself included): child edges resolve declarations to their routes and
  // recurse; edges back into the ancestry are dropped, so the same route may
  // render under several parents but cycles stop. `display` is this
  // occurrence's branch-contextual name: children of a root show their hop
  // alias, deeper nodes qualify it with the parent occurrence's display.
  const node = (route: Route, ancestry: Set<SlugPath>, display?: string): SidebarRoute => {
    const path = new Set(ancestry).add(route.slug)
    const edges = (route.sidebar?.children ?? [])
      .map((edge) => ({ edge, target: _byId.get(edge.target) }))
      .filter((x): x is { edge: DocLink; target: Route } => x.target !== undefined && !path.has(x.target.slug))
    const pairs = edges.map(({ edge, target }) => ({
      edge,
      node: node(target, path, display === undefined ? edge.alias : `${display}.${edge.alias}`),
    }))
    const children = groupItems(pairs, (x) => x.edge.group).map((g) => ({
      group: g.group,
      items: g.items.sort((a, b) => (a.edge.order ?? 0) - (b.edge.order ?? 0)).map((x) => x.node),
    }))
    return { ...route, ...(display !== undefined ? { alias: display } : {}), children }
  }

  const roots = allRoutes.filter((r) => r.sidebar?.root !== undefined)
  const sidebar = groupItems(roots, (r) => r.sidebar?.group).map((g) => ({
    ...g,
    items: g.items.sort((a, b) => (a.sidebar?.root ?? 0) - (b.sidebar?.root ?? 0)).map((r) => node(r, new Set())),
  }))

  return {
    base: prefix,
    items: allRoutes,
    get: (match) => {
      if (typeof match.slug === 'string') return _bySlug.get(match.slug)
      if (typeof match.id === 'number') return _byId.get(match.id)
      return undefined
    },
    parts: (id: number) => {
      const route = _byId.get(id)
      const raw = route && _rawSlug.get(route)
      if (typeof raw !== 'string') return []
      const segs = [p?.prefix?.doc, ...raw.split('/')].filter((s) => s !== undefined)
      return segs.map((seg, i) => {
        const s = Slug.join(prefix || undefined, segs.slice(0, i + 1).join('/'))
        return { value: seg, slug: _bySlug.has(s) ? s : undefined }
      })
    },
    sidebar,
  }
}

/**
 * Bucket `items` by group name, then order the buckets by {@link Group}
 * (ascending; ties keep first-seen order). Items without a group fall into the
 * unnamed `''` bucket, which orders by its own `order` (0 by default) like any
 * other — set an explicit `order` to pin it first or last. Item order within a
 * bucket is preserved.
 * @internal
 */
export const groupItems = <T extends Record<string, any>>(
  items: T[],
  groupOf: (item: T) => Group | undefined,
): GroupedItems<T>[] => {
  const groups = new Map<string, { order: number; items: T[] }>()
  for (const item of items) {
    const group = groupOf(item)
    const name = group?.name ?? ''
    let bucket = groups.get(name)
    if (!bucket) {
      bucket = { order: group?.order ?? 0, items: [] }
      groups.set(name, bucket)
    }
    bucket.items.push(item)
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([group, bucket]) => ({ group, items: bucket.items }))
}
