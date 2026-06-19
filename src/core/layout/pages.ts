import type * as Reflect from '../reflect/index.ts'
import type { PageNode, DocLink, Group, Place } from './types.ts'
import { effectiveNav, type Resolved } from './tree.ts'

/**
 * Serialize resolved placements into the flat {@link PageNode} list — the
 * renderable units the client and SSG consume (page lookup, search,
 * breadcrumbs). The sidebar tree is built separately by `buildTree`.
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

  type Child = { id: Reflect.Id; name: string; alias(): string | undefined }
  const aliasOf = (c: Child) => c.alias() ?? c.name

  const placeOf = (childId: Reflect.Id): Place | null | undefined => byId.get(childId)?.placement.page

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
  const orderUnder = (childId: Reflect.Id, parentId: Reflect.Id): number =>
    navUnder(childId, parentId)?.order ?? placeOf(childId)?.order ?? 0
  const toLink = (c: Child, parentId: Reflect.Id): DocLink => ({
    target: c.id,
    alias: aliasOf(c),
    group: groupUnder(c.id, parentId),
  })

  const pages: PageNode[] = []
  for (const r of resolved) {
    if (r.source.kind === 'markdown') {
      pages.push({ kind: 'page', title: r.source.title, slug: pageSlug(r.slug), body: [r.source.content] })
      continue
    }
    const place = r.placement.page
    if (r.id === null || !place || (place.render ?? 'page') !== 'page') continue
    const d = r.source.decl
    const pid = r.id
    // Same order key as the sidebar (explicit `nav.order`, then alphabetical),
    // so a page's member list and the sidebar agree.
    const children = (d.kind === 'module' || d.kind === 'namespace' ? d.exposure.children() : [])
      .filter((c) => byId.has(c.id))
      .sort((a, b) => orderUnder(a.id, pid) - orderUnder(b.id, pid) || aliasOf(a).localeCompare(aliasOf(b)))
    const links = children.filter((c) => renderOf(c.id) === 'page').map((c) => toLink(c, pid))
    const inline = children.filter((c) => renderOf(c.id) === 'inline').map((c) => toLink(c, pid))
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
