import type * as Reflect from '../reflect/types.ts'

/** A page of the generated site: a declaration page or a markdown page. */
export type Route = DocRoute | PageRoute

/** Fields shared by every route. The `slug` is the route's identity — unique across the project. */
export interface RouteBase {
  /** Display title, shown in the sidebar, breadcrumbs and page header. */
  title: string
  /** URL path of the page, and its unique identity. */
  slug: SlugPath
  /** Sidebar participation. Routes without one appear only where a parent's `children` list them. */
  sidebar?: Sidebar
}

/** A page generated for a declaration. */
export interface DocRoute extends RouteBase {
  kind: 'doc'
  /** Id of the declaration this page documents. */
  decl: Reflect.Id
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

/**
 * Sidebar participation of a route. `root` pins it top-level at that position
 * (with `group` sectioning the roots); `children` are edges to declarations
 * rendered beneath it wherever it appears. The same declaration may be listed
 * by several parents — each occurrence renders, so duplicates are by design.
 */
export type Sidebar = { root?: number; group?: Group; children?: DocLink[] }

/** A link to a declaration's page, displayed under `alias` and bucketed by `group`. */
export type DocLink = { target: Reflect.Id; alias: string; group?: Group; order?: number }

/**
 * URL prefixes applied per route kind: `doc` for declaration pages, `page`
 * for markdown pages.
 * @internal
 */
export type RoutePrefix = { doc?: string; page?: string }

/** A list of items sharing a group name, emitted in resolved group order. */
export type GroupedItems<T> = { group: string; items: T[] }

/** A route in the sidebar tree, carrying its grouped children. */
export type SidebarRoute = Route & { children: GroupedItems<SidebarRoute>[] }

/** The resolved route table the UI navigates with. Build one with {@link createRouter}. */
export interface ClientRouter {
  /** Path prefix every slug is mounted under (project + version). */
  base: string
  /** Every route, slugs fully prefixed. */
  items: Route[]
  /** The navigation tree: top-level routes with grouped children. */
  sidebar: GroupedItems<SidebarRoute>[]
  /** Look up a route by full slug or by declaration id. */
  get(match: { slug?: SlugPath; id?: number }): Route | undefined
  /** Breadcrumb segments for a declaration's route; segments without a `slug` render as plain text. */
  parts(id: number): { value: string; slug?: SlugPath }[]
}
