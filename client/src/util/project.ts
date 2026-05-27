import type { index } from '@lickle/docs'

import { effectiveKind, isRoutable, pluralLabel, groupOrder, type Kind } from './kind.js'

export type NavItem = { id: number; name: string; kind: Kind; slug: string }
export type NavGroup = { title: string; items: NavItem[] }

export type Slugs = {
  slugById: Map<number, string>
  idBySlug: Map<string, number>
  /** `name` or qualified path → slug. Bare names resolve to the shallowest match. */
  slugByName: Map<string, string>
  /** id → dotted qualified name (e.g. `models.User`). */
  qualifiedNameById: Map<number, string>
}

const stripExt = (s: string): string => s.replace(/\.[^./]+$/, '')

const moduleDisplayName = (mod: index.Module): string => {
  if (mod.name) return mod.name
  if (mod.path) return stripExt(mod.path.split('/').pop() ?? mod.path)
  return '<anonymous>'
}

/**
 * Walk `mod.parentModule` up to the top-level module, producing a list of
 * display names from outermost to innermost.
 */
const modulePrefix = (mod: index.Module): string[] => {
  const parts: string[] = []
  let cur: index.Module | undefined = mod
  while (cur) {
    parts.unshift(moduleDisplayName(cur))
    cur = cur.parentModule
  }
  return parts
}

const isAnonymousModule = (mod: index.Module): boolean => !mod.name && !mod.path

const moduleOf = (decl: index.Declaration): index.Module =>
  (decl as { $: { module: index.Module } }).$.module

/**
 * `models.User`, `Foo.Bar`, etc. Module declarations qualify to their own
 * path; non-module declarations qualify to `<module>.<decl.name>`.
 */
export const qualifyDecl = (decl: index.Declaration): string => {
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
export const routables = (project: index.Project): index.Declaration[] => {
  const out: index.Declaration[] = []
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

const compareNames = (a: index.Declaration, b: index.Declaration): number => {
  const an = (a as { name?: string }).name ?? ''
  const bn = (b as { name?: string }).name ?? ''
  return an.localeCompare(bn)
}

/**
 * Slug bookkeeping over the project. Built once per project lifetime;
 * reverse-indexed by `decl.$.referencedBy()` and friends are not needed here.
 */
export const buildSlugs = (project: index.Project): Slugs => {
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
  project: index.Project,
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

/**
 * Top-level navigation buckets, one group per `pluralLabel(kind)`. Children of
 * every top-level module are flattened — there's no per-module sub-grouping in
 * the sidebar today.
 */
export const buildNavGroups = (project: index.Project, slugById: Map<number, string>): NavGroup[] => {
  const buckets = new Map<string, NavItem[]>()
  for (const top of project.children) {
    for (const child of top.children) {
      if (!isRoutable(child.kind)) continue
      const slug = slugById.get(child.id)
      if (!slug) continue
      const k = effectiveKind(child)
      const item: NavItem = { id: child.id, name: (child as { name?: string }).name ?? '', kind: k, slug }
      const title = pluralLabel(k)
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
 * Module chain ending in `id` — outermost module first, the declaration last.
 * Used by the breadcrumb.
 */
export const ancestors = (project: index.Project, id: number): index.Declaration[] => {
  const target = project.declarationsById.get(id)
  if (!target) return []
  const out: index.Declaration[] = [target]
  let cur: index.Module | undefined = target.kind === 'module' ? target.parentModule : moduleOf(target)
  while (cur) {
    out.unshift(cur)
    cur = cur.parentModule
  }
  return out
}
