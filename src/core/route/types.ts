export interface Route {
  title: string
  slug: Slug
  sidebar?: Sidebar
  body: Body[]
}

export type Body = DocStatement | DocReferenced | Markdown

export interface DocStatement {
  kind: 'doc:statement'
  id: number
  alias: string
  exported: boolean
  modules: ModuleRef[]
}

export interface DocReferenced {
  kind: 'doc:referenced'
  referenced: TypeRef[]
}

export interface Markdown {
  kind: 'markdown'
  markdown: string
}

/**
 * A slug used in the URL.
 *
 * `(string & {})` just means that it displays as "Slug" instead of "string".
 */
export type Slug = string & {}

export type Group = { name: string; order?: number }

export type Sidebar = { parent?: Slug; group?: Group; order?: number }

export type ModuleRef = { target: number; alias: string; group?: Group }

export type TypeRef = { target: number; alias: string; group?: Group }
