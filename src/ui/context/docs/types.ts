import type { Link, ProjectVersion } from '../../../core/config/types.ts'

export type { SidebarRoute, GroupedItems } from '../../../core/route/client/index.ts'
export type * from '../../../core/client/index.ts'

type MaybeGetter<T> = (() => Promise<T> | T) | T

export interface DocsJson {
  /** The name of the project. */
  name: string
  /** Links for the project. */
  links: Link[]
  /** Versions of the project. */
  versions: DocsVersion[]
}

export interface DocsVersion {
  version: string
  slug: string
  alias?: string
  get: MaybeGetter<ProjectVersion>
}
