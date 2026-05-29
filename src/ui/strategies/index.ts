import * as docs from '../../core/client.ts'

import { isRoutable, pluralLabel, groupOrder, type Kind } from '../util/kind.ts'

export type NavItem = {
  id: number
  name: string
  /** Declaration kind. Absent for non-declaration items such as markdown pages. */
  kind?: Kind
  /** Set when the item routes to a declaration — used to build `/r/:slug`. */
  slug?: string
  /** Explicit link target. Wins over `slug`; used by markdown page items (`/p/:slug`). */
  href?: string
  /** Comment to display alongside the item — used by the home page surface list. */
  comment?: docs.Comment
  /** Nested children for module/namespace-style nodes that expose their own sub-tree. */
  children?: NavItem[]
}

export type NavGroup = {
  title: string
  /** Set when the group corresponds to a routable declaration (typically a module entrypoint). */
  slug?: string
  /** Explicit link target. Wins over `slug`; used by markdown page groups (`/p/:slug`). */
  href?: string
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
  items.sort(
    (a, b) =>
      groupOrder(pluralLabel(a.kind ?? '')) - groupOrder(pluralLabel(b.kind ?? '')) || a.name.localeCompare(b.name),
  )
  for (const it of items) if (it.children?.length) sortByGroupThenName(it.children)
  return items
}

