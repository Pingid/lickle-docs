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
  scanned: Set<ts.SourceFile>

  byId: Map<number, T.Declaration>
  byParent: Map<number, Set<number>>
  byNode: Map<ts.Node, { id?: number }>
}

export const make = (files: string[], options: Options, root = -1): State => {
  const program = ts.createProgram(files, options.compilerOptions)
  const checker = program.getTypeChecker()

  const state: State = {
    ...options,
    entries: files.map((f) => program.getSourceFile(f)).filter((x) => x !== undefined),
    checker,
    root: root,
    id: root,
    // parent,
    scanned: new Set(),
    byParent: new Map(),
    byId: new Map(),
    byNode: new Map(),
  }

  return state
}

export interface Builder {
  checker: ts.TypeChecker
  /** Get the relative path of a file. */
  path: (sf: ts.SourceFile) => string

  idOf: (node: ts.Node) => number | undefined

  add: <const T extends T.Declaration | undefined>(
    node: ts.Node,
    decl: () => T,
  ) => T extends undefined ? undefined : number

  scan: (sf: ts.SourceFile, exported?: boolean) => void
}

export const createBuilder = (
  state: State,
  registerModule: (b: Builder, sf: ts.SourceFile, exported: boolean) => T.Declaration,
  registerStatement: (b: Builder, stmt: ts.Statement) => void,
): Builder => {
  const id = () => ++state.id

  const getParent = (node: ts.Node) => {
    if (ts.isSourceFile(node)) return state.root
    const s = node.getSourceFile()
    if (state.byNode.has(s)) return state.byNode.get(s)?.id!
    return register(s, registerModule(c, s, false))
  }

  const register = (node: ts.Node, n: T.Declaration) => {
    const parent = getParent(node)
    n.parent = parent
    n.id = id()
    state.byNode.set(node, { id: n.id })
    state.byId.set(n.id, n)
    let children = state.byParent.get(parent)
    if (!children) state.byParent.set(parent, (children = new Set()))
    children.add(n.id)
    return n.id
  }

  const missing = (node: ts.Node) => {
    state.byNode.set(node, { id: undefined })
    return undefined
  }

  const add = (node: ts.Node, decl: () => T.Declaration | undefined) => {
    if (!state.include(ts.isSourceFile(node) ? node : node.getSourceFile())) return

    if (state.byNode.has(node)) return state.byNode.get(node)?.id!
    const d = decl()
    if (!d) return missing(node)
    if (!state.internal && !d.exported) return missing(node)
    return register(node, d)
  }

  const scan = (sf: ts.SourceFile, exported: boolean = false) => {
    if (state.scanned.has(sf)) return
    state.scanned.add(sf)
    if (exported) add(sf, () => registerModule(c, sf, true))
    sf.statements.forEach((stmt) => registerStatement(c, stmt))
  }

  const c: Builder = {
    checker: state.checker,
    path: (sf: ts.SourceFile) => path.relative(state.rootDir, sf.fileName),
    idOf: (node: ts.Node) => state.byNode.get(node)?.id,
    add: (node, decl) => add(node, decl) as any,
    scan: (sf, exported) => scan(sf, exported),
  }

  return c
}

// @ts-ignore
const debugName = (node: ts.Node): string => {
  const kindName = ts.SyntaxKind[node.kind]
  if ('name' in node && node.name && ts.isIdentifier(node.name as ts.Node))
    return `${kindName} (${(node.name as ts.Identifier).text})`
  return `${kindName} (anonymous)`
}
