import ts from 'typescript'
import mm from 'micromatch'

import { type t } from '../../_lib/index.ts'

import * as reflect from '../reflect/index.ts'
import * as config from '../../config/load.ts'
import * as routing from './routing.ts'

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

export type GenerateOptions = {
  dir: string
  exclude: string[]
  config: Omit<ProjectJson, 'declarations'>
  compilerOptions: ts.CompilerOptions
  /** Override route naming / grouping / nav visibility. */
  routeProvider?: routing.RouteProvider
}

export const generate = async (opts: GenerateOptions): Promise<ProjectJson> => {
  const graph = reflect.generate(opts.config.entrypoints, {
    compilerOptions: opts.compilerOptions,
    rootDir: opts.dir,
    include: (sf) => keepFile(sf, opts.exclude),
  })

  const routes = Array.from(
    routing.build(graph, {
      entrypoints: opts.config.entrypoints,
      rootName: opts.config.name,
      provider: opts.routeProvider,
    }),
  )

  return {
    ...opts.config,
    declarations: [...graph.declarations()],
    routes: [...opts.config.routes, ...routes],
  }
}

const keepFile = (sf: ts.SourceFile, exclude?: string[] | undefined): boolean => {
  if (sf.isDeclarationFile) return false
  if (sf.fileName.includes('/node_modules/')) return false
  if (exclude?.some((i) => mm.isMatch(sf.fileName, i))) return false
  return true
}
