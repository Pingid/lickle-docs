import type * as docs from '@lickle/docs'

import { isRoutable, pluralLabel, groupOrder, type Kind } from './kind.js'

export type NavItem = {
  id: number
  name: string
  kind: Kind
  slug: string
  /** Comment to display alongside the item — used by the home page surface list. */
  comment?: docs.Comment
}
export type NavGroup = {
  title: string
  /** Set when the group corresponds to a routable declaration (typically a module entrypoint). */
  slug?: string
  items: NavItem[]
}

/** Pluggable sidebar grouping. Take a project, return groups. */
export type NavStrategy = (project: docs.Project) => NavGroup[]

/** A namespace re-export — `export * as foo from './x'` — stands in for a module. */
export const isNamespaceReExport = (decl: docs.Declaration): decl is docs.ReExportNamespace =>
  decl.kind === 're-export' && decl.form === 'namespace'

/**
 * Routable declarations across the project, sorted by kind group then name.
 * Used by the search index. Excludes namespace re-exports — `surface` covers
 * those for navigation.
 */
export const routables = (project: docs.Project): docs.Declaration[] => {
  const out: docs.Declaration[] = []
  for (const d of project.declarationsById.values()) {
    if (isRoutable(d.kind)) out.push(d)
  }
  out.sort(
    (a, b) =>
      groupOrder(pluralLabel(a.kind)) - groupOrder(pluralLabel(b.kind)) || compareNames(a, b),
  )
  return out
}

const compareNames = (a: docs.Declaration, b: docs.Declaration): number => {
  const an = (a as { name?: string }).name ?? ''
  const bn = (b as { name?: string }).name ?? ''
  return an.localeCompare(bn)
}

/**
 * Translate a precomputed surface item into a `NavItem` for rendering.
 * Returns undefined when the referenced declaration was filtered out (rare,
 * but possible if the schema and surface drift).
 */
const itemFor = (
  project: docs.Project,
  surfaceItem: { id: number; kind: string },
): NavItem | undefined => {
  const decl = project.declarationsById.get(surfaceItem.id)
  if (!decl) return undefined
  const slug = project.slugById.get(decl.id)
  if (!slug) return undefined
  return {
    id: decl.id,
    name: (decl as { displayName?: string; name?: string }).displayName ?? (decl as { name?: string }).name ?? '',
    kind: surfaceItem.kind as Kind,
    slug,
    comment: (decl as { comment?: docs.Comment }).comment,
  }
}

const sortByGroupThenName = (items: NavItem[]): NavItem[] =>
  items.sort(
    (a, b) => groupOrder(pluralLabel(a.kind)) - groupOrder(pluralLabel(b.kind)) || a.name.localeCompare(b.name),
  )

/**
 * Public surface from the entrypoint module(s) — direct routables plus any
 * namespace re-exports, both treated as first-class nav items. The home page
 * uses this list as its "Exports" overview.
 */
export const surface = (project: docs.Project): NavItem[] => {
  const out: NavItem[] = []
  const seen = new Set<number>()
  for (const entry of project.surface) {
    for (const item of entry.items) {
      if (seen.has(item.id)) continue
      const nav = itemFor(project, item)
      if (!nav) continue
      seen.add(item.id)
      out.push(nav)
    }
  }
  return sortByGroupThenName(out)
}

/**
 * Default kind-bucketed sidebar: every routable item from every entrypoint
 * flattened into one group per `pluralLabel(item.kind)`.
 */
export const byKind: NavStrategy = (project) => {
  const buckets = new Map<string, NavItem[]>()
  const seen = new Set<number>()
  for (const entry of project.surface) {
    for (const item of entry.items) {
      if (seen.has(item.id)) continue
      const nav = itemFor(project, item)
      if (!nav) continue
      seen.add(item.id)
      const title = pluralLabel(nav.kind)
      const arr = buckets.get(title) ?? []
      arr.push(nav)
      buckets.set(title, arr)
    }
  }
  return [...buckets.entries()]
    .map(([title, items]) => ({ title, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => groupOrder(a.title) - groupOrder(b.title) || a.title.localeCompare(b.title))
}

/**
 * One group per entry in `project.exports`, listing the routables that entry
 * exposes. Useful for multi-entrypoint packages where the export name is
 * the unit users care about (`.`, `./micro`, `./types`, …).
 *
 * Multiple export entries that point at the same source file (e.g. `.` and
 * `./index` both resolve to `src/index.ts`) are de-duplicated; the first
 * occurrence wins so canonical aliases like `.` are preserved.
 */
export const byExports: NavStrategy = (project) => {
  const out: NavGroup[] = []
  const seenPaths = new Set<string>()
  const surfaceByPath = new Map(project.surface.map((s) => [s.entrypoint, s] as const))
  const moduleByPath = new Map<string, docs.Module>()
  for (const m of project.modules()) if (m.path) moduleByPath.set(m.path, m)
  for (const exp of project.exports) {
    if (seenPaths.has(exp.path)) continue
    const surfaceEntry = surfaceByPath.get(exp.path)
    if (!surfaceEntry) continue
    const items: NavItem[] = []
    for (const item of surfaceEntry.items) {
      const nav = itemFor(project, item)
      if (nav) items.push(nav)
    }
    if (!items.length) continue
    seenPaths.add(exp.path)
    const mod = moduleByPath.get(exp.path)
    const slug = mod ? project.slugById.get(mod.id) : undefined
    out.push({ title: exp.name, slug, items: sortByGroupThenName(items) })
  }
  return out
}

/**
 * Pick a sensible default per project: `byExports` when the package surfaces
 * more than one entrypoint, otherwise the flat `byKind` view.
 */
export const auto: NavStrategy = (project) =>
  project.exports.length > 1 ? byExports(project) : byKind(project)

/**
 * Module chain ending in `id` — outermost module first, the declaration last.
 * Used by the breadcrumb.
 */
export const ancestors = (project: docs.Project, id: number): docs.Declaration[] => {
  const target = project.declarationsById.get(id)
  if (!target) return []
  const out: docs.Declaration[] = [target]
  const moduleOf = (decl: docs.Declaration): docs.Module | undefined =>
    (decl as { $?: { module?: docs.Module } }).$?.module
  let cur: docs.Module | undefined = target.kind === 'module' ? target.parentModule : moduleOf(target)
  while (cur) {
    out.unshift(cur)
    cur = cur.parentModule
  }
  return out
}