const normPath = (p: string): string => p.replace(/^\.\//, '')

/**
 * Markdown pages from `project.pages` as top-level nav groups. Each page is
 * its own entry (a plain link, no children) linking to `/p/:slug`.
 */
export const pageGroups = (project: docs.Project): NavGroup[] =>
  (project.pages ?? []).map((p) => ({ title: p.label, href: `/p/${p.slug}`, items: [] }))

/**
 * One group per entry in `project.exports`. The group title is the export
 * module's display name (e.g. `ui`) and links to the export module's own page. Inside a
 * group, namespace re-exports nest as submenus (unless the target is itself
 * a top-level export — then a non-expanding leaf link), and declarations
 * appear as leaf links sorted by category then name.
 *
 * Multiple export entries that point at the same source file are
 * de-duplicated; the first occurrence wins.
 */
export const byExports: NavStrategy = (project) => {
  build(project)
  const out: NavGroup[] = []
  const seenPaths = new Set<string>()
  const moduleByPath = new Map<string, docs.Module>()
  for (const m of project.modules()) if (m.path) moduleByPath.set(normPath(m.path), m)

  // Modules that are themselves a package export — a namespace re-export
  // pointing at one of these renders as a leaf link rather than expanding.
  const exportIds = new Set<number>()
  for (const exp of project.exports) {
    const m = moduleByPath.get(normPath(exp.path))
    if (m) exportIds.add(m.id)
  }

  for (const exp of project.exports) {
    const key = normPath(exp.path)
    if (seenPaths.has(key)) continue
    const mod = moduleByPath.get(key)
    if (!mod) continue
    seenPaths.add(key)
    out.push({
      title: docs.displayNameOf(mod),
      slug: project.slugById.get(mod.id),
      items: buildChildren(mod, project, exportIds),
    })
  }
  return out
}

const build = (project: docs.Project) => {
  const top: NavItem[] = []
  for (const exp of project.exports) {
    const m = project.moduleByPath(normPath(exp.path))
    if (m) {
      top.push({
        id: m.id,
        name: docs.displayNameOf(m),
        kind: 'module',
        slug: m.path,
        // items: buildChildren(m, project, exportIds),
      })
    }
  }
  // console.log(project.exports, project.modulesByPath)
  console.log(top)
  // for (const child of project.children) {
  //   const c = project.declarationById(child)
  //   console.log(c)
  // }
}

/**
 * Default sidebar: markdown pages first (each a top-level link), then one
 * group per export module.
 */
export const auto: NavStrategy = (project) => [...pageGroups(project), ...byExports(project)]

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
// `buildChildren` walks a scope's `childDecls` into a NavItem tree:
//   - TS namespaces and `export * as foo` aliases nest as submenus, EXCEPT a
//     namespace re-export whose target is itself a top-level export, which
//     becomes a non-expanding leaf link (avoids duplicating its subtree).
//   - Plain declarations become leaf links to their own page.
// Leaves at each level are ordered by category (GROUP_ORDER) then name.
// ============================================================================

type Ctx = { project: docs.Project; exportIds: Set<number>; trail: Set<number> }

const buildChildren = (
  scope: docs.Module | docs.Namespace,
  project: docs.Project,
  exportIds: Set<number>,
  trail: Set<number> = new Set(),
): NavItem[] => {
  const ctx: Ctx = { project, exportIds, trail: new Set(trail).add(scope.id) }
  const out: NavItem[] = []
  const seen = new Set<number>()
  for (const child of scope.childDecls) addChild(child, ctx, out, seen)
  return sortByGroupThenName(out)
}

const addChild = (child: docs.Declaration, ctx: Ctx, out: NavItem[], seen: Set<number>): void => {
  if (child.kind === 'namespace') return addContainer(child, child.name, ctx, out, seen)
  if (child.kind === 'exports') return addExports(child, ctx, out, seen)
  if (isRoutable(child.kind)) addLeaf(child, child.kind as Kind, undefined, ctx, out, seen)
}

const addExports = (exp: docs.Exports, ctx: Ctx, out: NavItem[], seen: Set<number>): void => {
  for (let i = 0; i < exp.names.length; i++) {
    const entry = exp.names[i]!
    const target = exp.targets[i]
    if (!target) continue
    if (target.kind === 'module') {
      // `export * as foo from './x'` — leaf link when the target is itself a
      // top-level export, otherwise expand its members inline.
      if (ctx.exportIds.has(target.id)) addLeaf(target, 'namespace', entry.name, ctx, out, seen)
      else addContainer(target, entry.name, ctx, out, seen)
    } else if (target.kind === 'namespace') {
      addContainer(target, entry.name, ctx, out, seen)
    } else if (isRoutable(target.kind)) {
      addLeaf(target, target.kind as Kind, entry.name, ctx, out, seen)
    }
  }
}

/**
 * Attach a module / namespace as a nested submenu. Falls back to a leaf link
 * when the target is already on the current path (cycle) so mutual
 * `export * as` re-exports don't recurse forever.
 */
const addContainer = (
  target: docs.Module | docs.Namespace,
  displayName: string,
  ctx: Ctx,
  out: NavItem[],
  seen: Set<number>,
): void => {
  if (seen.has(target.id)) return
  seen.add(target.id)
  if (ctx.trail.has(target.id)) return void addLeaf(target, 'namespace', displayName, ctx, out, new Set())
  out.push({
    id: target.id,
    name: displayName,
    kind: 'namespace',
    slug: ctx.project.slugById.get(target.id),
    comment: target.comment,
    children: buildChildren(target, ctx.project, ctx.exportIds, ctx.trail),
  })
}

const addLeaf = (
  decl: docs.Declaration,
  kind: Kind,
  displayName: string | undefined,
  ctx: Ctx,
  out: NavItem[],
  seen: Set<number>,
): void => {
  if (seen.has(decl.id)) return
  const slug = ctx.project.slugById.get(decl.id)
  if (!slug) return
  seen.add(decl.id)
  out.push({ id: decl.id, name: displayName ?? docs.displayNameOf(decl), kind, slug, comment: decl.comment })
}

// const leafItem = (
//   project: docs.Project,
//   decl: docs.Declaration,
//   kind: Kind,
//   displayName?: string,
// ): NavItem | undefined => {
//   const slug = project.slugById.get(decl.id)
//   if (!slug) return undefined
//   return {
//     id: decl.id,
//     name: displayName ?? docs.displayNameOf(decl),
//     kind,
//     slug,
//     comment: decl.comment,
//   }
// }
