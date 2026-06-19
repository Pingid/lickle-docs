import ts from 'typescript'

import { type ScanState as State } from '../state.ts'
import type * as T from '../types.ts'

import * as Comment from './comment.ts'
import * as Ast from './ast.ts'

export const statement = <K extends keyof T.DeclarationMap>(
  s: State,
  node: ts.Node,
  kind: K,
  fields: () => Omit<T.DeclarationMap[K], keyof T.DeclarationBase | 'kind'> & Partial<T.DeclarationBase>,
): T.Declaration<K> => {
  const b: T.DeclarationBase = base(s, node) as any
  b.id = s.nextId()
  b.name = Ast.getName(node) ?? 'unknown'
  b.exported = Ast.isExported(node)

  const named = (node as { name?: ts.Node }).name
  const sym = s.checker.getSymbolAtLocation(named ?? node)
  if (sym) {
    s.symbolsById.set(b.id, sym)
    for (const d of sym.declarations ?? []) s.idByNode.set(d, b.id)
  }

  s.currentStmt = b.id
  Object.assign(b, fields(), { kind })
  s.declarations.set(b.id, b as any)
  return b as any
}

export const type = <K extends keyof T.TypeMap>(
  s: State,
  node: ts.Node,
  kind: K,
  fields: Omit<T.TypeMap[K], keyof T.DeclarationBase | 'kind'> & Partial<T.DeclarationBase>,
): T.Type<K> => {
  const nd = base(s, node) as unknown as T.Type<K>
  Object.assign(nd, { kind }, fields)
  return nd as any
}

export const part = <K extends keyof T.PartMap>(
  s: State,
  node: ts.Node,
  kind: K,
  fields: Omit<T.PartMap[K], 'kind' | 'name' | keyof T.NodeBase> & { name?: string },
): T.Part<K> => {
  const nd = base(s, node) as T.NodeBase & { kind?: string; name?: string }
  Object.assign(nd, { kind }, fields)
  if (nd.name === undefined) {
    const n = Ast.getName(node)
    if (n !== undefined) nd.name = n
  }
  return nd as any
}

const base = (s: State, node: ts.Node): T.NodeBase => {
  const result: T.NodeBase = { parent: s.parent, sources: [] } as T.NodeBase

  const named = (node as { name?: ts.Node }).name
  const sym = s.checker.getSymbolAtLocation(named ?? node)
  if (sym?.declarations?.length) result.sources = sym.declarations!.map((d) => sourceOf(s, d))
  else result.sources = [sourceOf(s, node)]

  const comment = ts.isSourceFile(node) ? Comment.commentForModule(s, node) : Comment.commentForNode(s, node)
  if (comment) result.comment = comment

  return result
}

const sourceOf = (s: State, node: ts.Node): T.Source => {
  const sf = node.getSourceFile()
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart())
  return { file: s.getPath(sf), line: line + 1, column: character + 1 }
}
