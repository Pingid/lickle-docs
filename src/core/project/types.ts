import * as reflect from '../reflect/index.ts'
import * as config from '../../config/load.ts'

/** Description of the project persisted to json used to generate the site */
export interface ProjectJson {
  /** The name of the project. */
  name: string
  /** The version of the project. */
  version?: string
  /** Repository information */
  repository?: config.Repo
  /** Links for the project. */
  links: config.Link[]
  /** Entrypoints — relative source paths reachable from `main` / `exports`. */
  entrypoints: config.Entry[]
  // /** Routes of the project. */
  // routes: RouteNode[]
  pages: Page[]

  naming: Record<number, Naming>
  declarations: Record<number, reflect.Declaration>
  modules: Record<number, reflect.Module>
  sources: Record<number, reflect.Source[]>
  comments: Record<number, reflect.Comment>
}

export interface Page {
  /** Page title */
  title: string
  /** Page path */
  slug?: string
  /** Page content */
  content: string
}

export interface Naming {
  label: string
  slug: string
  qualified: string
}
