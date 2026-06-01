import type { ProjectJson, RouteNode } from '../../../core/project/types.ts'
import type { Declaration } from '../../../core/reflect/types.ts'

export interface Project extends ProjectJson {
  byId(id: number): Declaration | undefined
  bySlug(slug: string): Declaration | undefined
  routeForId(id: number): RouteNode | undefined
  routeForSlug(slug: string): RouteNode | undefined
}

export type * from '../../../core/project/types.ts'
export type * from '../../../core/reflect/types.ts'
