/** A page of the generated site: a declaration page or a markdown page. */
export type Route = DocRoute | PageRoute

/** Fields shared by every route. */
export interface RouteBase {
  /** Display title, shown in the sidebar, breadcrumbs and page header. */
  title: string
  /** URL path of the page. */
  slug: SlugPath
  /** Sidebar placement. Omitted routes don't appear in the sidebar. */
  sidebar?: Sidebar
}

/** A page generated for a declaration. */
export interface DocRoute extends RouteBase {
  kind: 'doc'
  /** Id of the declaration this page documents. */
  decl: number
  /** Member links listed on the page, e.g. a module's exports. */
  links: DocLink[]
  /** Backlinks from declarations that reference this one. */
  referenced: DocLink[]
}

/** A standalone markdown page, e.g. the README home page. */
export interface PageRoute extends RouteBase {
  kind: 'page'
  /** Markdown sections rendered in order. */
  body: string[]
}

/**
 * A slug used in the URL.
 *
 * `(string & {})` just means that it displays as "Slug" instead of "string".
 */
export type SlugPath = string & {}

/** A named bucket for sidebar entries and link listings. Buckets sort ascending by `order`. */
export type Group = { name: string; order?: number }

/** Sidebar placement of a route: the parent it nests under, its group and its order within the group. */
export type Sidebar = { parent?: SlugPath; group?: Group; order?: number }

/** A link to a declaration's page, displayed under `alias` and bucketed by `group`. */
export type DocLink = { target: number; alias: string; group?: Group; order?: number }

/**
 * URL prefixes applied per route kind: `doc` for declaration pages, `page`
 * for markdown pages.
 * @internal
 */
export type RoutePrefix = { doc?: string; page?: string }
