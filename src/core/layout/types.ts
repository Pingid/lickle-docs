import type { DeclarationFacade } from './facade.ts'
import type * as Reflect from '../reflect/index.ts'

/** The one thing a layer can reach: the placement the layers below it produced. */
export type LayoutContext = { default(): Placement }

export type PageSource =
  | { kind: 'doc'; decl: DeclarationFacade }
  | { kind: 'markdown'; content: string; title: string; slug?: string; folder?: string; group?: string; order?: number }

export type Layout = (p: PageSource, cx: LayoutContext) => Placement | undefined

export type Filter = (d: DeclarationFacade) => boolean

/**
 * What a {@link Layout} decides for one page source.
 *
 * - `page: null` — **excluded**: no page, no listing, no sidebar (the old `filter`).
 * - `page: Place` — a content home; `nav` defaults to a single sidebar entry
 *   derived from that home.
 * - `nav: []` — page exists, absent from the sidebar.
 * - `nav: [...]` — explicit sidebar appearances, replacing the derived default.
 */
export type Placement = {
  page: Place | null
  nav?: Nav[]
  /**
   * Additional URLs that resolve to this page. Each is a real, navigable slug
   * with its own breadcrumb, but renders the canonical page's content — there
   * is still exactly one canonical slug (from `page`). Use for "this guide
   * lives at /start and /getting-started", or a declaration reachable by two
   * paths where both URLs should work.
   */
  aliases?: Alias[]
}

/**
 * Where a node attaches. A declaration (resolved to its own placement),
 * a synthetic folder/section identified by name, or the root.
 *
 * `virtual` parents are matched by string identity, so two nodes naming
 * `{ virtual: 'src/core' }` land under the same folder. A `/` nests folders:
 * `{ virtual: 'src/core' }` puts "core" under a "src" folder (created on demand).
 */
export type Parent = { decl: Reflect.Id } | { virtual: string } | { root: true }

/** A named bucket within a parent. Buckets sort ascending by `order`; ties keep first-seen order. */
export type Group = { name: string; order?: number }

// ─────────────────────────────────────────────────────────────────────────
// The two trees — per-node placement (Place, singular) vs per-appearance
// navigation edge (Nav, plural)
// ─────────────────────────────────────────────────────────────────────────

/**
 * A node's placement in the **content tree**: the single location that defines
 * its slug, breadcrumb and page title, plus its canonical bucket and order.
 * Singular by construction — a declaration has exactly one canonical URL and one
 * bucket. Where the same node appears under several sidebar parents, each
 * appearance is a {@link Nav} that defaults to this `group`/`order` but may
 * override it.
 *
 * The three name levels:
 * - intrinsic name is `decl.name` (read-only data, not here);
 * - `name` is the *segment* this node contributes to its slug/title;
 * - the branch-contextual display is derived, never set (see `Nav.name`).
 */
export type Place = {
  /** Attachment point in the content tree. */
  parent: Parent
  /** Display segment: the page title, the breadcrumb leaf, and — absent `slug` — the URL segment. */
  name: string
  /**
   * URL segment for this node, overriding the slugified `name`. Set when the
   * display name isn't URL-safe (`'Create Client'` shown, `create-client` in
   * the path). Scoped to this node under its parent, so collisions are local
   * and diagnosable. Defaults to `slugify(name)`.
   */
  slug?: string
  /**
   * How this node renders. Defaults to `'page'`.
   *
   * - `'page'` — its own route, listed and navigable.
   * - `'inline'` — no route; rendered inline on its parent's page, before the
   *   member links (e.g. collapse a small type onto its owner). Kept resolvable.
   * - `'hidden'` — no route, absent from nav and listings; still resolvable for
   *   `{@link}` and breadcrumbs.
   */
  render?: 'page' | 'inline' | 'hidden'
  /**
   * Canonical bucket (the sidebar section) this node lists under. A
   * per-appearance `Nav.group` overrides it for that one branch; otherwise every
   * appearance inherits this. Assigned by `Place.bucket` / ordered by
   * `Place.bucketOrder`.
   */
  group?: Group
  /**
   * Order within the bucket (lower sorts first); ties fall back to alphabetical.
   * A per-appearance `Nav.order` overrides it.
   */
  order?: number
}

/**
 * One appearance in the **navigation tree** (sidebar). Plural: the same node
 * may appear under several parents, each a distinct `Nav` — an edge from
 * `parent` to this node. Carries the per-branch facts (where it attaches, how
 * it's labelled); bucket and order default to the node's {@link Place} but can
 * be overridden here for a single branch.
 */
