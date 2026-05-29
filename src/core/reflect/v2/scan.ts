import ts from 'typescript'

import type * as T from './types.ts'
import * as graph from './graph.ts'
import * as make from './make.ts'

type Context = graph.Builder

export const execute = (state: graph.State) => {
  const builder = graph.createBuilder(state, module_)
  for (const sf of state.entries) {
    builder.addAll(sf, () => {
      for (const stmt of sf.statements) builder.add(stmt, () => statement(builder, stmt))
    })
  }
}

const statement = (ctx: Context, node: ts.Node): T.Declaration | undefined => {
  if (ts.isExportDeclaration(node)) return exports_(ctx, node)
  if (ts.isVariableDeclaration(node)) return variable_(ctx, node)
  if (ts.isFunctionDeclaration(node)) return function_(ctx, node)
  if (ts.isClassDeclaration(node)) return class_(ctx, node)
  if (ts.isInterfaceDeclaration(node)) return interface_(ctx, node)
  if (ts.isTypeAliasDeclaration(node)) return alias_(ctx, node)
  if (ts.isEnumDeclaration(node)) return enum_(ctx, node)
  if (ts.isModuleDeclaration(node)) return namespace_(ctx, node)
  return undefined
}

// ---------------- Declaration Construction ----------------
const module_ = (ctx: Context, sf: ts.SourceFile) => {
  console.log('')
  const d = make.decl(ctx, sf, 'module', { path: ctx.path(sf) })
  d.exported = true
  d.name = make.moduleName(ctx, sf)
  return d
}

const variable_ = (ctx: Context, n: ts.VariableDeclaration) => make.decl(ctx, n, 'variable', {})

const function_ = (ctx: Context, n: ts.FunctionDeclaration) => make.decl(ctx, n, 'function', {})

const class_ = (ctx: Context, n: ts.ClassDeclaration) => make.decl(ctx, n, 'class', {})

const interface_ = (ctx: Context, n: ts.InterfaceDeclaration) => make.decl(ctx, n, 'interface', {})

const alias_ = (ctx: Context, n: ts.TypeAliasDeclaration) => make.decl(ctx, n, 'alias', {})

const enum_ = (ctx: Context, n: ts.EnumDeclaration) => make.decl(ctx, n, 'enum', {})

const namespace_ = (ctx: Context, n: ts.ModuleDeclaration) => make.decl(ctx, n, 'namespace', {})

const exports_ = (ctx: Context, node: ts.ExportDeclaration): T.Declaration<'exports'> | undefined => {
  if (!node.exportClause && node.moduleSpecifier) return exports_.star(ctx, node)
  if (!node.exportClause) return undefined
  if (ts.isNamedExports(node.exportClause)) return exports_.named(ctx, node, node.exportClause)
  if (ts.isNamespaceExport(node.exportClause)) return exports_.namespace(ctx, node, node.exportClause)
  return undefined
}

/** Namespace exports `export * as myNamespace from './module'` */
exports_.namespace = (
  ctx: Context,
  node: ts.ExportDeclaration,
  clause: ts.NamespaceExport,
): T.Declaration<'exports'> | undefined => {
  if (!node.moduleSpecifier) return undefined
  const moduleSymbol = ctx.checker.getSymbolAtLocation(node.moduleSpecifier)
  if (!moduleSymbol) return undefined
  const sourceSymbol = make.findSourceSymbol(ctx, moduleSymbol)
  const sourceFile = make.symbolSourceFile(sourceSymbol)
  if (!sourceFile) return undefined
  const n = ctx.addAll(sourceFile, () => sourceFile.statements.forEach((stmt) => ctx.add(stmt, statement)))
  if (!n) return undefined
  const name = clause.name.text
  return make.decl(ctx, node, 'exports', { names: [{ name, id: n }], exported: true, name })
}

/** Named exports `export { foo, bar } from './module'` */
exports_.named = (ctx: Context, node: ts.ExportDeclaration, clause: ts.NamedExports): T.Declaration<'exports'> => {
  const symbols = clause.elements
    .map((c) => {
      const symbol = ctx.checker.getSymbolAtLocation(c.name)
      if (!symbol) return undefined
      return { symbol, name: c.name.text }
    })
    .filter((s) => s !== undefined)
  return makeExportsFromSymbols(
    ctx,
    node,
    symbols.length,
    symbols.map((s) => s.name).join(', '),
    (i) => symbols[i]!.symbol,
    (i) => symbols[i]!.name,
  )
}

/** Star exports `export * from './module'` */
exports_.star = (ctx: Context, node: ts.ExportDeclaration): T.Declaration<'exports'> | undefined => {
  const moduleSymbol = ctx.checker.getSymbolAtLocation(node.moduleSpecifier!)
  if (!moduleSymbol) return undefined
  const exportedSymbols = ctx.checker.getExportsOfModule(moduleSymbol)
  return makeExportsFromSymbols(
    ctx,
    node,
    exportedSymbols.length,
    '*',
    (i) => exportedSymbols[i]!,
    (i) => exportedSymbols[i]!.getName(),
  )
}

const makeExportsFromSymbols = (
  ctx: Context,
  node: ts.ExportDeclaration,
  count: number,
  name: string,
  getSymbol: (i: number) => ts.Symbol,
  getName: (i: number) => string,
): T.Declaration<'exports'> => {
  let names: { name: string; id: number }[] = []
  for (let i = 0; i < count; i++) {
    const name = getName(i)
    const symbol = getSymbol(i)
    const sourceSymbol = make.findSourceSymbol(ctx, symbol)
    const sourceFile = make.symbolSourceFile(sourceSymbol)
    const decl = sourceSymbol?.declarations?.[0]
    if (!decl || !sourceFile) continue
    const id = ctx.addIn(sourceFile, () => ctx.add(decl, statement))
    if (!id) continue
    names.push({ name, id })
  }
  return make.decl(ctx, node, 'exports', { names, exported: true, name })
}
