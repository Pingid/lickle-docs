import ts from 'typescript'
import mm from 'micromatch'

import { type t, fs } from '../../_lib/index.ts'

import * as reflect from '../reflect/index.ts'
import * as config from '../../config/load.ts'
import * as v2 from '../reflect/v2/index.ts'
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
  routes: RouteNode<PageType>[]
  /** Flat list of every declaration in the project, source order. */
  declarations: reflect.v2.Declaration[]
}

export type RouteNode<P> = {
  /** Label used in the navigation */
  label: string
  /** Slug of the page, used in the URL */
  slug: string
  /** Page type to display */
  page: P
  /** sub pages */
  children: RouteNode<P>[]
}

export type PageType = t.MapKindUnion<{
  markdown: { content: string }
  module: { id: number; alias?: string }
  declaration: { id: number; alias?: string }
}>

export const generate = async (dir: string, opts?: Partial<config.ConfigJson>): Promise<ProjectJson> => {
  const c = await config.load(dir, opts)
  const entrypoints = (c.config.entrypoints ?? []).map((e) => e.path)

  const graph = v2.generate(entrypoints, {
    compilerOptions: c.compilerOptions,
    rootDir: dir,
    include: (sf) => keepFile(sf, c.config.exclude),
    internal: false,
  })

  const page: PageType | undefined = c.config.readme
    ? { kind: 'markdown', content: await fs.readFile(c.config.readme, 'utf-8') }
    : undefined
  const provided = page ? [{ label: 'Overview', slug: '/', page, children: [] }] : []

  const routes = routing.build(graph, { routes: provided, entrypoints: c.config.entrypoints })
  return fromConfig(c.config, routes.routes, routes.declarations)
}

const keepFile = (sf: ts.SourceFile, exclude?: string[] | undefined): boolean => {
  if (sf.isDeclarationFile) return false
  if (sf.fileName.includes('/node_modules/')) return false
  if (exclude?.some((i) => mm.isMatch(sf.fileName, i))) return false
  return true
}

const fromConfig = (
  c: config.ConfigJson,
  routes: RouteNode<PageType>[],
  declarations: reflect.v2.Declaration[],
): ProjectJson => ({
  name: c.name,
  version: c.version,
  repository: c.repository,
  entrypoints: c.entrypoints ?? [],
  links: c.links ?? [],
  routes,
  declarations,
})
