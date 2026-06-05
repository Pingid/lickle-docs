import type { ProjectJson, RouteNode } from '../../../core/project/index.ts'
import * as Types from './types.ts'

export const createProject = (json: ProjectJson): Types.Project => {
  const _byId = new Map<number, Types.Declaration>()
  const _bySlug = new Map<string, Types.Declaration>()
  const _routesById = new Map<number, RouteNode>()
  const _routesBySlug = new Map<string, RouteNode>()
  const _slugByName = new Map<string, RouteNode>()

  const sourceLink = (src: Types.Source) => {
    if (!json.repository?.fileUrl) return undefined
    return json.repository.fileUrl.replace('{PATH}', `/${src.file}`).replace('{LINE}', src.line.toString())
  }

  for (const declaration of json.declarations) {
    _byId.set(declaration.id, declaration)
  }

  const indexRoute = (r: RouteNode) => {
    // `''` is a valid slug (the base/README route); only group nodes, which
    // have no slug at all, are skipped here.
    if (r.slug !== undefined) _routesBySlug.set(r.slug, r)
    // Doc routes carry a declaration id; markdown pages resolve by slug only,
    // and group nodes (no page) aren't navigation targets at all.
    if (r.page?.kind === 'doc') {
      if (r.slug !== undefined) _bySlug.set(r.slug, _byId.get(r.page.id)!)
      _routesById.set(r.page.id, r)
      const name = _byId.get(r.page.id)?.name
      if (name && !_slugByName.has(name)) _slugByName.set(name, r)
      _slugByName.set(r.page.qualified, r)
    }
    for (const child of r.children) indexRoute(child)
  }

  for (const route of json.legacyRoutes) indexRoute(route)

  const byId = (id: number): Types.Declaration | undefined => _byId.get(id)
  const routeForId = (id: number): RouteNode | undefined => _routesById.get(id)
  const routeForSlug = (slug: string): RouteNode | undefined => _routesBySlug.get(slug)
  const routeByName = (name: string): RouteNode | undefined => _slugByName.get(name)
  const p: Types.Project = json as Types.Project

  hide(p, 'byId', byId)
  hide(p, 'routeForId', routeForId)
  hide(p, 'routeForSlug', routeForSlug)
  hide(p, 'routeByName', routeByName)
  hide(p, 'sourceLink', sourceLink)
  return p
}

const hide = <T, K extends keyof T>(obj: T, key: K, value: T[K]) =>
  Object.defineProperty(obj, key, { value, enumerable: false, configurable: true })
