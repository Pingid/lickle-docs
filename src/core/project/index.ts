import ts from 'typescript'
import mm from 'micromatch'
import path from 'node:path'

import type { ProjectJson, RouteNode } from './types.ts'
import * as reflect from '../reflect/index.ts'
import * as routing from './routing.ts'

export * from './debug.ts'
export * from './types.ts'

export type GenerateOptions = {
  dir: string
  exclude: string[]
  config: Omit<ProjectJson, 'declarations'>
  compilerOptions: ts.CompilerOptions
  /** Override route naming / grouping / nav visibility. */
  routeProvider?: routing.RouteProvider
  /** Route every scanned declaration (incl. non-exported), not just the public API. */
  full?: boolean
}

export const buildJson = async (opts: GenerateOptions): Promise<ProjectJson> => {
  const graph = reflect.generate(opts.config.entrypoints, {
    compilerOptions: opts.compilerOptions,
    rootDir: opts.dir,
    include: keepFile(opts),
  })

  const routes = Array.from(
    routing.buildRoutes(graph, {
      entrypoints: opts.config.entrypoints,
      rootName: opts.config.name,
      provider: opts.routeProvider,
      mode: opts.full ? 'full' : 'exposed',
      reserved: collectSlugs(opts.config.routes),
    }),
  )

  return {
    ...opts.config,
    declarations: [...graph.declarations()],
    routes: [...opts.config.routes, ...routes],
  }
}

/** All slugs in a route subtree, so routing can avoid colliding with them. */
const collectSlugs = (routes: RouteNode[]): string[] => routes.flatMap((r) => [r.slug, ...collectSlugs(r.children)])

const keepFile =
  (opts: GenerateOptions) =>
  (sf: ts.SourceFile): boolean => {
    if (sf.isDeclarationFile) return false
    if (sf.fileName.includes('/node_modules/')) return false
    const relative = path.relative(opts.dir, sf.fileName)
    if (opts.exclude?.some((i) => mm.isMatch(relative, i))) return false
    return true
  }

export const flattenRoutes = (routes: RouteNode[]): RouteNode[] =>
  routes.flatMap((r) => [r, ...flattenRoutes(r.children)])
