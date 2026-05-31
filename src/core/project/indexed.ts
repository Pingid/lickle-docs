import type * as T from '../reflect/index.ts'

import type * as project from './json.ts'

type RouteNode = project.RouteNode

export interface Project extends project.ProjectJson {
  byId(id: number): T.Declaration | undefined
  bySlug(slug: string): T.Declaration | undefined
  routeForId(id: number): RouteNode | undefined
  routeForSlug(slug: string): RouteNode | undefined
}

export const create = (json: project.ProjectJson): Project => {
  const _byId = new Map()
  const _bySlug = new Map()
  const _routesById = new Map()
  const _routesBySlug = new Map()

  for (const declaration of json.declarations) {
    _byId.set(declaration.id, declaration)
  }

  const indexRoute = (r: RouteNode) => {
    _routesBySlug.set(r.slug, r)
    // Markdown pages carry no declaration id, so they only resolve by slug.
    if (r.page.kind !== 'markdown') {
      _bySlug.set(r.slug, _byId.get(r.page.id))
      _routesById.set(r.page.id, r)
    }
    for (const child of r.children) indexRoute(child)
  }

  for (const route of json.routes) indexRoute(route)

  const byId = (id: number): T.Declaration | undefined => _byId.get(id)
  const bySlug = (slug: string): T.Declaration | undefined => _bySlug.get(slug)
  const routeForId = (id: number): RouteNode | undefined => _routesById.get(id)
  const routeForSlug = (slug: string): RouteNode | undefined => _routesBySlug.get(slug)
  const p: Project = json as Project

  hide(p, 'byId', byId)
  hide(p, 'bySlug', bySlug)
  hide(p, 'routeForId', routeForId)
  hide(p, 'routeForSlug', routeForSlug)
  return p
}

const hide = <T, K extends keyof T>(obj: T, key: K, value: T[K]) =>
  Object.defineProperty(obj, key, { value, enumerable: false, configurable: true })
