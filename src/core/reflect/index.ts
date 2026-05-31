import * as graph from './graph/index.ts'
import * as scan2 from './scan2/index.ts'

export * as graph from './graph/index.ts'
export * as scan2 from './scan2/index.ts'
export type * from './graph/index.ts'
export type * from './types.ts'

export const generate = (files: string[], options: graph.BuilderOptions): scan2.Graph => scan2.generate(files, options)
