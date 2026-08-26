import type { DeclarationFacade } from './facade.ts'
import type * as Reflect from '../reflect/index.ts'

/**
 * What a layer can reach while placing one source: the placement the layers
 * below it produced, plus enough of the project to make corpus-aware decisions
 * (how many siblings a module has, what else an entrypoint exposes).
 */
export type LayoutContext = {
  /** The placement the layers below this one produced. */
  default(): Placement
  /** The reflection index — every declaration, the export graph, source paths. */
  index: Reflect.Index
  /** Project name, as the header shows it. */
  name: string
  /** Set by `ldocs why`; each layer that changes the placement reports itself. */
  trace?: (entry: TraceEntry) => void
}

/** One layer's contribution to a placement, recorded when `LayoutContext.trace` is set. */
export type TraceEntry = { layer: string; before: Placement; after: Placement }

/** A declaration being placed. */
export type DocSource = { kind: 'doc'; decl: DeclarationFacade }

/** Fields every standalone page shares, however its body is produced. */
type ContentBase = {
  /** Display title — page header, sidebar label, breadcrumb leaf. */
  title: string
  /** URL path. Defaults to a slug derived from the title; `/` is the home page. */
  slug?: string
  /** Virtual sidebar folder to nest under (`/` nests further). */
  folder?: string
  /** Sidebar bucket under its parent. */
  group?: string
  /** Sort position among siblings (lower first). See {@link Rank}. */
  order?: Rank
  /** Project-relative POSIX path this page was loaded from; absent for inline content. */
  file?: string
}

/** A markdown page: its body travels with the site data. */
export type MarkdownSource = ContentBase & { kind: 'markdown'; content: string }

/**
 * A component page: a `.tsx`/`.jsx` module default-exporting a SolidJS
 * component. The body cannot be serialized, so the source carries the module
 * path and the bundler wires up the import.
 */
export type ComponentSource = ContentBase & { kind: 'component'; module: string }

/** A standalone page — anything that is not a declaration. */
export type ContentSource = MarkdownSource | ComponentSource

export type PageSource = DocSource | ContentSource

export type Layout = {
  (p: PageSource, cx: LayoutContext): Placement | undefined
  /**
   * Name `ldocs why` reports this layer under; set by the `Place` presets. A
   * function is resolved per source, so a layer whose behaviour depends on the
   * declaration can name the branch it took.
   */
  label?: string | ((source: PageSource) => string)
  /**
   * Whether this layer's *internals* are the interesting attribution. A
   * transparent wrapper is a scope the config wrote — `Place.within`, an
   * outline — so the trace reports the layers inside it and not the wrapper.
   * An opaque one is a preset that happens to compose internally, and reports
   * itself. See `Place.label`.
   */
  transparent?: true
}

/**
 * A post-pass over every resolved placement, run after the layout has decided
 * each source in isolation. This is the seam for decisions that need to see the
 * whole set — "inline any bucket with fewer than three members", "order
 * siblings by source position". Return the placements to use; mutating and
 * returning the same array is fine.
 */
export type Refine = (nodes: RefineNode[], cx: RefineContext) => RefineNode[] | void

/** One placed source handed to a {@link Refine} pass. */
export type RefineNode = { source: PageSource; placement: Placement; id: Reflect.Id | null }

/** What a {@link Refine} pass can reach beyond the nodes themselves. */
export type RefineContext = { index: Reflect.Index; name: string }

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
export type Parent = { decl: Reflect.Id } | VirtualParent | { root: true }

/**
 * A synthetic folder, identified by its `virtual` string. `label` and `order`
 * are the folder's own — without them a folder has no position of its own and
 * has to borrow its earliest child's, which is why positioning one used to mean
 * offsetting everything inside it. First declaration of each wins; nodes that
 * name the same folder without a spec simply join it.
 */
export type VirtualParent = { virtual: string; label?: string; order?: Rank }

/** A named bucket within a parent. Buckets sort ascending by `order`; ties keep first-seen order. */
export type Group = { name: string; order?: number }

/**
 * Sort position among siblings — a single number, or a tuple compared
 * element-wise with a missing element reading as `0` (so `2` and `[2]` and
 * `[2, 0]` are the same rank).
 *
 * A tuple exists so composite keys stay composite. "Third entry in `pages`,
 * second file within it" is `[0, 3, 2]`; there is no arithmetic to get wrong
 * and no ceiling to overflow. The leading element is a **band**, which is how
 * unrelated schemes stay out of each other's way:
 *
 * - `0` — positioned content: pages the config listed, and anything
 *   `Place.order` pins;
 * - `1` — entrypoint modules the scan discovered, which trail the content a
 *   config wrote by hand unless it says otherwise.
 *
 * Ties fall back to alphabetical, so an unranked sibling is stable rather than
 * arbitrary.
 */
export type Rank = number | number[]

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
   * Whether this node's label prefixes its descendants' sidebar labels — the
   * `Reflect.` in `Reflect.Module`. Defaults to "yes for a namespace or a
   * nested module, no for an entrypoint", since an entrypoint's members *are*
   * the public surface and read better bare. Set it explicitly with
   * `Place.qualify` to name a level that the default would skip, or to silence
   * one it wouldn't.
   *
   * A node shows a qualified label when an ancestor qualifies, so this is a
   * property of the *container*, not of the labelled node.
   */
  qualify?: boolean
  /**
   * Order within the bucket (lower sorts first); ties fall back to alphabetical.
   * A per-appearance `Nav.order` overrides it. See {@link Rank}.
   */
  order?: Rank
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
  /** Order override for this appearance; defaults to the node's `Place.order`. See {@link Rank}. */
  order?: Rank
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
    'page-read': {}
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

/** A rendered page of the generated site: a declaration, markdown or component page. */
export type PageNode = DocPage | MarkdownPage | ComponentPage

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
 * A page whose body is a SolidJS component. The component itself cannot travel
 * in JSON, so the page carries the module's project-relative path and the
 * client resolves it through the module registry the bundler generates (see
 * `DocsJson.modules`).
 */
export type ComponentPage = PageBase & {
  kind: 'component'
  /** Project-relative POSIX path of the module default-exporting the component. */
  module: string
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
