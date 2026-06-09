import * as Slug from '../../../_lib/slug/index.ts'

import type { Group, Route, RoutePrefix, SlugPath } from '../types.ts'
export type * from '../types.ts'

/** A list of items sharing a group name, emitted in resolved group order. */
export type GroupedItems<T> = { group: string; items: T[] }

export type SidebarRoute = Route & { children: GroupedItems<SidebarRoute>[] }

export interface ClientRouter {
  items: Route[]
  sidebar: GroupedItems<SidebarRoute>[]
  get(match: { slug?: SlugPath; id?: number }): Route | undefined
  parts(id: number): { value: string; slug?: SlugPath }[]
}

export const createRouter = (p: { items: Route[]; prefix: RoutePrefix; base?: string }): ClientRouter => {
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
  const _byNextSlug = new Map<SlugPath, SlugPath>()
  const _byOldSlug = new Map<SlugPath, SlugPath>()

  const allRoutes: Route[] = []
  const _sidebarRoot: Route[] = []

  for (const route of p.items) {
    const next = { ...route, slug: getSlug(route) }
    allRoutes.push(next)
    _bySlug.set(next.slug, next)
    _byNextSlug.set(next.slug, route.slug)
    _byOldSlug.set(route.slug, next.slug)

    if (next.slug === '/') _bySlug.set('', next)
    if (next.kind === 'doc') _byId.set(next.decl, next)

    if (next.sidebar && typeof next.sidebar?.parent !== 'string') _sidebarRoot.push(next)
  }

  for (const route of allRoutes) {
    if (route.sidebar && typeof route.sidebar?.parent === 'string') {
      route.sidebar = { ...route.sidebar, parent: _byOldSlug.get(route.sidebar.parent) }
    }
  }

  const buildSidebar = (routes: Route[]): GroupedItems<SidebarRoute>[] =>
    groupItems(
      routes.map((r) => ({
        ...r,
        children: buildSidebar(allRoutes.filter((b) => b.sidebar?.parent === r.slug)),
      })),
      (r) => r.sidebar?.group,
    ).map((g) => ({ ...g, items: g.items.sort((a, b) => (a.sidebar?.order ?? 0) - (b.sidebar?.order ?? 0)) }))

  const sidebar = buildSidebar(_sidebarRoot)

  return {
    items: allRoutes,
    get: (match) => {
      if (typeof match.slug === 'string') return _bySlug.get(match.slug)
      if (typeof match.id === 'number') return _byId.get(match.id)
      return undefined
    },
    parts: (id: number) => {
      const route = _byId.get(id)
      if (!route) return []
      const old = _byNextSlug.get(route.slug)
      if (typeof old !== 'string') return []
      const segs = [p.prefix.doc, ...old.split('/')].filter((s) => s !== undefined)
      return segs.map((seg, i) => {
        const s = Slug.join(prefix || undefined, segs.slice(0, i + 1).join('/'))
        return { value: seg, slug: _bySlug.has(s) ? s : undefined }
      })
    },
    sidebar,
  }
}

/**
 * Bucket `items` by group name, then order the buckets by {@link Group.order}
 * (ascending; ties keep first-seen order). Items without a group fall into the
 * unnamed `''` bucket, which orders by its own `order` (0 by default) like any
 * other — set an explicit `order` to pin it first or last. Item order within a
 * bucket is preserved.
 */
export const groupItems = <T>(items: T[], groupOf: (item: T) => Group | undefined): GroupedItems<T>[] => {
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
