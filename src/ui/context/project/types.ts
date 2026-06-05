import { type ClientRouter, type ProjectJson, type Declaration, type Source } from '../../../core/client/index.ts'

export interface Project extends Omit<ProjectJson, 'routes'> {
  byId(id: number): Declaration | undefined
  byName(name: string, scope: number | undefined): Declaration | undefined
  sourceLink(src: Source): string | undefined
  routes: ClientRouter
}

export type * from '../../../core/client/index.ts'
