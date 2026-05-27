/** Client facing library entry point. */
export { type Project, create as createProject } from './project/indexed.ts'
export { type TypeRegistry } from './reflect/types.ts'
export { type ProjectJson } from './project/json.ts'
export type * as Json from './reflect/resolve.ts'
export type * from './reflect/indexed.ts'
