import type * as graph from './graph.ts'
import type * as T from './types.ts'

export interface Result {
  declarations: T.Declaration[]
  children: number[]
}

export const resolve = (state: graph.State): Result => {
  const declarations: T.Declaration[] = []
  const children: number[] = []

  for (const [_, node] of state.byId) {
    declarations.push(node)
    if (node.parent === state.root) children.push(node.id)
  }

  debug(state)
  return { declarations, children }
}

const debug = (ctx: graph.State) => {
  const parentToChildren = new Map<number, number[]>()
  for (const [id, decl] of ctx.byId) {
    parentToChildren.set(decl.parent, [...(parentToChildren.get(decl.parent) || []), id])
  }

  const mapped = [...parentToChildren.entries()].map(([parent, children]) => {
    const p = ctx.byId.get(parent)
    return [p, children.map((c) => ctx.byId.get(c)!)] as [T.Declaration | undefined, T.Declaration[]]
  })

  const pad = (n: number, s: string) => s.padStart(n - s.length, ' ')

  const parent = (d: T.Declaration, prefix: string = ''): string[] =>
    d.kind === 'module' ? [`${prefix}${pad(3, d.id.toString())}: (${d.path})`] : []

  const child = (d: T.Declaration, prefix: string = ''): string[] => {
    if (d.kind === 'module') return []
    if (d.kind === 'exports') return d.names.flatMap((n) => child(ctx.byId.get(n.id)!, prefix))
    return [`${prefix}${pad(10, d.kind)}: [${pad(3, d.id.toString())}] ${d.exported ? '(E)' : '(I)'} ${d.name}`]
  }

  const print = (...lines: string[]) => lines.forEach((l) => (l.trim() ? console.log(l) : undefined))

  for (const [p, children] of mapped) {
    if (!p) {
      console.log('ROOT')
      children.forEach((c) => print(...parent(c, '  '), ...child(c, '  ')))
      console.log('\n')
      continue
    }
    print(...parent(p))
    children.forEach((c) => print(...child(c, '  ')))
  }
}
