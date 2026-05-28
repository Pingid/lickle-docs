import * as docs from '../../core/client.ts'

import { isRoutable, pluralLabel, groupOrder, type Kind } from '../util/kind.ts'

export type NavItem = {
  id: number
  name: string
  kind: Kind
  /** Set when the item has its own route — undefined for inlined non-routable nodes. */
  slug?: string
  /** Comment to display alongside the item — used by the home page surface list. */
  comment?: docs.Comment
  /** Nested children for module-style nodes that expose their own sub-tree. */
  children?: NavItem[]
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
  out.sort((a, b) => groupOrder(pluralLabel(a.kind)) - groupOrder(pluralLabel(b.kind)) || compareNames(a, b))
  return out
}

const compareNames = (a: docs.Declaration, b: docs.Declaration): number => docs.nameOf(a).localeCompare(docs.nameOf(b))

const sortByGroupThenName = (items: NavItem[]): NavItem[] => {
  items.sort((a, b) => groupOrder(pluralLabel(a.kind)) - groupOrder(pluralLabel(b.kind)) || a.name.localeCompare(b.name))
  for (const it of items) if (it.children?.length) sortByGroupThenName(it.children)
  return items
}

/**
 * Public surface from the entrypoint module(s) — direct routables plus any
 * namespace re-exports, both treated as first-class nav items. The home
 * page uses this list as its "Exports" overview.
 */
export const surface = (project: docs.Project): NavItem[] => {
  const out: NavItem[] = []
  const seen = new Set<number>()
  for (const entry of project.surface) {
    for (const item of entry.items) {
      if (seen.has(item.id)) continue
      const decl = project.declarationsById.get(item.id)
      if (!decl) continue
      const nav = leafItem(project, decl, item.kind as Kind)
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
      const decl = project.declarationsById.get(item.id)
      if (!decl) continue
      const nav = leafItem(project, decl, item.kind as Kind)
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
 * One group per entry in `project.exports`, listing the routables that
 * entry exposes as a recursive tree. Named modules — TypeScript namespaces
 * and `export * as foo from '…'` re-exports — always become nested
 * `NavItem`s under their own name so the structure of the source survives
 * in the sidebar.
 *
 * Multiple export entries that point at the same source file (e.g. `.` and
 * `./index` both resolve to `src/index.ts`) are de-duplicated; the first
 * occurrence wins so canonical aliases like `.` are preserved.
 */
export const byExports: NavStrategy = (project) => {
  const out: NavGroup[] = []
  const seenPaths = new Set<string>()
  const moduleByPath = new Map<string, docs.Module>()
  for (const m of project.modules()) if (m.path) moduleByPath.set(m.path, m)
  for (const exp of project.exports) {
    if (seenPaths.has(exp.path)) continue
    const mod = moduleByPath.get(exp.path)
    if (!mod) continue
    const items = buildChildren(mod, project)
    if (!items.length) continue
    seenPaths.add(exp.path)
    out.push({ title: exp.name, slug: project.slugById.get(mod.id), items: sortByGroupThenName(items) })
  }
  return out
}

/**
 * Pick a sensible default per project: `byExports` when the package surfaces
 * more than one entrypoint, otherwise the flat `byKind` view.
 */
export const auto: NavStrategy = (project) => (project.exports.length > 1 ? byExports(project) : byExports(project))

/**
 * Module chain ending in `id` — outermost module first, the declaration last.
 * Used by the breadcrumb.
 */
export const ancestors = (project: docs.Project, id: number): docs.Declaration[] => {
  const target = project.declarationsById.get(id)
  if (!target) return []
  const out: docs.Declaration[] = [target]
  let cur: docs.Module | undefined =
    target.kind === 'module' ? target.parentModule : (docs.queriesOf(target)?.module as docs.Module | undefined)
  while (cur) {
    out.unshift(cur)
    cur = cur.parentModule
  }
  return out
}

// ============================================================================
// TREE BUILDING
// `buildChildren` walks a module's `children` into a NavItem tree. Named
// modules (TypeScript namespaces and `export * as …` re-exports) become
// nested nodes; anonymous `export *` and `export { … }` re-exports inline
// their targets at the current level.
// ============================================================================

const buildChildren = (mod: docs.Module, project: docs.Project): NavItem[] => {
  const out: NavItem[] = []
  const seen = new Set<number>()
  for (const child of mod.children) addChild(child, project, out, seen)
  return out
}

const addChild = (child: docs.Declaration, project: docs.Project, out: NavItem[], seen: Set<number>): void => {
  if (child.kind === 'module') return addModule(child, child, project, out, seen)
  if (child.kind === 're-export') return addReExport(child, project, out, seen)
  if (!isRoutable(child.kind)) return
  if (seen.has(child.id)) return
  const nav = leafItem(project, child, child.kind as Kind)
  if (!nav) return
  seen.add(child.id)
  out.push(nav)
}

/**
 * Attach a module as a nested node. `displayAs` lets a namespace re-export
 * render the target module under the re-export's alias (e.g. `as: 'foo'`)
 * instead of the source module's display name.
 */
const addModule = (
  displayAs: docs.Module | docs.ReExportNamespace,
  target: docs.Module,
  project: docs.Project,
  out: NavItem[],
  seen: Set<number>,
): void => {
  if (seen.has(target.id)) return
  seen.add(target.id)
  const slug = project.slugById.get(target.id)
  const name = displayAs.kind === 're-export' ? displayAs.as : docs.displayNameOf(target)
  out.push({
    id: target.id,
    name,
    kind: 'module',
    slug,
    comment: target.comment,
    children: sortByGroupThenName(buildChildren(target, project)),
  })
}

const addReExport = (re: docs.ReExport, project: docs.Project, out: NavItem[], seen: Set<number>): void => {
  if (re.form === 'namespace') {
    const src = re.sourceModuleRef
    if (!src) return
    return addModule(re, src, project, out, seen)
  }
  for (const target of re.targets) {
    if (target.kind === 'module') {
      addModule(target, target, project, out, seen)
      continue
    }
    if (!isRoutable(target.kind)) continue
    if (seen.has(target.id)) continue
    const nav = leafItem(project, target, target.kind as Kind)
    if (!nav) continue
    seen.add(target.id)
    out.push(nav)
  }
}

const leafItem = (project: docs.Project, decl: docs.Declaration, kind: Kind): NavItem | undefined => {
  const slug = project.slugById.get(decl.id)
  if (!slug) return undefined
  return {
    id: decl.id,
    name: docs.displayNameOf(decl),
    kind,
    slug,
    comment: decl.comment,
  }
}
