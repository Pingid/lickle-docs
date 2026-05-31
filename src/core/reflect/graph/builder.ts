import ts from 'typescript'
import path from 'path'

import { createGraph, type Graph } from './graph.ts'
import type * as T from '../types.ts'

export interface BuilderOptions {
  rootDir: string
  /** The compiler options for the project. */
  compilerOptions: ts.CompilerOptions
  /** Whether to include a file in the scan. */
  include: (sf: ts.SourceFile) => boolean
  /** Whether to include internal declarations in the graph. */
  internal: boolean
}

export type TypeNode = T.Declaration | T.Type<'reference'>

export interface BuilderState extends BuilderOptions, ReferenceState {
  id: () => number
  entries: ts.SourceFile[]
  checker: ts.TypeChecker
  root: number
  scanned: Set<ts.SourceFile>

  byId: Map<number, TypeNode>
  byNode: Map<ts.Node, { id?: number }>

  graph(): Graph
}

export const make = (files: string[], options: BuilderOptions, root = -1): BuilderState => {
  const program = ts.createProgram(files, options.compilerOptions)
  const checker = program.getTypeChecker()

  let id = 0
  const state: BuilderState = {
    ...makeReferenceState(),
    ...options,
    entries: files.map((f) => program.getSourceFile(f)).filter((x) => x !== undefined),
    checker,
    root: root,
    id: () => ++id,
    scanned: new Set(),
    byId: new Map(),
    byNode: new Map(),
    graph: () => createGraph({ root, byId: state.byId }),
  }

  return state
}

export interface Builder {
  checker: ts.TypeChecker
  /** Get the relative path of a file. */
  path: (sf: ts.SourceFile) => string

  idOf: (node: ts.Node) => number | undefined

  add: (node: ts.Node, decl: () => TypeNode | undefined) => void

  scan: (sf: ts.SourceFile, exported?: boolean) => void

  /** Run `fn` with `parent` as the owner of any declarations it registers. */
  within: (parent: number, fn: () => void) => void

  reference: (node: ts.Node, target: ts.Node | null, type: T.Type<'reference'>) => T.Type<'reference'>
}

export const createBuilder = (
  state: BuilderState,
  module: (b: Builder, sf: ts.SourceFile, exported: boolean) => T.Declaration,
  statement: (b: Builder, stmt: ts.Node) => void,
): Builder => {
  // Owner for declarations registered in the current scope. `undefined` means
  // "the enclosing module" — set by `within` while scanning a namespace body.
  let scope: number | undefined

  const getParent = (node: ts.Node) => {
    if (ts.isSourceFile(node)) return state.root
    if (scope !== undefined) return scope
    const s = node.getSourceFile()
    if (state.byNode.has(s)) return state.byNode.get(s)?.id!
    return register(s, module(c, s, false))
  }

  const within = (parent: number, fn: () => void) => {
    const prev = scope
    scope = parent
    try {
      fn()
    } finally {
      scope = prev
    }
  }

  const register = (node: ts.Node, n: TypeNode) => {
    const parent = getParent(node)
    n.parent = parent
    n.id = state.id()
    state.byNode.set(node, { id: n.id })
    state.byId.set(n.id, n)
    return n.id
  }

  const missing = (node: ts.Node) => {
    state.byNode.set(node, { id: undefined })
    return undefined
  }

  const add = (node: ts.Node, decl: () => TypeNode | undefined) => {
    if (!state.include(ts.isSourceFile(node) ? node : node.getSourceFile())) return
    if (state.byNode.has(node)) return state.byNode.get(node)?.id!
    const d = decl()
    if (!d) return missing(node)
    return register(node, d)
  }

  const scan = (sf: ts.SourceFile, exported: boolean = false) => {
    if (state.scanned.has(sf)) return
    state.scanned.add(sf)
    const prev = scope
    scope = undefined
    if (exported) add(sf, () => module(c, sf, true))
    sf.statements.forEach((stmt) => statement(c, stmt))
    scope = prev
  }

  const addReference = (node: ts.Node, target: ts.Node | null, type: T.Type<'reference'>) => {
    if (state.originToType.has(node)) return state.originToType.get(node)!
    registerReference(node, target, type)
    const id = state.byNode.get(target!)?.id
    if (id) return resolveReference(type, id)
    state.queue.add(node)
    return type
  }

  const registerReference = (node: ts.Node, target: ts.Node | null, type: T.Type<'reference'>) => {
    type.parent = getParent(node)
    type.id = state.id()
    state.originToType.set(node, type)
    state.originToTarget.set(node, target)
    return type
  }

  const resolveReference = (type: T.Type<'reference'>, id: number) => {
    // type.targetId = id
    state.byId.set(type.id, type)
    let refs = state.references.get(id)
    if (!refs) state.references.set(id, (refs = new Set()))
    refs.add(type.id)
    return type
  }

  const drainReferenceResolution = () => {
    for (const node of [...state.queue]) {
      const target = state.originToTarget.get(node)!
      const type = state.originToType.get(node)!
      const id = state.byNode.get(target)?.id
      if (!target) continue
      // if (id !== undefined) type.targetId = id
      else {
        statement(c, target)
        const id = state.byNode.get(target)?.id
        if (id) resolveReference(type, id)
        else {
          console.log('missing reference to', target.getText())
        }
      }
    }
  }

  const original = state.graph
  state.graph = () => {
    drainReferenceResolution()
    return original()
  }

  const c: Builder = {
    checker: state.checker,
    path: (sf: ts.SourceFile) => path.relative(state.rootDir, sf.fileName),
    idOf: (node: ts.Node) => state.byNode.get(node)?.id,
    add: (node, decl) => add(node, decl) as any,
    scan: (sf, exported) => scan(sf, exported),
    within,
    reference: addReference,
  }

  return c
}

// ---------------- Reference Resolution ----------------
type ReferenceState = {
  originToTarget: Map<ts.Node, ts.Node | null>
  originToType: Map<ts.Node, T.Type<'reference'>>
  references: Map<number, Set<number>>
  queue: Set<ts.Node>
}

const makeReferenceState = (): ReferenceState => ({
  originToTarget: new Map(),
  originToType: new Map(),
  references: new Map(),
  queue: new Set(),
})

// @ts-ignore
const debugName = (node: ts.Node): string => {
  const kindName = ts.SyntaxKind[node.kind]
  if ('name' in node && node.name && ts.isIdentifier(node.name as ts.Node))
    return `${kindName} (${(node.name as ts.Identifier).text})`
  return `${kindName} (anonymous)`
}
