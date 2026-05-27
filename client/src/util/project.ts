import type * as docs from '@lickle/docs'

import { effectiveKind, isRoutable, pluralLabel, groupOrder, type Kind } from './kind.js'

export type NavItem = { id: number; name: string; kind: Kind; slug: string }
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

const moduleDisplayName = (mod: docs.Module): string => {
  if (mod.name) return mod.name
  if (mod.path) return stripExt(mod.path.split('/').pop() ?? mod.path)
  return '<anonymous>'
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
 * Routable declarations in stable group/name order. `re-export` and `enum-member`
 * never appear here.
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
 * Slug bookkeeping over the project. Built once per project lifetime;
 * reverse-indexed by `decl.$.referencedBy()` and friends are not needed here.
 */
export const buildSlugs = (project: docs.Project): Slugs => {
  const slugById = new Map<number, string>()
  const idBySlug = new Map<string, number>()
  const qualifiedNameById = new Map<number, string>()
  console.log(project)
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

const itemFor = (decl: docs.Declaration, slugById: Map<number, string>): NavItem | undefined => {
  if (!isRoutable(decl.kind)) return undefined
  const slug = slugById.get(decl.id)
  if (!slug) return undefined
  return {
    id: decl.id,
    name: (decl as { name?: string }).name ?? '',
    kind: effectiveKind(decl),
    slug,
  }
}

const sortByGroupThenName = (items: NavItem[]): NavItem[] =>
  items.sort(
    (a, b) => groupOrder(pluralLabel(a.kind)) - groupOrder(pluralLabel(b.kind)) || a.name.localeCompare(b.name),
  )

/**
 * Default kind-bucketed sidebar: every routable child of every top-level
 * module flattened into one group per `pluralLabel(effectiveKind)`.
 */
export const byKind: NavStrategy = (project, slugById) => {
  const buckets = new Map<string, NavItem[]>()
  for (const top of project.modules()) {
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
