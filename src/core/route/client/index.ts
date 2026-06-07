import type { Group, Route, Slug, DocLink } from '../types.ts'
export type * from '../types.ts'

type ReferencedItem = { route: Route } & DocLink

/** A list of items sharing a group name, emitted in resolved group order. */
export type GroupedItems<T> = { group: string; items: T[] }

export interface ClientRouter {
  items: Route[]
  slugBase: string
  get(match: { slug?: Slug; id?: number }): Route | undefined
  referenced(id: number): GroupedItems<ReferencedItem>[]
  sidebar: {
    roots: () => Route[]
    children: (slug?: Slug) => GroupedItems<Route>[]
  }
}

const ROOT = '/'

export const createRouter = (p: { routes: Route[]; slugBase: string }): ClientRouter => {
  const routes = p.routes.map((r) => ({ ...r, slug: normalizeSlug(r.slug) }))

  const _bySlug = new Map<Slug, Route>()
  const _byId = new Map<number, Route>()

  const _allReferenced = new Map<number, ReferencedItem[]>()
  const _allSidebar = new Map<Slug, Route[]>()

  for (const route of routes) {
    _bySlug.set(route.slug, route)
    // `sidebar.parent` is a raw provider slug; normalize it to match the
    // normalized `route.slug` keys so child lookups resolve.
    if (route.sidebar) push(_allSidebar, route.sidebar.parent ? normalizeSlug(route.sidebar.parent) : ROOT, route)
    if (route.kind !== 'doc') continue

    _byId.set(route.decl, route)

    for (const ref of route.referenced) push(_allReferenced, ref.target, { ...ref, route })
  }

  const _referenced = groupValues(_allReferenced, (r) => r.group)
  const _sidebar = groupValues(_allSidebar, (r) => r.sidebar?.group)

  return {
    slugBase: p.slugBase,
    items: [..._bySlug.values()],
    get: (match) => {
      if (typeof match.slug === 'string') return _bySlug.get(normalizeSlug(match.slug))
      if (typeof match.id === 'number') return _byId.get(match.id)
      return undefined
    },
    referenced: (id) => _referenced.get(id) ?? [],
    sidebar: {
      children: (slug) => {
        const s = normalizeSlug(slug)
        if (!s.startsWith(`/${p.slugBase}`)) return []
        return _sidebar.get(s) ?? []
      },
      roots: () => (_allSidebar.get(ROOT) ?? []).sort((a, b) => (a.sidebar?.order ?? 0) - (b.sidebar?.order ?? 0)),
    },
  }
}

/** Append `value` to the array at `key`, creating it on first use. */
const push = <K, V>(map: Map<K, V[]>, key: K, value: V): void => {
  const arr = map.get(key)
  if (arr) arr.push(value)
  else map.set(key, [value])
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

/** Apply {@link groupItems} to every value list in a map, preserving keys. */
const groupValues = <K, T>(src: Map<K, T[]>, groupOf: (item: T) => Group | undefined): Map<K, GroupedItems<T>[]> => {
  const out = new Map<K, GroupedItems<T>[]>()
  for (const [key, items] of src) out.set(key, groupItems(items, groupOf))
  return out
}

export const normalizeSlug = (slug?: string): string => {
  if (!slug) return '/'
  if (!slug.startsWith('/')) return `/${slug}`
  if (/^\/\//.test(slug)) return slug.slice(1)
  return slug
}
