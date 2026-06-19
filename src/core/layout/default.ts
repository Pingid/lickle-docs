import type * as Reflect from '../reflect/index.ts'
import * as Slug from '../../_lib/slug/index.ts'

import type { PageSource, Placement, Place, Nav, Parent } from './types.ts'
import type { DeclarationFacade } from './facade.ts'

/** What the base reads: the raw index plus project name. NOT LayoutContext — the base has no `default()`. */
export type BaseContext = { docs: Reflect.Index; name: string }

/**
 * The framework default: today's export-graph placement, as a {@link Placement}.
 * Total — always decides — so it's the floor of the compose chain, never deferring.
 *
 *  - markdown        → root page (home page pinned at `/`, others by slug)
 *  - export decls    → no page (plumbing)
 *  - entrypoints     → root, under their label
 *  - one exposer     → nested under it
 *  - many exposers   → bare name at root (build pass resolves collisions)
 *  - unexposed       → source-path placement
 */

export const defaultLayout = (source: PageSource, cx: BaseContext): Placement => {
  if (source.kind === 'markdown') return markdownPlacement(source)

  const d = source.decl
  if (d.kind === 'export') return { page: null }

  // Fetched ONCE — homeOf and the sidebar nav read the same exposer list.
  const by = cx.docs.exposedBy(d.id)
  return { page: homeOf(d, by, cx), nav: exposureNav(d, by, cx) }
}

// ─────────────────────────────────────────────────────────────────────────
// Markdown
// ─────────────────────────────────────────────────────────────────────────

/**
 * Home is exactly `slug: '/'` — explicit, so adding markdown pages never moves
 * the home page, and it always stays at the root. Any other markdown page nests
 * under its `folder` (a virtual sidebar folder) when given, else the root; its
 * slug is its own segment (the folder supplies the prefix), defaulting to a
 * slug derived from the title. `group`/`order` bucket and sort it in the sidebar.
 */
const markdownPlacement = (m: Extract<PageSource, { kind: 'markdown' }>): Placement => {
  if (m.slug === '/')
    return {
      page: { parent: { root: true }, name: m.title, slug: '/' },
      nav: [{ parent: { root: true }, name: m.title, order: m.order ?? 0 }],
    }

  const parent: Parent = m.folder ? { virtual: m.folder } : { root: true }
  const place: Place = { parent, name: m.title, slug: m.slug ?? Slug.toSlug(m.title) }
  const group = m.group ? { name: m.group } : undefined
  return { page: place, nav: [{ parent, name: m.title, group, order: m.order ?? 0 }] }
}

// ─────────────────────────────────────────────────────────────────────────
// Content home — replaces getSlug + getAlias (now ONE walk, can't disagree)
// ─────────────────────────────────────────────────────────────────────────

/** The single canonical location. `by` is the shared exposer list. */
const homeOf = (d: DeclarationFacade, by: Reflect.Exposure[], cx: BaseContext): Place => {
  if (d.isEntry()) return { parent: { root: true }, name: entryLabel(d, cx) }

  if (by.length === 1) {
    const e = by[0]!
    return { parent: { decl: e.exposer }, name: e.alias ?? d.name }
  }

  if (by.length > 1) {
    if (d.kind !== 'module') return { parent: { root: true }, name: d.name }
    const aliases = new Set(by.map((e) => e.alias))
    const [alias] = aliases
    if (aliases.size === 1 && alias !== undefined) return { parent: { root: true }, name: alias }
    return lexicalPlace(d, cx)
  }

  return lexicalPlace(d, cx)
}

/** Sidebar appearances from the exposure graph. Same `by`, so nav parents agree with home's parent by construction. */
const exposureNav = (d: DeclarationFacade, by: Reflect.Exposure[], cx: BaseContext): Nav[] => {
  const idx = d.entryIndex()
  // `1 + idx` so the home markdown page (order 0) always sorts first at root.
  if (typeof idx === 'number') return [{ parent: { root: true }, name: entryLabel(d, cx), order: 1 + idx }]

  if (by.length === 0) {
    const home = homeOf(d, by, cx)
    return [{ parent: home.parent, name: home.name }]
  }

  return by
    .filter((e) => cx.docs.get(e.exposer)?.kind !== 'export')
    .map((e) => ({ parent: { decl: e.exposer }, name: e.alias ?? d.name }))
}
// ─────────────────────────────────────────────────────────────────────────
// Naming helpers — direct lifts of base.ts
// ─────────────────────────────────────────────────────────────────────────

/** Entry label: `./config` → `config`, `.` → project name (old getAlias entry branch). */
const entryLabel = (d: DeclarationFacade, cx: BaseContext): string => {
  const as = d.entry()!.as
  return as.replace(/^\.\//, '').replace(/^\.$/, cx.name)
}

// ─────────────────────────────────────────────────────────────────────────
// Source-path placement — replaces lexicalSegments / lexicalSlug / pathSegments
// This is the seam where source paths meet virtual folders. Most likely to drift
// from current behavior — diff against the old output before trusting it.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Source-path placement as a {@link Place}: parent is the defining-parent chain
 * collapsed into a virtual folder of the source dir; name is the file/decl leaf.
 *
 * The dir lives on the parent, the leaf on `name` — no `slug` override: the
 * builder's parent-walk re-attaches the dir, so spelling the full path here too
 * would double it.
 */
const lexicalPlace = (d: DeclarationFacade, cx: BaseContext): Place => {
  const segs = lexicalSegments(cx, d.id)
  const name = segs[segs.length - 1] ?? d.name
  const dir = segs.slice(0, -1)
  // Folder identity is the joined dir; root-level leaves get a plain root parent.
  const parent: Parent = dir.length ? { virtual: dir.join('/') } : { root: true }
  return { parent, name }
}

export const lexicalSlug = (cx: Pick<BaseContext, 'docs'>, id: Reflect.Id): string => lexicalSegments(cx, id).join('/')

/** The defining-parent chain, file module down to the declaration (old lexicalSegments). */
export const lexicalSegments = (cx: Pick<BaseContext, 'docs'>, id: Reflect.Id): string[] => {
  const d = cx.docs.get(id)
  if (!d) return []
  const own = cx.docs.isRoot(id)
    ? pathSegments(cx, cx.docs.rootAlias(id)!.as)
    : d.kind === 'module'
      ? pathSegments(cx, (d as Reflect.Declaration<'module'>).path)
      : [d.name]
  const parent = cx.docs.get(d.parent) ? lexicalSegments(cx, d.parent) : []
  return [...parent, ...own]
}

/** Strip extension, drop `index`, strip the common dir prefix (old pathSegments, verbatim). */
const pathSegments = (cx: Pick<BaseContext, 'docs'>, path: string): string[] => {
  let segs = path
    .replace(/^\.\//, '')
    .replace(/\.\w+$/, '')
    .split('/')
  if (segs[segs.length - 1] === 'index') segs.pop()
  if (segs[segs.length - 1] === '.') segs[segs.length - 1] = ''
  const com = cx.docs.commonDir().split('/')
  while (com.length > 0 && segs.length > 0 && com[0] === segs[0]) {
    com.shift()
    segs.shift()
  }
  return segs
}
