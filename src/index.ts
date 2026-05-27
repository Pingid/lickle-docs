/** Client facing library entry point. */
export { type Project, create as createProject } from './core/project/indexed.ts'
export { type TypeRegistry } from './core/reflect/types.ts'
export { type ProjectJson } from './core/project/json.ts'
export type * from './core/reflect/indexed.ts'