export type Nav = {
  /** Attachment point in the sidebar. */
  parent: Parent
  /**
   * Label in *this* branch. Defaults to the node's `Place.name`. Override only
   * to rename within one branch; the cross-branch qualifier (`Types.UserConfig`
   * vs `UserConfig`) is derived by accumulating ancestors' labels, not set here.
   */
  name: string
  /** Bucket override for this appearance; defaults to the node's `Place.group`. */
  group?: Group
  /** Order override for this appearance; defaults to the node's `Place.order`. */
  order?: number
}

/**
 * A secondary URL for a page. Placed in the content tree like a `Place` (so it
 * gets a slug and breadcrumb), but carries no page of its own — it points at
 * the canonical node.
 */
export type Alias = {
  parent: Parent
  name: string
  slug?: string
  /** Whether the alias URL redirects to the canonical, or renders the shared body in place. Default 'redirect'. */
  mode?: 'redirect' | 'render'
}

/** A list of items sharing a group name, emitted in resolved group order. */
export type GroupedItems<T> = { group: string; items: T[] }

declare module '../diagnostic/types.ts' {
  interface DiagnosticsMap {
    'slug-collision': {}
    'content-cycle': {}
    'missing-parent': {}
    'sidebar-cycle': {}
  }
}

/**
 * A secondary URL resolved into the graph: an alias's own slug, the canonical
 * page it stands for, and whether it redirects there or renders the shared body.
 */
export type ResolvedAlias = {
  /** The alias's own (normalized) slug. */
  slug: string
  /** Canonical declaration id the alias points at; absent for markdown pages. */
  target?: Reflect.Id
  /** The canonical page's (normalized) slug — the redirect destination. */
  canonical: string
  mode: 'redirect' | 'render'
}

/** A `redirect`-mode alias resolved to an unprefixed `from → to` slug pair. */
export type Redirect = { from: string; to: string }

/**
 * A node in the built sidebar tree. Three flavours, discriminated by `kind`:
 *  - `'doc'` — a declaration's row: has `id` and `slug`, links to its page.
 *  - `'page'` — a markdown page's row: has `slug` (no `id`), links to its page.
 *  - `'folder'` — a virtual section header: no page, just a label and children.
 *
 * `label` is the branch-local name; `display` is the accumulated qualifier
 * (`Types.UserConfig`), present only on nested doc occurrences.
 */
export type SidebarNode =
  | {
      kind: 'doc'
      id: Reflect.Id
      slug: string
      label: string
      display?: string
      children: GroupedItems<SidebarNode>[]
    }
  | {
      kind: 'page'
      slug: string
      label: string
      children: GroupedItems<SidebarNode>[]
    }
  | {
      kind: 'folder'
      /** Folder identity, the `virtual` string. Stable key, not displayed. */
      ref: string
      label: string
      children: GroupedItems<SidebarNode>[]
    }

// ─────────────────────────────────────────────────────────────────────────
// Pages — the rendered units, and the site graph shipped to the client
// ─────────────────────────────────────────────────────────────────────────

/** A slug used in the URL. `(string & {})` displays as "Slug" instead of "string". */
export type SlugPath = string & {}

/** URL prefixes applied per page kind: `doc` for declaration pages, `page` for markdown pages. */
export type RoutePrefix = { doc?: string; page?: string }

/** A link to a page, displayed under `alias` and bucketed by `group`. */
export type DocLink = { target: Reflect.Id; alias: string; group?: Group }

/** A rendered page of the generated site: a declaration page or a markdown page. */
export type PageNode = DocPage | MarkdownPage

type PageBase = {
  /** Display title — page header, sidebar label fallback, breadcrumb leaf. */
  title: string
  /** URL path, the page's unique identity. */
  slug: SlugPath
}

/** A declaration's page. */
export type DocPage = PageBase & {
  kind: 'doc'
  /** Id of the declaration this page documents. */
  decl: Reflect.Id
  /** Member links listed on the page — a module/namespace's exposed members. */
  links: DocLink[]
  /** Members rendered inline (full docs), before `links` — `render: 'inline'` children. */
  inline?: DocLink[]
  /** Backlinks from declarations that reference this one. */
  referenced: DocLink[]
}

/** A standalone markdown page, e.g. the README home page. */
export type MarkdownPage = PageBase & {
  kind: 'page'
  /** Markdown sections rendered in order. */
  body: string[]
}

/**
 * The resolved site: the builder's output and the serialized contract shipped
 * to the client. `pages` are the renderable units, `sidebar` the prebuilt nav
 * tree, `redirects` the secondary-URL pairs, and `declarations` the reflection
 * data pages reference by id.
 */
export type SiteGraph = {
  pages: PageNode[]
  sidebar: GroupedItems<SidebarNode>[]
  redirects: Redirect[]
  declarations: Reflect.Declaration[]
}
