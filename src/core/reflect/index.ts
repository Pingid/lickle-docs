import * as graph from './graph/index.ts'
import * as scan from './scan/index.ts'

export * as graph from './graph/index.ts'
export type * from './graph/index.ts'
export type * from './types.ts'

export const generate = (files: string[], options: graph.BuilderOptions): graph.Graph => {
  const g = graph.make(files, options, 0)
  scan.execute(g)
  return g.graph()
}
