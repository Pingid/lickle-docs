/** Client facing library entry point. */
export { type Project, create as createProject } from './project/indexed.ts'
export { type TypeRegistry } from './reflect/types.ts'
export { type ProjectJson } from './project/json.ts'
export type * from './reflect/indexed.ts'

import type { Declaration, DeclarationQueries } from './reflect/indexed.ts'

/** Bare name of a declaration, falling back to `''` for forms without one (re-exports). */
export const nameOf = (d: Declaration): string => ('name' in d ? (d as { name: string }).name : '')

/** Preferred display name — overrides `name` for modules whose file path is friendlier. */
export const displayNameOf = (d: Declaration): string =>
  'displayName' in d ? (d as { displayName: string }).displayName : nameOf(d)

/** Reverse-edge handle (`$`) safely typed over the declaration union. */
export const queriesOf = (d: Declaration): DeclarationQueries | undefined => (d as { $?: DeclarationQueries }).$
