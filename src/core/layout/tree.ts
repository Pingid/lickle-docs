import type {
  Layout,
  LayoutContext,
  PageSource,
  Placement,
  Parent,
  Nav,
  Group,
  SidebarNode,
  GroupedItems,
  Alias,
  ResolvedAlias,
} from './types.ts'
import { defaultLayout, lexicalSegments, type BaseContext } from './default.ts'
import type { Diagnostic } from '../diagnostic/types.ts'
import type * as Reflect from '../reflect/index.ts'
import * as Slug from '../../_lib/slug/index.ts'
import { groupItems } from './group.ts'

export type Resolved = { source: PageSource; placement: Placement; id: Reflect.Id | null; slug: string }

export type Tree = {
  resolved: Resolved[]
  slugOf: Map<Reflect.Id, string>
  sidebar: GroupedItems<SidebarNode>[]
  aliases: ResolvedAlias[]
}

export const buildTree = (
  sources: PageSource[],
  layout: Layout,
  baseCx: BaseContext,
  emit: (d: Diagnostic) => void,
): Tree => {
  // ── Phase 1: run the layout for every source ──────────────────────────
  const resolved: Resolved[] = []
  const cx: LayoutContext = { default: () => ({ page: null }) } // default patched per-source below
  for (const source of sources) {
    const base = () => defaultLayout(source, baseCx)
    const placement = layout(source, { ...cx, default: base }) ?? base()
    const id = source.kind === 'doc' ? source.decl.id : null
    if (placement.page !== null) resolved.push({ source, placement, id, slug: '' })
  }

  // ── Phase 2: index placed nodes by declaration id ─────────────────────
  const byId = new Map<Reflect.Id, Resolved>()
  for (const r of resolved) if (r.id !== null) byId.set(r.id, r)

  // ── Phase 3: CONTENT tree — slug for each node by walking parents ──────
  // Memoized; the visiting-set here is the cycle guard homeOf no longer needs.
  const slugCache = new Map<Reflect.Id, string[]>()
  const visiting = new Set<Reflect.Id>()

  const contentSegments = (r: Resolved): string[] => {
    if (r.id !== null) {
      const hit = slugCache.get(r.id)
      if (hit) return hit
      if (visiting.has(r.id)) {
        // CONTENT CYCLE: A's home parent is B, B's is A. Diagnosable, not infinite.
        emit({
          level: 'warn',
          code: 'content-cycle',
          source: describe(r.source),
          message: `Content-tree cycle at ${describe(r.source)} → falling back to source path. Check re-export loops feeding home placement.`,
        })
        return lexicalFallback(r, baseCx)
      }
      visiting.add(r.id)
    }
    const place = r.placement.page! // non-null: excluded nodes filtered in phase 1
    const own = place.slug ? [place.slug] : [Slug.toSlug(place.name)]
    const parentSegs = parentContentSegments(place.parent, describe(r.source))
    if (r.id !== null) {
      visiting.delete(r.id)
      const out = [...parentSegs, ...own]
      slugCache.set(r.id, out)
      return out
    }
    return [...parentSegs, ...own]
  }

  const parentContentSegments = (parent: Parent, childLabel: string): string[] => {
    if ('root' in parent) return []
    if ('virtual' in parent) return parent.virtual.split('/').map(Slug.toSlug)
    const pr = byId.get(parent.decl)
    if (!pr) {
      // Parent didn't survive (excluded / never placed): the child detaches to
      // root rather than dangling.
      emit({
        level: 'warn',
        code: 'missing-parent',
        source: childLabel,
        message: `Parent declaration ${parent.decl} of ${childLabel} was not placed; attaching to root.`,
      })
      return []
    }
    return contentSegments(pr)
  }

  // ── Phase 4: resolve slugs, relocating collisions symmetrically ────────
  // Compute every candidate slug, then: when 2+ declarations claim one slug,
  // ALL of them fall back to source paths. Symmetric and order-independent —
  // adding an unrelated export never churns a surviving bare slug.
  const candidate = new Map<Resolved, string>()
  for (const r of resolved) candidate.set(r, Slug.normalize(contentSegments(r).join('/')))

  const claimants = new Map<string, Resolved[]>()
  for (const r of resolved)
    if (r.id !== null) {
      const s = candidate.get(r)!
      const list = claimants.get(s)
      if (list) list.push(r)
      else claimants.set(s, [r])
    }

  const slugOf = new Map<Reflect.Id, string>()
  const reported = new Set<string>()
  for (const r of resolved) {
    let slug = candidate.get(r)!
    const group = r.id !== null ? claimants.get(slug) : undefined
    if (group && group.length > 1) {
      if (!reported.has(slug)) {
        reported.add(slug)
        emit({
          level: 'warn',
          code: 'slug-collision',
          message: `Slug collision '${slug}' among declarations ${group
            .map((g) => g.id)
            .join(', ')}; all fall back to source paths. Set Place.slug or place them under different parents.`,
        })
      }
      slug = Slug.normalize(lexicalFallback(r, baseCx).join('/'))
    }
    if (r.id !== null) slugOf.set(r.id, slug)
    r.slug = slug
  }

  // ── Phase 5: aliases — secondary slugs pointing at a canonical node ────
  const aliasSlug = (a: Alias): string => {
    const own = a.slug ? [a.slug] : [Slug.toSlug(a.name)]
    return Slug.normalize([...parentContentSegments(a.parent, `alias "${a.name}"`), ...own].join('/'))
  }
  const aliases: ResolvedAlias[] = []
  for (const r of resolved)
    for (const a of r.placement.aliases ?? [])
      aliases.push({ slug: aliasSlug(a), target: r.id ?? undefined, canonical: r.slug, mode: a.mode ?? 'redirect' })

  // ── Phase 6: NAV tree ──────────────────────────────────────────────────
  return { resolved, slugOf, aliases, sidebar: buildSidebar(resolved, slugOf, emit) }
}

