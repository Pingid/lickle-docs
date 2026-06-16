import * as Slug from '../../_lib/slug/index.ts'

import type { PageNode, RoutePrefix, SlugPath, SidebarNode, GroupedItems, Redirect } from './types.ts'

/**
 * The client-facing router: prefix every page slug, index by slug and id, and
 * carry the server-built {@link SidebarNode} tree (prefixed). No tree
 * reconstruction happens here — the server already built it.
 */
export type LayoutRouter = {
  /** Path prefix every slug is mounted under (version base). */
  base: string
  /** Every page, slugs fully prefixed. */
  items: PageNode[]
  /** The navigation tree, slugs prefixed. */
  sidebar: GroupedItems<SidebarNode>[]
  /** Look up a page by full (prefixed) slug or declaration id. */
  get(match: { slug?: SlugPath; id?: number }): PageNode | undefined
  /** Breadcrumb segments for a declaration; segments without a `slug` render as plain text. */
  parts(id: number): { value: string; slug?: SlugPath }[]
  /** The canonical (prefixed) slug a redirect-mode alias `slug` points at, if any. */
  redirect(slug: SlugPath): SlugPath | undefined
  /** Every redirect as a prefixed `from → to` pair, for static generation. */
  redirects: Redirect[]
}

/**
 * Build a {@link LayoutRouter}: prefix every page slug with the version `base`
 * and the per-kind `prefix`, index by slug and id, prefix the prebuilt sidebar
 * tree the same way, and resolve redirect-mode aliases to canonical slugs.
 */
export const createLayoutRouter = (p: {
  pages: PageNode[]
  sidebar: GroupedItems<SidebarNode>[]
  redirects?: Redirect[]
  prefix?: RoutePrefix
  base?: string
}): LayoutRouter => {
  const prefix = Slug.join(p.base?.replace(/^\/+|\/+$/g, ''))

  let matchedHome = false
  // Prefix an unprefixed page slug for a given kind. Home (`/`) maps to the bare
  // prefix. Strip the slug's leading slash (and treat an empty per-kind prefix as
  // absent) so the result has no leading slash — matching the `/*slug` param the
  // router resolves against, for every kind including an empty `page` prefix.
  const withKind = (slug: SlugPath, kind: PageNode['kind']): SlugPath => {
    if (slug === '/' || slug === '') return prefix || '/'
    const kindPrefix = (kind === 'doc' ? p.prefix?.doc : p.prefix?.page) || undefined
    return Slug.join(prefix || undefined, kindPrefix, Slug.normalize(slug).replace(/^\//, ''))
  }
  const fullSlug = (page: PageNode): SlugPath => {
    if (!matchedHome && (page.slug === '/' || page.slug === '')) {
      matchedHome = true
      return prefix || '/'
    }
    return withKind(page.slug, page.kind)
  }

  const _byId = new Map<number, PageNode>()
  const _bySlug = new Map<SlugPath, PageNode>()
  const _rawSlug = new Map<PageNode, SlugPath>()
  // Prefixed slug, and the prefixed page, indexed by the original (normalized)
  // slug — so the tree's pre-prefix nodes and redirect targets can be remapped.
  const prefixedByRaw = new Map<SlugPath, SlugPath>()
  const pageByRaw = new Map<SlugPath, PageNode>()
  const items: PageNode[] = []

  for (const page of p.pages) {
    const slug = fullSlug(page)
    const next = { ...page, slug }
    items.push(next)
    _bySlug.set(slug, next)
    _rawSlug.set(next, page.slug)
    prefixedByRaw.set(Slug.normalize(page.slug), slug)
    pageByRaw.set(Slug.normalize(page.slug), next)
    // First claimant wins, so an alias's render page never steals the id from
    // the canonical page (`get({ id })` stays the canonical slug).
    if (next.kind === 'doc' && !_byId.has(next.decl)) _byId.set(next.decl, next)
    if (slug === '/') _bySlug.set('', next)
  }

  // Redirect-mode aliases: prefix the alias `from` with its canonical's kind.
  const _redirect = new Map<SlugPath, SlugPath>()
  const redirects: Redirect[] = []
  for (const rd of p.redirects ?? []) {
    const canonical = pageByRaw.get(Slug.normalize(rd.to))
    if (!canonical) continue
    const from = withKind(rd.from, canonical.kind)
    _redirect.set(from, canonical.slug)
    redirects.push({ from, to: canonical.slug })
  }

  const prefixNode = (n: SidebarNode): SidebarNode => {
    const children = n.children.map((g) => ({ group: g.group, items: g.items.map(prefixNode) }))
    if (n.kind === 'folder') return { ...n, children }
    if (n.kind === 'doc') return { ...n, slug: _byId.get(n.id)?.slug ?? n.slug, children }
    return { ...n, slug: prefixedByRaw.get(Slug.normalize(n.slug)) ?? n.slug, children }
  }

  const sidebar = p.sidebar.map((g) => ({ group: g.group, items: g.items.map(prefixNode) }))

  return {
    base: prefix,
    items,
    sidebar,
    get: (match) => {
      if (typeof match.slug === 'string') return _bySlug.get(match.slug)
      if (typeof match.id === 'number') return _byId.get(match.id)
      return undefined
    },
    redirect: (slug) => _redirect.get(slug),
    redirects,
    parts: (id: number) => {
      const page = _byId.get(id)
      const raw = page && _rawSlug.get(page)
      if (typeof raw !== 'string') return []
      const segs = [p?.prefix?.doc, ...raw.split('/')].filter((s) => s !== undefined)
      return segs.map((seg, i) => {
        const s = Slug.join(prefix || undefined, segs.slice(0, i + 1).join('/'))
        return { value: seg, slug: _bySlug.has(s) ? s : undefined }
      })
    },
  }
}
