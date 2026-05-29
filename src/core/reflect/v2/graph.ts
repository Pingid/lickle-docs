import ts from 'typescript'
import path from 'path'

import type * as T from './types.ts'

export interface Options {
  rootDir: string
  /** The source directory of the project. Modules are named based on files relative to this. */
  srcDir: string
  /** The compiler options for the project. */
  compilerOptions: ts.CompilerOptions
  /** Whether to include a file in the scan. */
  include: (sf: ts.SourceFile) => boolean
  /** Whether to include internal declarations in the graph. */
  internal: boolean
}

export interface State extends Options {
  entries: ts.SourceFile[]
  checker: ts.TypeChecker
  root: number
  id: number
  parent: number
  files: Map<ts.SourceFile, number>

  byId: Map<number, T.Declaration>
  byNode: Map<ts.Node, number>
  childs: Map<number, Set<number>>
}

export const make = (files: string[], options: Options, parent = -1): State => {
  const program = ts.createProgram(files, options.compilerOptions)
  const checker = program.getTypeChecker()

  const state: State = {
    entries: files.map((f) => program.getSourceFile(f)).filter((x) => x !== undefined),
    checker,
    ...options,
    root: parent,
    id: parent,
    parent,
    files: new Map(),
    byId: new Map(),
    byNode: new Map(),
    childs: new Map(),
  }

  return state
}

export interface Builder {
  checker: ts.TypeChecker
  /** Get the next unique id for a node. */
  id: () => number
  /** Get the relative path of a file. */
  path: (sf: ts.SourceFile) => string
  /** Get the parent of the current node. */
  parent: () => number
  /** Add a node to the graph. */
  add: (node: ts.Node, make: (b: Builder, node: ts.Node) => T.Declaration | undefined) => number | undefined
  /** Add a single node to the graph as a child of the file */
  addIn: (sf: ts.SourceFile, f: (parent: number) => void) => number | undefined
  /** Add all nodes in a file to the graph as children of the file */
  addAll: (sf: ts.SourceFile, f: (parent: number) => void) => number | undefined
}

export const createBuilder = (state: State, makeParent: (b: Builder, sf: ts.SourceFile) => T.Declaration): Builder => {
  const c: Builder = {} as any
  c.checker = state.checker
  c.id = () => ++state.id
  c.path = (sf: ts.SourceFile) => path.relative(state.rootDir, sf.fileName)
  c.parent = () => state.parent

  c.add = (node, make) => {
    // if (!state.internal && !isExported(node)) return undefined
    if (state.byNode.has(node)) return state.byNode.get(node)!
    const n = make(c, node)
    if (!n) return undefined as any
    state.byId.set(n.id, n)
    state.byNode.set(node, n.id)
    let childs = state.childs.get(state.parent)
    if (!childs) state.childs.set(state.parent, (childs = new Set()))
    childs.add(n.id)
    return n.id as any
  }
  c.addAll = (sf, f) => {
    if (!state.include(sf)) return undefined
    if (state.files.has(sf)) return state.files.get(sf)!
    const id = c.add(sf, () => makeParent(c, sf))!
    state.files.set(sf, id)
    let previous = state.parent
    state.parent = id
    f(state.parent)
    state.parent = previous
    return id
  }
  c.addIn = (sf, f) => {
    if (!state.include(sf)) return undefined
    if (state.files.has(sf)) return state.files.get(sf)!
    const id = c.add(sf, () => makeParent(c, sf))!
    let previous = state.parent
    state.parent = id
    f(state.parent)
    state.parent = previous
    return id
  }

  return c
}
