/** Client facing library entry point. */
export { type Project, create as createProject } from './project/indexed.ts'
export { type TypeRegistry } from './reflect/types.ts'
export { type ProjectJson, type Page } from './project/json.ts'
export type * from './reflect/indexed.ts'

import * as slug from '../_lib/slug/index.ts'
import type { Declaration, DeclarationQueries } from './reflect/indexed.ts'

/** Bare name of a declaration, falling back to `''` for forms without one (re-exports). */
export const nameOf = (d: Declaration): string => ('name' in d ? (d as { name: string }).name : '')

/** Reverse-edge handle (`$`) safely typed over the declaration union. */
export const queriesOf = (d: Declaration): DeclarationQueries | undefined => (d as { $?: DeclarationQueries }).$

/** Preferred display name — overrides `name` for modules whose file path is friendlier. */
export const displayNameOf = (d: Declaration): string => {
  if (d.kind === 'module') return moduleDisplayName(d)
  return 'displayName' in d ? (d as { displayName: string }).displayName : nameOf(d)
}

const moduleDisplayName = (mod: Declaration<'module'>): string => {
  if (mod.name) return mod.name
  if (mod.path) {
    const parts = mod.path.split('/')
    const last = slug.stripExt(parts[parts.length - 1] ?? '')
    if (last === 'index' && parts.length > 1) return parts[parts.length - 2]!
    return last
  }
  return '<anonymous>'
}