const buildSidebar = (
  resolved: Resolved[],
  slugOf: Map<Reflect.Id, string>,
  emit: (d: Diagnostic) => void,
): GroupedItems<SidebarNode>[] => {
  const keyOf = (p: Parent): string => ('root' in p ? 'root' : 'virtual' in p ? `v:${p.virtual}` : `d:${p.decl}`)

  // ── Virtual folders materialize from the `{ virtual }` parents the layout
  //    composes — there is no folder config. A `/` nests (`guides/advanced`
  //    puts "advanced" under "guides", creating "guides" too); the label is the
  //    last path segment. ──
  type Folder = { ref: string; label: string; parent: Parent }
  const folders = new Map<string, Folder>()
  const ensureFolder = (ref: string): void => {
    if (folders.has(ref)) return
    const slash = ref.lastIndexOf('/')
    const parent: Parent = slash >= 0 ? { virtual: ref.slice(0, slash) } : { root: true }
    folders.set(ref, { ref, label: slash >= 0 ? ref.slice(slash + 1) : ref, parent })
    if (slash >= 0) ensureFolder(ref.slice(0, slash)) // materialize ancestors
  }

  // ── Collect child edges under each parent key: docs and markdown pages
  //    (from nav, carrying a `nav`) and folders (carrying a `folder`). ──
  type DocEdge = { kind: 'doc'; child: Reflect.Id; nav: Nav }
  type PageEdge = { kind: 'page'; slug: string; nav: Nav }
  type FolderEdge = { kind: 'folder'; folder: Folder }
  type Edge = DocEdge | PageEdge | FolderEdge

  const childrenOf = new Map<string, Edge[]>()
  const push = (parentKey: string, edge: Edge) => {
    const list = childrenOf.get(parentKey)
    if (list) list.push(edge)
    else childrenOf.set(parentKey, [edge])
  }

  // Doc/page edges from every placement's effective nav. Only `render: 'page'`
  // declarations get a sidebar entry — `inline`/`hidden` carry no route.
  const seen = new Set<string>()
  for (const r of resolved) {
    const render = r.placement.page?.render ?? 'page'
    for (const nav of effectiveNav(r.placement)) {
      // Touching a virtual parent makes that folder (and its ancestors) exist.
      if ('virtual' in nav.parent) ensureFolder(nav.parent.virtual)
      if (r.id !== null) {
        // Dedupe by (parent, child): a declaration exposed twice under the SAME
        // parent (e.g. `export * from './m'` plus `export * as M from './m'` in
        // one file) must list once. Exposure under DIFFERENT parents is kept.
        const k = `${keyOf(nav.parent)}\0${r.id}`
        if (render === 'page' && !seen.has(k)) {
          seen.add(k)
          push(keyOf(nav.parent), { kind: 'doc', child: r.id, nav })
        }
      } else if (r.source.kind === 'markdown') push(keyOf(nav.parent), { kind: 'page', slug: r.slug, nav })
    }
  }

  // Folder edges: each folder attaches under its (possibly virtual) parent.
  // After the loop above so ancestor folders created during nesting are included.
  for (const folder of folders.values()) push(keyOf(folder.parent), { kind: 'folder', folder })

  const groupOf = (e: Edge): Group | undefined => ('nav' in e ? e.nav.group : undefined)
  const orderOf = (e: Edge): number => ('nav' in e ? (e.nav.order ?? 0) : 0)
  // A node contributes its alias to the namespace qualifier when it is a
  // namespace or an `export * as X` re-export — both modelled here as a
  // non-entrypoint container. Entrypoints (top-level modules) do NOT qualify:
  // their members are the public surface, shown unqualified.
  const qualifies = new Map<Reflect.Id, boolean>()
  for (const r of resolved)
    if (r.id !== null && r.source.kind === 'doc') {
      const d = r.source.decl
      qualifies.set(r.id, (d.kind === 'module' || d.kind === 'namespace') && !d.isEntry())
    }

  // ── Descend. `path` guards cycles across doc, page and folder keys.
  //    `qualifier` is the dotted chain of namespace-ancestor aliases — it
  //    accumulates only across namespace / `export * as X` parents and resets
  //    at entrypoints and folders, so a node shows `Reflect.Module` when exposed
  //    inside the `Reflect` namespace but plain `Module` when exposed directly
  //    under an entrypoint module. ──
  type Built = { edge: Edge; node: SidebarNode }

  const node = (edge: Edge, path: Set<string>, qualifier?: string): Built | null => {
    const self =
      edge.kind === 'doc' ? `d:${edge.child}` : edge.kind === 'page' ? `p:${edge.slug}` : `v:${edge.folder.ref}`
    if (path.has(self)) {
      emit({
        level: 'warn',
        code: 'sidebar-cycle',
        message:
          edge.kind === 'folder'
            ? `Sidebar cycle through folder "${edge.folder.ref}"; dropping this edge.`
            : `Sidebar cycle through ${edge.kind === 'doc' ? `declaration ${edge.child}` : `page "${edge.slug}"`}; dropping this edge.`,
      })
      return null
    }
    const next = new Set(path).add(self)

    if (edge.kind === 'folder') {
      const children = descend(self, next, undefined) // folders don't qualify display
      // Drop empty folders — a section header with nothing under it is noise.
      if (children.every((g) => g.items.length === 0)) return null
      return { edge, node: { kind: 'folder', ref: edge.folder.ref, label: edge.folder.label, children } }
    }

    if (edge.kind === 'page') {
      return {
        edge,
        node: { kind: 'page', slug: edge.slug, label: edge.nav.name, children: descend(self, next, undefined) },
      }
    }

    const label = edge.nav.name
    // Display is qualified only when there's a namespace ancestor. The chain
    // extends past this node only if this node is itself a namespace container.
    const display = qualifier === undefined ? undefined : `${qualifier}.${label}`
    const childQualifier = qualifies.get(edge.child)
      ? qualifier === undefined
        ? label
        : `${qualifier}.${label}`
      : undefined
    const children = descend(self, next, childQualifier)
    // Drop empty modules/namespaces — a container with no surviving members is
    // noise (mirrors the empty-folder prune above). `qualifies` is already
    // exactly "(module|namespace) && !isEntry()", so leaf declarations and
    // entrypoints are never pruned, and the cascade is bottom-up for free.
    if (qualifies.get(edge.child) && children.every((g) => g.items.length === 0)) return null
    return {
      edge,
      node: { kind: 'doc', id: edge.child, slug: slugOf.get(edge.child) ?? '', label, display, children },
    }
  }

  const descend = (parentKey: string, path: Set<string>, qualifier?: string): GroupedItems<SidebarNode>[] =>
    group((childrenOf.get(parentKey) ?? []).map((e) => node(e, path, qualifier)).filter(nonNull))

  // Bucket by the edge's group, then sort within a bucket by explicit `order`,
  // falling back to alphabetical by label — so members read A–Z by default and
  // an explicit `Nav.order` (e.g. from `Layout.order`) pins specific entries.
  const group = (built: (Built | null)[]): GroupedItems<SidebarNode>[] => {
    const real = built.filter(nonNull)
    return groupItems(real, (b) => groupOf(b.edge)).map((g) => ({
      group: g.group,
      items: g.items
        .sort((a, b) => orderOf(a.edge) - orderOf(b.edge) || a.node.label.localeCompare(b.node.label))
        .map((b) => b.node),
    }))
  }

  return descend('root', new Set(), undefined)
}

const nonNull = <T>(x: T | null): x is T => x !== null

/**
 * A placement's effective sidebar entries: explicit `nav`, or a single entry
 * derived from its page. The one canonical helper — `LayoutContext` no longer
 * carries a `navOf`; presets import this directly.
 */
export const effectiveNav = (p: Placement): Nav[] => {
  if (p.nav !== undefined) return p.nav
  if (p.page === null) return []
  return [{ parent: p.page.parent, name: p.page.name }]
}

/** Human label for a source, used in diagnostics. */
const describe = (s: PageSource): string =>
  s.kind === 'markdown' ? `markdown "${s.title}"` : `${s.decl.kind} "${s.decl.name}"`

/** Source-path segments as the collision/cycle fallback (mirrors old lexicalSegments). */
const lexicalFallback = (r: Resolved, cx: BaseContext): string[] =>
  r.id !== null ? lexicalSegments(cx, r.id) : [Slug.toSlug((r.placement.page ?? { name: 'page' }).name ?? 'page')]
