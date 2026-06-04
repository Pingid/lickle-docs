import ts from 'typescript'
import mm from 'micromatch'
import path from 'node:path'

import type { PreparedConfig } from '../../config/load.ts'
import type { ProjectJson, RouteNode } from './types.ts'
import * as reflect from '../reflect/index.ts'
import * as routing from './routing.ts'

export * from './debug.ts'
export * from './types.ts'
export * from './routing.ts'
export * from './builder.ts'
export * from './presets.ts'

export const buildJson = async (opts: PreparedConfig): Promise<ProjectJson> => {
  const graph = reflect.generate(opts.config.entrypoints ?? [], {
    compilerOptions: opts.compilerOptions,
    rootDir: opts.rootDir,
    include: keepFile(opts),
  })

  const routes = Array.from(
    routing.buildRoutes(graph, {
      entrypoints: opts.config.entrypoints ?? [],
      rootName: opts.config.name,
      mode: opts.config.full ? 'full' : 'exposed',
      reserved: collectSlugs(opts.routes),
      provider: opts.config.provider,
    }),
  )

  return {
    name: opts.config.name,
    version: opts.config.version,
    repository: opts.config.repository,
    links: opts.links,
    entrypoints: opts.entrypoints,
    declarations: [...graph.declarations()],
    routes: [...opts.routes, ...routes],
  }
}

/** All slugs in a route subtree, so routing can avoid colliding with them.
 * Includes the empty slug (a README owning `/`); group-only nodes omit it. */
const collectSlugs = (routes: RouteNode[]): string[] =>
  routes.flatMap((r) => [...(r.slug !== undefined ? [r.slug] : []), ...collectSlugs(r.children)])

const keepFile =
  (opts: PreparedConfig) =>
  (sf: ts.SourceFile): boolean => {
    if (sf.isDeclarationFile) return false
    if (sf.fileName.includes('/node_modules/')) return false
    const relative = path.relative(opts.rootDir, sf.fileName)
    if (opts.exclude?.some((i) => mm.isMatch(relative, i))) return false
    return true
  }

export const flattenRoutes = (routes: RouteNode[]): RouteNode[] =>
  routes.flatMap((r) => [r, ...flattenRoutes(r.children)])
