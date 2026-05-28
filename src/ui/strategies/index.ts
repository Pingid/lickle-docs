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
  /** Nested children for module/namespace-style nodes that expose their own sub-tree. */
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

/**
 * Routable declarations across the project, sorted by kind group then name.
 * Used by the search index.
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
      const nav = leafItem(project, decl, item.kind as Kind, item.name)
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
      const nav = leafItem(project, decl, item.kind as Kind, item.name)
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
 * entry exposes as a recursive tree. Namespaces (TypeScript blocks and
 * `export * as foo from '…'` aliases) always become nested `NavItem`s
 * under their own name so the source structure survives in the sidebar.
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
 * Module/namespace chain ending in `id` — outermost first, the declaration
 * last. Used by the breadcrumb.
 */
export const ancestors = (project: docs.Project, id: number): docs.Declaration[] => {
  const target = project.declarationsById.get(id)
  if (!target) return []
  const out: docs.Declaration[] = [target]
  let cur: docs.Module | docs.Namespace | undefined =
    target.kind === 'module' || target.kind === 'namespace'
      ? target.parentModule
      : (docs.queriesOf(target)?.module as docs.Module | docs.Namespace | undefined)
  while (cur) {
    out.unshift(cur)
    cur = cur.parentModule
  }
  return out
}

// ============================================================================
// TREE BUILDING
// `buildChildren` walks a scope's `childDecls` into a NavItem tree.
// Modules/namespaces nest; `Exports` clauses splice each `(name, target)`
// pair into the parent — module targets become nested sub-trees keyed by
// the alias, leaf targets become leaves keyed by the alias.
// ============================================================================

const buildChildren = (scope: docs.Module | docs.Namespace, project: docs.Project): NavItem[] => {
  const out: NavItem[] = []
  const seen = new Set<number>()
  for (const child of scope.childDecls) addChild(child, project, out, seen)
  return out
}

const addChild = (child: docs.Declaration, project: docs.Project, out: NavItem[], seen: Set<number>): void => {
  if (child.kind === 'module') return addContainer(child, child.name ?? docs.displayNameOf(child), project, out, seen)
  if (child.kind === 'namespace') return addContainer(child, child.name, project, out, seen)
  if (child.kind === 'exports') return addExports(child, project, out, seen)
  if (!isRoutable(child.kind)) return
  if (seen.has(child.id)) return
  const nav = leafItem(project, child, child.kind as Kind)
  if (!nav) return
  seen.add(child.id)
  out.push(nav)
}

/** Attach a module / namespace as a nested NavItem keyed by `displayName`. */
const addContainer = (
  target: docs.Module | docs.Namespace,
  displayName: string,
  project: docs.Project,
  out: NavItem[],
  seen: Set<number>,
): void => {
  if (seen.has(target.id)) return
  seen.add(target.id)
  out.push({
    id: target.id,
    name: displayName,
    kind: target.kind as Kind,
    slug: project.slugById.get(target.id),
    comment: target.comment,
    children: sortByGroupThenName(buildChildren(target, project)),
  })
}

const addExports = (exp: docs.Exports, project: docs.Project, out: NavItem[], seen: Set<number>): void => {
  for (let i = 0; i < exp.names.length; i++) {
    const entry = exp.names[i]!
    const target = exp.targets[i]
    if (!target) continue
    if (target.kind === 'module' || target.kind === 'namespace') {
      addContainer(target, entry.name, project, out, seen)
      continue
    }
    if (!isRoutable(target.kind)) continue
    if (seen.has(target.id)) continue
    const nav = leafItem(project, target, target.kind as Kind, entry.name)
    if (!nav) continue
    seen.add(target.id)
    out.push(nav)
  }
}

const leafItem = (
  project: docs.Project,
  decl: docs.Declaration,
  kind: Kind,
  displayName?: string,
): NavItem | undefined => {
  const slug = project.slugById.get(decl.id)
  if (!slug) return undefined
  return {
    id: decl.id,
    name: displayName ?? docs.displayNameOf(decl),
    kind,
    slug,
    comment: decl.comment,
  }
}
