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
  Refine,
  Rank,
} from './types.ts'
import { defaultLayout, lexicalSegments, type BaseContext } from './default.ts'
import type { Diagnostic } from '../diagnostic/types.ts'
import type * as Reflect from '../reflect/index.ts'
import * as Slug from '../../_lib/slug/index.ts'
import { groupItems, compareRank, minRank } from './client.ts'

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
  refine?: Refine,
): Tree => {
  // ── Phase 1: run the layout for every source ──────────────────────────
  const resolved: Resolved[] = []
  for (const source of sources) {
    const placement = placeOne(source, layout, baseCx)
    const id = source.kind === 'doc' ? source.decl.id : null
    if (placement.page !== null) resolved.push({ source, placement, id, slug: '' })
  }

  // ── Phase 1b: the whole-set pass ───────────────────────────────────────
  // Layers see one source at a time by design; `refine` is the one place a
  // decision may depend on what everything else resolved to. It runs before any
  // slug is computed, so relocating a node here still produces a correct URL.
  if (refine) {
    const nodes = resolved.map((r) => ({ source: r.source, placement: r.placement, id: r.id }))
    const next = refine(nodes, { index: baseCx.docs, name: baseCx.name }) ?? nodes
    resolved.length = 0
    for (const n of next) if (n.placement.page !== null) resolved.push({ ...n, slug: '' })
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
  const settled = new Map<Resolved, string>()
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
    settled.set(r, slug)
  }

  // The source-path fallback can itself collide — `export const select` and
  // `export type Select` in one file both slugify to `…/select`. Case used to
  // separate them by accident, which is no separation at all on a
  // case-insensitive host (or filesystem, for the generated `.md` files). Give
  // each a kind suffix, and the id if even that repeats.
  const byFallback = new Map<string, Resolved[]>()
  for (const [r, slug] of settled) {
    const list = byFallback.get(slug)
    if (list) list.push(r)
    else byFallback.set(slug, [r])
  }
  const kindOf = (r: Resolved): string => (r.source.kind === 'doc' ? r.source.decl.kind : r.source.kind)
  const taken = new Set(settled.values())
  for (const [slug, group] of byFallback) {
    if (group.length < 2) continue
    // Two of the same kind can't be told apart by kind, so those take the id.
    const perKind = new Map<string, number>()
    for (const r of group) perKind.set(kindOf(r), (perKind.get(kindOf(r)) ?? 0) + 1)
    for (const r of group) {
      const kind = kindOf(r)
      let next = `${slug}-${Slug.toSlug(kind)}`
      if ((perKind.get(kind) ?? 0) > 1 || taken.has(next)) next = `${next}-${r.id ?? 0}`
      taken.add(next)
      settled.set(r, next)
    }
    emit({
      level: 'warn',
      code: 'slug-collision',
      message: `Source-path fallback '${slug}' still collides among ${group
        .map((g) => g.id ?? g.placement.page?.name)
        .join(', ')}; disambiguating by kind. Set Place.slug to choose the URLs yourself.`,
    })
  }

  for (const r of resolved) {
    const slug = settled.get(r)!
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
  type Folder = { ref: string; label: string; parent: Parent; order?: Rank }
  const folders = new Map<string, Folder>()
  const ensureFolder = (ref: string, spec?: { label?: string; order?: Rank }): void => {
    const existing = folders.get(ref)
    if (existing) {
      // A folder is identified by its `virtual` string, so several nodes may
      // name it. First declaration of a label/order wins; the rest just join.
      if (existing.label === undefined && spec?.label !== undefined) existing.label = spec.label
      if (existing.order === undefined && spec?.order !== undefined) existing.order = spec.order
      return
    }
    const slash = ref.lastIndexOf('/')
    const parent: Parent = slash >= 0 ? { virtual: ref.slice(0, slash) } : { root: true }
    folders.set(ref, {
      ref,
      label: spec?.label ?? (slash >= 0 ? ref.slice(slash + 1) : ref),
      parent,
      ...(spec?.order === undefined ? {} : { order: spec.order }),
    })
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
  //
  // An inlined member leaves no edge but is still documented, on its parent's
  // page. `inlinedUnder` records that, so the prunes below can tell "nothing
  // survived here" from "everything here reads one level up" — the shape
  // `Place.depth(n, { beyond: 'inline' })` produces.
  const seen = new Set<string>()
  const inlinedUnder = new Set<string>()
  for (const r of resolved) {
    const render = r.placement.page?.render ?? 'page'
    for (const nav of effectiveNav(r.placement)) {
      // Touching a virtual parent makes that folder (and its ancestors) exist.
      if ('virtual' in nav.parent) ensureFolder(nav.parent.virtual, nav.parent)
      if (render === 'inline') inlinedUnder.add(keyOf(nav.parent))
      if (r.id !== null) {
        // Dedupe by (parent, child): a declaration exposed twice under the SAME
        // parent (e.g. `export * from './m'` plus `export * as M from './m'` in
        // one file) must list once. Exposure under DIFFERENT parents is kept.
        const k = `${keyOf(nav.parent)}\0${r.id}`
        if (render === 'page' && !seen.has(k)) {
          seen.add(k)
          push(keyOf(nav.parent), { kind: 'doc', child: r.id, nav })
        }
      } else if (r.source.kind !== 'doc') push(keyOf(nav.parent), { kind: 'page', slug: r.slug, nav })
    }
  }

  // Folder edges: each folder attaches under its (possibly virtual) parent.
  // After the loop above so ancestor folders created during nesting are included.
  for (const folder of folders.values()) push(keyOf(folder.parent), { kind: 'folder', folder })

  const groupOf = (e: Edge): Group | undefined => ('nav' in e ? e.nav.group : undefined)

  // A folder that was given an order uses it; otherwise it inherits its earliest
  // child's, so a section lands where its contents say it should. Memoized, and
  // cycle-guarded so a folder that (somehow) contains itself resolves rather
  // than recursing.
  const folderOrders = new Map<string, Rank | undefined>()
  const folderOrder = (folder: Folder, seen: Set<string> = new Set()): Rank | undefined => {
    if (folder.order !== undefined) return folder.order
    const cached = folderOrders.get(folder.ref)
    if (cached !== undefined || folderOrders.has(folder.ref)) return cached
    if (seen.has(folder.ref)) return undefined
    seen.add(folder.ref)
    const child = minRank(
      (childrenOf.get(`v:${folder.ref}`) ?? []).map((e) =>
        e.kind === 'folder' ? folderOrder(e.folder, seen) : e.nav.order,
      ),
    )
    folderOrders.set(folder.ref, child)
    return child
  }

  const orderOf = (e: Edge): Rank | undefined => (e.kind === 'folder' ? folderOrder(e.folder) : e.nav.order)
  // Two questions, one loop, deliberately separate:
  //
  //  - `contains` — is this node a container whose only reason to exist is its
  //    members? Drives the empty-container prune below. Structural, so the
  //    layout does not get a vote.
  //  - `qualifies` — does this node lend its label to its descendants' labels
  //    (the `Reflect.` in `Reflect.Module`)? Presentation, so `Place.qualify`
  //    overrides it; the default is "every container except an entrypoint",
  //    whose members are the public surface and read better bare.
  const contains = new Map<Reflect.Id, boolean>()
  const qualifies = new Map<Reflect.Id, boolean>()
  for (const r of resolved)
    if (r.id !== null && r.source.kind === 'doc') {
      const d = r.source.decl
      const container = (d.kind === 'module' || d.kind === 'namespace') && !d.isEntry()
      contains.set(r.id, container)
      qualifies.set(r.id, r.placement.page?.qualify ?? container)
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
      // As with containers, inlined contents count as contents.
      if (children.every((g) => g.items.length === 0) && !inlinedUnder.has(self)) return null
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
    // noise (mirrors the empty-folder prune above). `contains` is exactly
    // "(module|namespace) && !isEntry()", so leaf declarations and entrypoints
    // are never pruned, and the cascade is bottom-up for free. Read from
    // `contains`, not `qualifies`: turning qualified labels off must not turn a
    // namespace into an unprunable node. A container whose members render
    // inline on its page is not empty — its row is how you reach them.
    if (contains.get(edge.child) && children.every((g) => g.items.length === 0) && !inlinedUnder.has(self)) return null
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
        .sort((a, b) => compareRank(orderOf(a.edge), orderOf(b.edge)) || a.node.label.localeCompare(b.node.label))
        .map((b) => b.node),
    }))
  }

  return descend('root', new Set(), undefined)
}

