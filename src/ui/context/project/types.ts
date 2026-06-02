import type { ProjectJson, RouteNode } from '../../../core/project/types.ts'
import type { Declaration, Module } from '../../../core/reflect/types.ts'

export interface Project extends ProjectJson {
  byId(id: number): Declaration | undefined
  bySlug(slug: string): Declaration | undefined
  mod(module: number): Module | undefined
  routeByName(name: string): RouteNode | undefined
  routeForId(id: number): RouteNode | undefined
  routeForSlug(slug: string): RouteNode | undefined
}

export type * from '../../../core/project/types.ts'
export type * from '../../../core/reflect/types.ts'
