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
}

type PageTypeMap = t.MapKind<{
  markdown: { content: string }
  module: { id: number; alias?: string; qualified: string }
  declaration: { id: number; alias?: string; qualified: string }
}>

export type PageType<K extends keyof PageTypeMap = keyof PageTypeMap> = PageTypeMap[K]
export type RouteNode<K extends keyof PageTypeMap = keyof PageTypeMap> = BaseRoute<PageType<K>>

export type GenerateOptions = {
  dir: string
  exclude: string[]
  config: Omit<ProjectJson, 'declarations'>
  compilerOptions: ts.CompilerOptions
}

export const generate = async (opts: GenerateOptions): Promise<ProjectJson> => {
  const entrypoints = opts.config.entrypoints.map((e) => e.path)

  const graph = reflect.generate(entrypoints, {
    compilerOptions: opts.compilerOptions,
    rootDir: opts.dir,
    include: (sf) => keepFile(sf, opts.exclude),
    internal: false,
  })

  const routes = Array.from(routing.build(graph, { entrypoints: opts.config.entrypoints }))

  return { ...opts.config, declarations: graph.declarations(), routes: routes }
}

const keepFile = (sf: ts.SourceFile, exclude?: string[] | undefined): boolean => {
  if (sf.isDeclarationFile) return false
  if (sf.fileName.includes('/node_modules/')) return false
  if (exclude?.some((i) => mm.isMatch(sf.fileName, i))) return false
  return true
}
