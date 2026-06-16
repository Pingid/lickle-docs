import type * as Reflect from '../reflect/index.ts'
import type { PageNode, DocLink, Group } from './types.ts'
import type { Resolved } from './tree.ts'

/**
 * Serialize resolved placements into the flat {@link PageNode} list — the
 * renderable units the client and SSG consume (page lookup, search,
 * breadcrumbs). The sidebar tree is built separately by `buildTree`.
 *
 * Only `render: 'page'` declarations get a page. A parent's exposed children
 * split by their own render mode: `page` → `links` (a link row), `inline` →
 * `inline` (full docs on the parent, before links), `hidden` → omitted. Member
 * links carry the **same group the child carries in the nav**, so the listing
 * groups exactly like the sidebar. Backlinks (`referenced`) stay ungrouped.
 */
export const toPages = (resolved: Resolved[]): PageNode[] => {
  const byId = new Map<Reflect.Id, Resolved>()
  for (const r of resolved) if (r.id !== null) byId.set(r.id, r)

  const renderOf = (id: Reflect.Id): 'page' | 'inline' | 'hidden' => byId.get(id)?.placement.page?.render ?? 'page'

  type Child = { id: Reflect.Id; name: string; alias(): string | undefined }
  const aliasOf = (c: Child) => c.alias() ?? c.name

  // The bucket/order a child carries under `parentId` (its nav edge there), so
  // member listings mirror the sidebar. Falls back to the child's first nav edge.
  const navUnder = (childId: Reflect.Id, parentId: Reflect.Id) => {
    const nav = byId.get(childId)?.placement.nav
    if (!nav?.length) return undefined
    return nav.find((n) => 'decl' in n.parent && n.parent.decl === parentId) ?? nav[0]!
  }
  const groupUnder = (childId: Reflect.Id, parentId: Reflect.Id): Group | undefined => navUnder(childId, parentId)?.group
  const orderUnder = (childId: Reflect.Id, parentId: Reflect.Id): number => navUnder(childId, parentId)?.order ?? 0
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
