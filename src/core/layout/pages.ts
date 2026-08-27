import type * as Reflect from '../reflect/index.ts'
import type { PageNode, DocLink, Group, Place, Rank, PageSource } from './types.ts'
import { effectiveNav, type Resolved } from './tree.ts'
import { compareRank } from './client.ts'

/**
 * Serialize resolved placements into the flat {@link PageNode} list — the
 * renderable units the client and SSG consume (page lookup, search,
 * breadcrumbs). Declarations become `doc` pages, markdown becomes `page`, and a
 * `.tsx` page becomes `component` — carrying only its module path, since the
 * component itself cannot be serialized. The sidebar tree is built separately
 * by `buildTree`.
 *
 * Only `render: 'page'` declarations get a page. A parent's exposed children
 * split by their own render mode: `page` → `links` (a link row), `inline` →
 * `inline` (full docs on the parent, before links), `hidden` → omitted. Member
 * links carry the child's **bucket** (its `Place.group`, or a per-branch `Nav`
 * override), so the listing groups exactly like the sidebar — and still groups
 * when the child is absent from the sidebar (`nav: []`). Backlinks stay ungrouped.
 */
export const toPages = (resolved: Resolved[]): PageNode[] => {
  const byId = new Map<Reflect.Id, Resolved>()
  for (const r of resolved) if (r.id !== null) byId.set(r.id, r)

  const renderOf = (id: Reflect.Id): 'page' | 'inline' | 'hidden' => byId.get(id)?.placement.page?.render ?? 'page'

  const placeOf = (childId: Reflect.Id): Place | null | undefined => byId.get(childId)?.placement.page

  type Child = { id: Reflect.Id; name: string; alias(): string | undefined }
  // A re-export's own alias wins (`export { Foo as Bar }` lists as `Bar`).
  // Otherwise the link reads as the page it points at, which is what
  // `Place.rename` set — a module has no intrinsic name, so without this a
  // renamed one listed as "unknown".
  const aliasOf = (c: Child) => c.alias() ?? placeOf(c.id)?.name ?? c.name

  // The bucket/order a child carries under `parentId`: its effective nav edge
  // there (a per-branch override) if it has one, else the child's canonical
  // `Place.group`/`order`. The fallback matters when a child is dropped from the
  // sidebar (`nav: []`) but still listed/inlined on its parent — it keeps its bucket.
  const navUnder = (childId: Reflect.Id, parentId: Reflect.Id) => {
    const r = byId.get(childId)
    const nav = r ? effectiveNav(r.placement) : undefined
    if (!nav?.length) return undefined
    return nav.find((n) => 'decl' in n.parent && n.parent.decl === parentId) ?? nav[0]!
  }
  const groupUnder = (childId: Reflect.Id, parentId: Reflect.Id): Group | undefined =>
    navUnder(childId, parentId)?.group ?? placeOf(childId)?.group
  const orderUnder = (childId: Reflect.Id, parentId: Reflect.Id): Rank | undefined =>
    navUnder(childId, parentId)?.order ?? placeOf(childId)?.order
  const toLink = (c: Child, parentId: Reflect.Id): DocLink => ({
    target: c.id,
    alias: aliasOf(c),
    group: groupUnder(c.id, parentId),
  })

  // Who the *placement* tree says belongs to a page, as opposed to who the
  // export graph exposes. The two agree by default — the framework default
  // parents a declaration at its exposer — and diverge the moment a layer says
  // otherwise (`Place.into`). Without this, moving a node under a parent would
  // give it the right URL and sidebar row while the parent's page went on
  // listing nothing.
  const adopted = new Map<Reflect.Id, Resolved[]>()
  for (const r of resolved) {
    const parent = r.placement.page?.parent
    if (!parent || !('decl' in parent) || r.id === null) continue
    const list = adopted.get(parent.decl)
    if (list) list.push(r)
    else adopted.set(parent.decl, [r])
  }

  const pages: PageNode[] = []
  for (const r of resolved) {
    if (r.source.kind === 'markdown') {
      pages.push({ kind: 'page', title: r.source.title, slug: pageSlug(r.slug), body: [r.source.content] })
      continue
    }
    if (r.source.kind === 'component') {
      pages.push({ kind: 'component', title: r.source.title, slug: pageSlug(r.slug), module: r.source.module })
      continue
    }
    const place = r.placement.page
    if (r.id === null || !place || (place.render ?? 'page') !== 'page') continue
    const d = r.source.decl
    const pid = r.id
    // Same order key as the sidebar (explicit `nav.order`, then alphabetical),
    // so a page's member list and the sidebar agree.
    // Union, not replacement: a declaration exposed by several modules is listed
    // by each of them, and only one of those can be its placement parent.
    const exposed = d.kind === 'module' || d.kind === 'namespace' ? d.exposure.children() : []
    const seen = new Set(exposed.map((c) => c.id))
    const claimed = (adopted.get(pid) ?? [])
      .filter((child) => child.id !== null && child.id !== pid && !seen.has(child.id))
      .map((child) => (child.source as Extract<PageSource, { kind: 'doc' }>).decl)
    const children = [...exposed, ...claimed]
      .filter((c) => byId.has(c.id))
      .sort(
        (a, b) => compareRank(orderUnder(a.id, pid), orderUnder(b.id, pid)) || aliasOf(a).localeCompare(aliasOf(b)),
      )
    // A module lists everything it *exposes*, even when a node lives elsewhere —
    // that is what a link is for. Inlining is different: a declaration's full
    // documentation has to render in exactly one place, and that place is the
    // parent its placement names. Without this the primitives would read in
    // full on their own page *and* again on the entrypoint that re-exports them.
    const homeOf = (childId: Reflect.Id): Reflect.Id | undefined => {
      const parent = placeOf(childId)?.parent
      return parent && 'decl' in parent ? parent.decl : undefined
    }
    const links = children.filter((c) => renderOf(c.id) === 'page').map((c) => toLink(c, pid))
    const inline = children
      .filter((c) => renderOf(c.id) === 'inline' && (homeOf(c.id) ?? pid) === pid)
      .map((c) => toLink(c, pid))
    const referenced: DocLink[] = Array.from(d.referenced())
      .filter((c) => byId.has(c.id) && renderOf(c.id) === 'page')
      .map((c) => ({ target: c.id, alias: c.alias() ?? c.name }))
    pages.push({
      kind: 'doc',
      decl: r.id,
      title: place.name,
      slug: pageSlug(r.slug),
      links,
      ...(inline.length ? { inline } : {}),
      referenced,
    })
  }
  return pages
}

/** The home page keeps `/`; every other slug drops its leading slash for the prefixer. */
export const pageSlug = (slug: string): string => (slug === '/' ? '/' : slug.replace(/^\//, ''))
