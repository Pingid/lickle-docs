import type * as T from '../reflect/index.ts'

import type * as project from './json.ts'

type RouteNode = project.RouteNode

export interface Project extends project.ProjectJson {
  byId(id: number): T.Declaration | undefined
  bySlug(slug: string): T.Declaration | undefined
  routeForId(id: number): RouteNode | undefined
  routeForSlug(slug: string): RouteNode | undefined
  ancestors(id: number): project.RouteNode<'declaration' | 'module'>[]
}

export const create = (json: project.ProjectJson): Project => {
  const _byId = new Map()
  const _bySlug = new Map()
  const _routesById = new Map()
  const _routesBySlug = new Map()
  const _ancestors = new Map<number, number[]>()

  for (const declaration of json.declarations) {
    _byId.set(declaration.id, declaration)
  }

  const indexRoute = (r: RouteNode, ancs: number[]) => {
    if (r.page.kind === 'markdown') return
    const d = _byId.get(r.page.id)
    _bySlug.set(r.slug, d)
    _routesById.set(r.page.id, r)
    _routesBySlug.set(r.slug, r)
    _ancestors.set(r.page.id, ancs)
    for (const child of r.children) {
      indexRoute(child, [...ancs, r.page.id])
    }
  }

  for (const route of json.routes) indexRoute(route, [])

  const byId = (id: number): T.Declaration | undefined => _byId.get(id)
  const bySlug = (slug: string): T.Declaration | undefined => _bySlug.get(slug)
  const routeForId = (id: number): RouteNode | undefined => _routesById.get(id)
  const routeForSlug = (slug: string): RouteNode | undefined => _routesBySlug.get(slug)
  const ancestors = (id: number): project.RouteNode<'declaration' | 'module'>[] =>
    (_ancestors.get(id) ?? [])
      .map((x) => routeForId(x))
      .filter((x): x is project.RouteNode<'declaration' | 'module'> => x !== undefined)
  const p: Project = json as Project

  hide(p, 'byId', byId)
  hide(p, 'bySlug', bySlug)
  hide(p, 'routeForId', routeForId)
  hide(p, 'routeForSlug', routeForSlug)
  hide(p, 'ancestors', ancestors)
  return p
}

const hide = <T, K extends keyof T>(obj: T, key: K, value: T[K]) =>
  Object.defineProperty(obj, key, { value, enumerable: false, configurable: true })
