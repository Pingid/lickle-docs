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

  for (const n of buildTree(state)) printTree(state, n)

  return { declarations, children }
}

const printTree = (ctx: graph.State, nds: Node, prefix: string = '') => {
  const decl = ctx.byId.get(nds.id)!
  if (nds.kind === 'module') {
    console.log(`${prefix}${fm.id(decl.id)} (${decl.kind}) [${nds.alias}] ${decl.name ?? fm.path(decl)}`)
    for (const child of nds.children) printTree(ctx, child, `${prefix}  `)
  } else {
    console.log(`${prefix}${fm.id(nds.id)} (${decl.kind}) ${decl.name}`)
  }
}

type Node =
  | { kind: 'dec'; id: number; alias?: string }
  | { kind: 'module'; alias: string; id: number; children: Node[] }

const buildTree = (ctx: graph.State): Node[] => {
  const nds: Node[] = []
  for (const [id, decl] of ctx.byId) {
    if (decl.parent !== ctx.root || !decl.exported) continue
    nds.push({ kind: 'module', alias: decl.name, id: id, children: children(ctx, id) })
  }
  return nds
}

const children = (ctx: graph.State, id: number): Node[] => {
  const childs = new Set<Node>()
  for (const child of ctx.byParent.get(id)! ?? new Set()) {
    for (const l of leaf(ctx, child)) {
      childs.add(l)
    }
  }
  return Array.from(childs)
}

const leaf = (ctx: graph.State, id: number, star: boolean = false, alias?: string): Node[] => {
  const decl = ctx.byId.get(id)!
  if (decl.kind === 'export') {
    if (decl.star) return leaf(ctx, decl.ref, true)
    return leaf(ctx, decl.ref, false, decl.name)
  }
  if (decl.kind === 'module') {
    if (star) return children(ctx, id)
    return [{ kind: 'module', alias: alias ?? decl.name, id: id, children: children(ctx, id) }]
  }
  return [{ kind: 'dec', id: id }]
}

const debug = (ctx: graph.State) => {
  const parentToChildren = new Map<number, Set<number>>()
  for (const [id, decl] of ctx.byId) {
    let children = parentToChildren.get(decl.parent)
    if (!children) parentToChildren.set(decl.parent, (children = new Set()))
    children.add(id)
  }

  // console.log(parentToChildren)
  const mapped = [...parentToChildren.entries()].map(([parent, children]) => {
    const p = ctx.byId.get(parent)
    return [p, Array.from(children).map((c) => ctx.byId.get(c)!)] as [T.Declaration | undefined, T.Declaration[]]
  })

  const graph = Object.fromEntries(
    [...parentToChildren.entries()].map(([parent, children]) => {
      const p = ctx.byId.get(parent)
      const c = Array.from(children)
        .map((c) => ctx.byId.get(c)!)
        .map(fm.min)
      return [p ? `${fm.id(p.id)}: (${(p as any).path})` : 'root', c]
    }),
  )
  // console.log(Object.fromEntries([...ctx.byId.entries()].map(([id, d]) => [id, min(d)])))
  // console.log(graph)

  for (const [p, children] of mapped) {
    if (!p) {
      console.log('ROOT')
      children.forEach((c) => fm.print(...parent(c, '  ')))
      console.log('\n')
      continue
    }
    console.log('\n')
    fm.print(...parent(p))
    children.forEach((c) => fm.print(...child(c, '  ')))
  }
}

const parent = (d: T.Declaration, prefix: string = ''): string[] =>
  d.kind === 'module' ? [`${prefix}${fm.id(d.parent)}:${fm.id(d.id)}: (${d.path}) ${d.exported ? '(E)' : '(I)'}`] : []

const child = (d: T.Declaration, prefix: string = ''): string[] => {
  return [
    `${prefix}${fm.id(d.parent)}${fm.id(d.id)} ${fm.pad(18, d.kind)}: ${d.exported ? '(E)' : '(I)'} ${d.name} ${fm.str(fm.omit(d, 'exported', 'kind', 'name', 'id', 'parent', 'comment', 'sources'))}`,
  ]
}

const fm = {
  print: (...lines: string[]) => lines.forEach((l) => (l.trim() ? console.log(l) : undefined)),
  omit: <T extends object, K extends (keyof T)[]>(t: T, ...keys: K): Omit<T, K[number]> => {
    const n = { ...t }
    for (const key of keys) delete n[key]
    return n
  },
  pick: <T extends object, K extends (keyof T)[]>(t: T, ...keys: K): Pick<T, K[number]> => {
    const n = {} as any
    for (const key of keys) n[key] = t[key]
    return n
  },
  str: <T>(t: T): string => {
    if (typeof t === 'string') return t
    if (typeof t === 'number') return t.toString()
    if (typeof t === 'boolean') return t.toString()
    if (t === undefined) return 'undefined'
    if (t === null) return 'null'
    if (Array.isArray(t)) return `[${t.map(fm.str).join(', ')}]`
    return Object.entries(t)
      .map(([k, v]) => {
        return `${k}: ${fm.str(v)}`
      })
      .join(', ')
  },
  pad: (n: number, s: string) => s.padEnd(n - s.length, ' '),
  id: (id: number) => fm.pad(5, `[${id.toString()}]`),
  path: (n: object) => `${(n as any).path}`,
  min: (t: T.Declaration) => fm.str(fm.omit(t, 'parent', 'comment', 'sources')),
} as const
