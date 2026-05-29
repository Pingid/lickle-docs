import ts from 'typescript'

import type * as context from './graph.ts'
import type * as T from './types.ts'

// ---------------- Node Construction Helpers ----------------
export const decl = <K extends keyof T.DeclarationKinds>(
  b: context.Builder,
  node: ts.Node,
  kind: K,
  fields: Omit<T.Declaration<K>, keyof T.DeclarationBase | 'kind'> & Partial<T.DeclarationBase>,
): T.Declaration<K> => {
  const nd = base(b, node) as T.Declaration<K>
  nd.id = b.id()
  nd.kind = kind
  nd.exported = isExported(node)
  Object.assign(nd, fields)
  return nd as any
}

export const kind = <K extends keyof T.TypeKinds>(
  b: context.Builder,
  node: ts.Node,
  kind: K,
  fields: Omit<T.TypeKinds[K], keyof T.Base | 'kind'>,
): T.TypeKinds[K] => {
  const nd = base(b, node) as any
  nd.kind = kind as any
  nd.name = (node as { name?: ts.Node }).name?.getText()
  Object.assign(nd, fields)
  return nd as any
}

const base = (b: context.Builder, node: ts.Node): T.Base => {
  const id = b.id()

  const result: T.Base = { id, name: getName(node), parent: b.parent() } as T.Base

  const sym = b.checker.getSymbolAtLocation(node)
  if (sym?.declarations?.length) result.sources = sym.declarations!.map((d) => sourceOf(b, d))
  else result.sources = [sourceOf(b, node)]

  return result
}

const sourceOf = (b: context.Builder, node: ts.Node): T.Source => {
  const sf = node.getSourceFile()
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart())
  return { file: b.path(sf), line: line + 1, column: character + 1 }
}

// ---------------- Naming ----------------
export const moduleName = (b: context.Builder, sf: ts.SourceFile): string => {
  const pth = b.path(sf)
  const n = pth.split('/')
  if (!n.length) return ''
  if (n[n.length - 1]!.startsWith('index')) n.pop()
  else n[n.length - 1] = n[n.length - 1]!.replace(/\.[^/.]+$/, '')
  return n.join('.')
}

// ---------------- Ast utils ----------------
export const findSourceSymbol = (b: context.Builder, symbol?: ts.Symbol): ts.Symbol | undefined => {
  // 2. Step backward through the 'import' alias
  let currentSymbol = symbol

  // Loop to traverse through potential chains of aliases
  while (currentSymbol?.flags && currentSymbol.flags & ts.SymbolFlags.Alias) {
    const next = b.checker.getImmediateAliasedSymbol(currentSymbol)
    if (next) currentSymbol = next
    else break
  }

  return currentSymbol
}

export const symbolSourceFile = (symbol?: ts.Symbol): ts.SourceFile | undefined =>
  symbol?.declarations?.find(ts.isSourceFile) || symbol?.declarations?.[0]?.getSourceFile()

export const isExported = (node: ts.Node): boolean => {
  if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) return true
  const mods = (node as { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

const getName = (node: ts.Node): string | undefined => {
  if (ts.isDeclarationStatement(node)) return ts.getNameOfDeclaration(node)?.getText()
  if (ts.isExpression(node)) return ts.getNameOfDeclaration(node)?.getText()
  if ((node as { name?: ts.Node }).name) return (node as { name?: ts.Node }).name!.getText()
  return undefined
}