const nonNull = <T>(x: T | null): x is T => x !== null

/**
 * A placement's effective sidebar entries: a single entry derived from its page,
 * or its explicit `nav`. Either way each entry inherits the page's canonical
 * `group`/`order` unless it sets its own (explicit nav wins per-branch). The one
 * canonical helper — `LayoutContext` no longer carries a `navOf`; presets and
 * the page serializer import this directly.
 */
export const effectiveNav = (p: Placement): Nav[] => {
  if (p.page === null) return p.nav ?? []
  const { parent, name, group, order } = p.page
  if (p.nav !== undefined) return p.nav.map((n) => ({ ...n, group: n.group ?? group, order: n.order ?? order }))
  return [{ parent, name, group, order }]
}

/** Human label for a source, used in diagnostics. */
const describe = (s: PageSource): string => (s.kind === 'doc' ? `${s.decl.kind} "${s.decl.name}"` : `${s.kind} "${s.title}"`)

/**
 * Run the composed layout for one source over the framework default. Shared by
 * `buildTree` and the `why` explainer, so what the explainer reports is exactly
 * what the build produced.
 */
export const placeOne = (
  source: PageSource,
  layout: Layout,
  baseCx: BaseContext,
  trace?: LayoutContext['trace'],
): Placement => {
  const cx: LayoutContext = {
    default: () => defaultLayout(source, baseCx),
    index: baseCx.docs,
    name: baseCx.name,
    ...(trace ? { trace } : {}),
  }
  return layout(source, cx) ?? cx.default()
}

/**
 * Source-path segments as the collision/cycle fallback.
 *
 * Slugified per segment, like every other slug source — `lexicalSegments`
 * returns raw declaration names, so without this a collision produced a
 * mixed-case URL (`…/select/Select`) among otherwise lowercase ones, which
 * breaks on case-sensitive hosting.
 */
const lexicalFallback = (r: Resolved, cx: BaseContext): string[] =>
  r.id !== null
    ? lexicalSegments(cx, r.id).map(Slug.toSlug)
    : [Slug.toSlug((r.placement.page ?? { name: 'page' }).name ?? 'page')]
