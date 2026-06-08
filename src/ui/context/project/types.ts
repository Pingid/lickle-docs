import { type ClientRouter, type ProjectJson, type Declaration, type Source } from '../../../core/client/index.ts'
import type { SearchEngine } from './search.ts'

export type { SidebarRoute, GroupedItems } from '../../../core/route/client/index.ts'
export type * from './search.ts'

export interface Project extends Omit<ProjectJson, 'routes'> {
  byId(id: number): Declaration | undefined
  byName(name: string, scope: number | undefined): Declaration | undefined
  sourceLink(src: Source): string | undefined
  routes: ClientRouter
  search: Promise<SearchEngine>
}

export type * from '../../../core/client/index.ts'
