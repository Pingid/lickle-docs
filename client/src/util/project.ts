import type * as docs from '@lickle/docs'

import { effectiveKind, isRoutable, pluralLabel, groupOrder, type Kind } from './kind.js'

export type NavItem = {
  id: number
  name: string
  kind: Kind
  slug: string
  /** Comment to display alongside the item — used by the home page surface list. */
  comment?: docs.Comment
}
export type NavGroup = { title: string; items: NavItem[] }

/** Pluggable sidebar grouping. Take a project + slug index, return groups. */
export type NavStrategy = (project: docs.Project, slugById: Map<number, string>) => NavGroup[]

export type Slugs = {
  slugById: Map<number, string>
  idBySlug: Map<string, number>
  /** `name` or qualified path → slug. Bare names resolve to the shallowest match. */
  slugByName: Map<string, string>
  /** id → dotted qualified name (e.g. `models.User`). */
  qualifiedNameById: Map<number, string>
}

const stripExt = (s: string): string => s.replace(/\.[^./]+$/, '')

/**
 * Display name for a module. When the file is `…/<dir>/index.ts(x|js|mjs)`,
 * use the containing directory rather than the generic `index` so slugs read
 * `micro`, `util`, … instead of `index`, `index-2`, `index-3`.
 */
const moduleDisplayName = (mod: docs.Module): string => {
  if (mod.name && mod.name !== 'index') return mod.name
  if (mod.path) {
    const parts = mod.path.split('/')
    const last = stripExt(parts[parts.length - 1] ?? '')
    if (last === 'index' && parts.length > 1) return parts[parts.length - 2]!
    return last
  }
  return mod.name ?? '<anonymous>'
}

/**
 * Walk `mod.parentModule` up to the top-level module, producing a list of
 * display names from outermost to innermost.
 */
const modulePrefix = (mod: docs.Module): string[] => {
  const parts: string[] = []
  let cur: docs.Module | undefined = mod
  while (cur) {
    parts.unshift(moduleDisplayName(cur))
    cur = cur.parentModule
  }
  return parts
}

const isAnonymousModule = (mod: docs.Module): boolean => !mod.name && !mod.path

const moduleOf = (decl: docs.Declaration): docs.Module => (decl as { $: { module: docs.Module } }).$.module

/** A namespace re-export — `export * as foo from './x'` — stands in for a module. */
export const isNamespaceReExport = (decl: docs.Declaration): decl is docs.ReExport =>
  decl.kind === 're-export' && (decl as docs.ReExport).as != null

/**
 * `models.User`, `Foo.Bar`, etc. Module declarations qualify to their own
 * path; non-module declarations qualify to `<module>.<decl.name>`.
 */
export const qualifyDecl = (decl: docs.Declaration): string => {
  const mod = moduleOf(decl)
  const parts = isAnonymousModule(mod) ? [] : modulePrefix(mod)
  if (decl.kind === 'module') return parts.join('.')
  const name = (decl as { name?: string }).name
  if (name) parts.push(name)
  return parts.join('.')
}

const toSlug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')

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
  out.sort((a, b) => {
    const ka = effectiveKind(a)
    const kb = effectiveKind(b)
    return groupOrder(pluralLabel(ka)) - groupOrder(pluralLabel(kb)) || compareNames(a, b)
  })
  return out
}

const compareNames = (a: docs.Declaration, b: docs.Declaration): number => {
  const an = (a as { name?: string }).name ?? ''
  const bn = (b as { name?: string }).name ?? ''
  return an.localeCompare(bn)
}

/**
 * Top-level modules pointed to by `project.entrypoints`. Falls back to every
 * top-level module when the field is empty so projects without a published
 * entrypoint still get a sensible sidebar.
 */
const entrypointModules = (project: docs.Project): docs.Module[] => {
  const byPath = new Map<string, docs.Module>()
  for (const m of project.modules()) if (m.path) byPath.set(m.path, m)
  const matched = (project.entrypoints ?? [])
    .map((p) => byPath.get(p))
    .filter((m): m is docs.Module => m != null)
  return matched.length ? matched : (project.modules() as docs.Module[])
}

/**
 * Translate any module child to a nav item. Namespace re-exports become
 * `module`-kind items pointing at `sourceModuleRef`. Non-routable children
 * (anonymous re-exports, members, …) return undefined.
 */
const itemFor = (decl: docs.Declaration, slugById: Map<number, string>): NavItem | undefined => {
  if (isNamespaceReExport(decl)) {
    const target = decl.sourceModuleRef
    const slug = target ? slugById.get(target.id) : undefined
    if (!target || !slug) return undefined
    return {
      id: target.id,
      name: decl.as!,
      kind: 'module',
      slug,
      comment: decl.comment ?? target.comment,
    }
  }
  if (!isRoutable(decl.kind)) return undefined
  const slug = slugById.get(decl.id)
  if (!slug) return undefined
  return {
    id: decl.id,
    name: (decl as { name?: string }).name ?? '',
    kind: effectiveKind(decl),
    slug,
    comment: decl.comment,
  }
}

