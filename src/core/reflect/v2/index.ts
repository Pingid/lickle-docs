import * as resolver from './resolver.ts'
import * as graph from './graph.ts'
import * as scan from './scan.ts'

export const generate = (files: string[], options: graph.Options): resolver.Result => {
  const g = graph.make(files, options, 0)
  scan.execute(g)
  return resolver.resolve(g)
}
