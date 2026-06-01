import { type t } from '../../_lib/index.ts'

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
  /** Routes of the project. */
  routes: RouteNode[]
  /** Flat list of every declaration in the project, source order. */
  declarations: reflect.Declaration[]
}

/** Used to generate navigation, for now all declarations are pages */
export type BaseRoute<P> = {
  /** Label used in the navigation */
  label: string
  /** Slug of the page, used in the URL */
  slug: string
  /** Page type to display */
  page: P
  /** sub pages */
  children: BaseRoute<P>[]
  /** Whether the page should be displayed in the navigation */
  nav: boolean
  /** Adds a label above in navigation*/
  group?: string
}

type PageTypeMap = t.MapKind<{
  markdown: { content: string }
  module: { id: number; alias?: string; qualified: string; referencedIn: number[] }
  declaration: { id: number; alias?: string; qualified: string; referencedIn: number[] }
}>

export type PageType<K extends keyof PageTypeMap = keyof PageTypeMap> = PageTypeMap[K]
export type RouteNode<K extends keyof PageTypeMap = keyof PageTypeMap> = BaseRoute<PageType<K>>