/**
 * Slug bookkeeping over the project. Built once per project lifetime;
 * reverse-indexed by `decl.$.referencedBy()` and friends are not needed here.
 */
export const buildSlugs = (project: docs.Project): Slugs => {
  const slugById = new Map<number, string>()
  const idBySlug = new Map<string, number>()
  const qualifiedNameById = new Map<number, string>()

  for (const d of project.declarationsById.values()) {
    qualifiedNameById.set(d.id, qualifyDecl(d) || (d as { name?: string }).name || String(d.id))
  }

  for (const d of project.declarationsById.values()) {
    if (!isRoutable(d.kind)) continue
    const qn = qualifiedNameById.get(d.id) ?? (d as { name?: string }).name ?? String(d.id)
    let slug = toSlug(qn) || `r-${d.id}`
    let n = 2
    const base = slug
    while (idBySlug.has(slug)) slug = `${base}-${n++}`
    slugById.set(d.id, slug)
    idBySlug.set(slug, d.id)
  }

  const slugByName = buildNameLookup(project, slugById, qualifiedNameById)
  return { slugById, idBySlug, slugByName, qualifiedNameById }
}

const buildNameLookup = (
  project: docs.Project,
  slugById: Map<number, string>,
  qualifiedNameById: Map<number, string>,
): Map<string, string> => {
  const out = new Map<string, string>()
  const bare: { name: string; depth: number; slug: string }[] = []
  for (const d of project.declarationsById.values()) {
    const slug = slugById.get(d.id)
    if (!slug) continue
    const name = (d as { name?: string }).name
    if (!name) continue
    const qn = qualifiedNameById.get(d.id) ?? name
    out.set(qn, slug)
    bare.push({ name, depth: qn.split('.').length, slug })
  }
  bare.sort((a, b) => a.depth - b.depth)
  for (const { name, slug } of bare) if (!out.has(name)) out.set(name, slug)
  return out
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
export const surface = (project: docs.Project, slugById: Map<number, string>): NavItem[] => {
  const out: NavItem[] = []
  const seen = new Set<number>()
  for (const top of entrypointModules(project)) {
    for (const child of top.children) {
      const item = itemFor(child, slugById)
      if (!item || seen.has(item.id)) continue
      seen.add(item.id)
      out.push(item)
    }
  }
  return sortByGroupThenName(out)
}

/**
 * Default kind-bucketed sidebar: every routable child of every entrypoint
 * module flattened into one group per `pluralLabel(effectiveKind)`. Namespace
 * re-exports land in the `modules` bucket and link to their source module.
 */
export const byKind: NavStrategy = (project, slugById) => {
  const buckets = new Map<string, NavItem[]>()
  for (const top of entrypointModules(project)) {
    for (const child of top.children) {
      const item = itemFor(child, slugById)
      if (!item) continue
      const title = pluralLabel(item.kind)
      const arr = buckets.get(title) ?? []
      arr.push(item)
      buckets.set(title, arr)
    }
  }
  return [...buckets.entries()]
    .map(([title, items]) => ({ title, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => groupOrder(a.title) - groupOrder(b.title) || a.title.localeCompare(b.title))
}

/**
 * One group per `project.exports` entry. Each group lists the routable
 * children of that export's source module, ordered by kind then name. Useful
 * for multi-entrypoint packages where the export name is the unit users care
 * about (`.`, `./micro`, `./types`, …).
 */
export const byExports: NavStrategy = (project, slugById) => {
  const modulesByPath = new Map<string, docs.Module>()
  for (const m of project.modules()) if (m.path) modulesByPath.set(m.path, m)

  const out: NavGroup[] = []
  for (const exp of project.exports) {
    const mod = modulesByPath.get(exp.path)
    if (!mod) continue
    const items: NavItem[] = []
    for (const child of mod.children) {
      const item = itemFor(child, slugById)
      if (item) items.push(item)
    }
    if (items.length) out.push({ title: exp.name, items: sortByGroupThenName(items) })
  }
  return out
}

/**
 * Pick a sensible default per project: `byExports` when the package surfaces
 * more than one entrypoint, otherwise the flat `byKind` view.
 */
export const auto: NavStrategy = (project, slugById) =>
  project.exports.length > 1 ? byExports(project, slugById) : byKind(project, slugById)

/**
 * Module chain ending in `id` — outermost module first, the declaration last.
 * Used by the breadcrumb.
 */
export const ancestors = (project: docs.Project, id: number): docs.Declaration[] => {
  const target = project.declarationsById.get(id)
  if (!target) return []
  const out: docs.Declaration[] = [target]
  let cur: docs.Module | undefined = target.kind === 'module' ? target.parentModule : moduleOf(target)
  while (cur) {
    out.unshift(cur)
    cur = cur.parentModule
  }
  return out
}
