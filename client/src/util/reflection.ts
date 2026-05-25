import { Kind, effectiveKind, groupOrder, isRoutable, labelOf } from './kind.js'
import { buildReferences, type Reference } from './references.js'
import type { JSONOutput } from 'typedoc'

type Decl = JSONOutput.DeclarationReflection
type Proj = JSONOutput.ProjectReflection

export type NavItem = { id: number; name: string; kind: number; slug: string }
export type NavGroup = { title: string; items: NavItem[] }

export type ReflectionIndex = {
  project: Proj
  byId: Map<number, Decl | Proj>
  parents: Map<number, number>
  slugById: Map<number, string>
  idBySlug: Map<string, number>
  /** `name` or `qualified.name` -> slug. Bare names resolve to the shallowest reflection. */
  slugByName: Map<string, string>
  /** id -> `parent.module.symbol` dotted path; populated for every reflection in `byId`. */
  qualifiedNameById: Map<number, string>
  /** `target id -> Reference[]` — every routable reflection that structurally references the target. */
  references: Map<number, Reference[]>
  navGroups: NavGroup[]
  routables: Decl[]
}

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')

const qualifiedName = (parents: Map<number, number>, byId: Map<number, Decl | Proj>, id: number): string => {
  const parts: string[] = []
  let cur: number | undefined = id
  while (cur != null) {
    const r = byId.get(cur)
    if (!r || r.kind === Kind.Project) break
    parts.unshift(r.name)
    cur = parents.get(cur)
  }
  return parts.join('.')
}

export const buildIndex = (project: Proj): ReflectionIndex => {
  const byId = new Map<number, Decl | Proj>()
  const parents = new Map<number, number>()

  const walk = (node: Decl | Proj, parent?: number) => {
    byId.set(node.id, node)
    if (parent != null) parents.set(node.id, parent)
    const children = (node as Decl).children
    if (children) for (const c of children) walk(c, node.id)
  }
  walk(project)

  const routables: Decl[] = []
  for (const r of byId.values()) {
    if (r.id === project.id) continue
    if (isRoutable(r.kind)) routables.push(r as Decl)
  }
  routables.sort(
    (a, b) =>
      groupOrder(pluralLabel(effectiveKind(a))) - groupOrder(pluralLabel(effectiveKind(b))) ||
      a.name.localeCompare(b.name),
  )

  const qualifiedNameById = new Map<number, string>()
  for (const r of byId.values()) {
    if (r.id === project.id) continue
    qualifiedNameById.set(r.id, qualifiedName(parents, byId, r.id) || r.name)
  }

  const slugById = new Map<number, string>()
  const idBySlug = new Map<string, number>()
  for (const r of routables) {
    const qn = qualifiedNameById.get(r.id) ?? r.name
    let slug = toSlug(qn)
    let n = 2
    let base = slug
    while (idBySlug.has(slug)) slug = `${base}-${n++}`
    slugById.set(r.id, slug)
    idBySlug.set(slug, r.id)
  }

  const slugByName = buildNameLookup(routables, slugById, qualifiedNameById)
  const references = buildReferences(project, parents, (id) => slugById.has(id))
  const navGroups = buildNavGroups(project, byId, slugById)

  return {
    project,
    byId,
    parents,
    slugById,
    idBySlug,
    slugByName,
    qualifiedNameById,
    references,
    navGroups,
    routables,
  }
}

/** Map both qualified (`config.lib.read`) and bare (`read`) names to slugs. Bare names prefer the shallowest match. */
const buildNameLookup = (
  routables: Decl[],
  slugById: Map<number, string>,
  qualifiedNameById: Map<number, string>,
): Map<string, string> => {
  const out = new Map<string, string>()
  const bare: { name: string; depth: number; slug: string }[] = []
  for (const r of routables) {
    const slug = slugById.get(r.id)
    if (!slug) continue
    const qn = qualifiedNameById.get(r.id) ?? r.name
    out.set(qn, slug)
    bare.push({ name: r.name, depth: qn.split('.').length, slug })
  }
  bare.sort((a, b) => a.depth - b.depth)
  for (const { name, slug } of bare) if (!out.has(name)) out.set(name, slug)
  return out
}

const buildNavGroups = (project: Proj, byId: Map<number, Decl | Proj>, slugById: Map<number, string>): NavGroup[] => {
  const mkItem = (id: number): NavItem | null => {
    const r = byId.get(id) as Decl | undefined
    const slug = slugById.get(id)
    if (!r || !slug) return null
    return { id, name: r.name, kind: effectiveKind(r), slug }
  }

  const sorted = (groups: NavGroup[]): NavGroup[] =>
    groups.sort((a, b) => groupOrder(a.title) - groupOrder(b.title) || a.title.localeCompare(b.title))

  // Prefer categories, then groups, both come from project root.
  if (project.categories?.length) {
    const groups: NavGroup[] = []
    for (const cat of project.categories) {
      const items = (cat.children ?? []).map(mkItem).filter((v): v is NavItem => !!v)
      if (items.length) groups.push({ title: cat.title, items })
    }
    if (groups.length) return sorted(groups)
  }
  if (project.groups?.length) {
    const groups: NavGroup[] = []
    for (const g of project.groups) {
      const items = (g.children ?? []).map(mkItem).filter((v): v is NavItem => !!v)
      if (items.length) groups.push({ title: g.title, items })
    }
    if (groups.length) return sorted(groups)
  }

  // Fallback: bucket by kind label.
  const buckets = new Map<string, NavItem[]>()
  for (const r of project.children ?? []) {
    const it = mkItem(r.id)
    if (!it) continue
    const key = pluralLabel(it.kind)
    const arr = buckets.get(key) ?? []
    arr.push(it)
    buckets.set(key, arr)
  }
  return sorted(
    [...buckets.entries()].map(([title, items]) => ({
      title,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    })),
  )
}

const pluralLabel = (kind: number): string => {
  const l = labelOf(kind)
  if (l.endsWith('s')) return l
  if (l === 'class') return 'classes'
  return l + 's'
}

export const ancestors = (idx: ReflectionIndex, id: number): (Decl | Proj)[] => {
  const out: (Decl | Proj)[] = []
  let cur: number | undefined = id
  while (cur != null) {
    const r = idx.byId.get(cur)
    if (!r) break
    out.unshift(r)
    cur = idx.parents.get(cur)
  }
  return out
}
