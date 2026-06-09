export type Route = DocRoute | PageRoute

export interface RouteBase {
  title: string
  slug: SlugPath
  sidebar?: Sidebar
}

export interface DocRoute extends RouteBase {
  kind: 'doc'
  decl: number
  links: DocLink[]
  referenced: DocLink[]
}

export interface PageRoute extends RouteBase {
  kind: 'page'
  body: string[]
}

/**
 * A slug used in the URL.
 *
 * `(string & {})` just means that it displays as "Slug" instead of "string".
 */
export type SlugPath = string & {}

export type Group = { name: string; order?: number }

export type Sidebar = { parent?: SlugPath; group?: Group; order?: number }

export type DocLink = { target: number; alias: string; group?: Group }

export type RoutePrefix = { doc?: string; page?: string }
