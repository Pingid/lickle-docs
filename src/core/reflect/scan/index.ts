import ts from 'typescript'

import * as graph from '../graph/index.ts'
import * as make from './make.ts'

type Context = graph.Builder

export const execute = (state: graph.BuilderState) => {
  const b = graph.createBuilder(state, module_, statement)
  state.entries.forEach((sf) => b.scan(sf, true))
}

const statement = (ctx: Context, node: ts.Node) => {
  if (ts.isVariableStatement(node)) return node.declarationList.declarations.forEach((d) => variable_(ctx, d))
  if (ts.isVariableDeclaration(node)) return variable_(ctx, node)
  if (ts.isFunctionDeclaration(node)) return function_(ctx, node)
  if (ts.isClassDeclaration(node)) return class_(ctx, node)
  if (ts.isInterfaceDeclaration(node)) return interface_(ctx, node)
  if (ts.isTypeAliasDeclaration(node)) return alias_(ctx, node)
  if (ts.isEnumDeclaration(node)) return enum_(ctx, node)
  if (ts.isModuleDeclaration(node)) return namespace_(ctx, node)
  if (ts.isExportDeclaration(node)) return exports_(ctx, node)
  if (ts.isImportDeclaration(node)) return undefined
  console.trace(`unknown statement: ${make.nodeTypeName(node)}`)
  return undefined
}

// ---------------- Declaration Construction ----------------
const wrap =
  <const A extends any[], N extends ts.Node = ts.Node>(cb: (ctx: Context, node: N, ...args: A) => graph.TypeNode) =>
  (ctx: Context, node: N, ...args: A) =>
    ctx.add(node, () => cb(ctx, node, ...args))

const module_ = (ctx: Context, sf: ts.SourceFile, exported: boolean = false) => {
  const d = make.decl(ctx, sf, 'module', { path: ctx.path(sf) })
  d.exported = exported
  return d
}

const variable_ = wrap((c, n: ts.VariableDeclaration) => {
  const init = n.initializer
  // `const f = () => …` reads as a function, not a value.
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)))
    return make.decl(c, n, 'function', make.functionBody(c, init))
  return make.decl(c, n, 'variable', make.variableBody(c, n))
})

const function_ = wrap((c, n: ts.FunctionDeclaration) => make.decl(c, n, 'function', make.functionBody(c, n)))

const class_ = wrap((c, n: ts.ClassDeclaration) => make.decl(c, n, 'class', make.classBody(c, n)))

const interface_ = wrap((c, n: ts.InterfaceDeclaration) => make.decl(c, n, 'interface', make.interfaceBody(c, n)))

const alias_ = wrap((c, n: ts.TypeAliasDeclaration) => make.decl(c, n, 'type-alias', make.aliasBody(c, n)))

const enum_ = wrap((c, n: ts.EnumDeclaration) => make.decl(c, n, 'enum', make.enumBody(c, n)))

const namespace_ = (ctx: Context, n: ts.ModuleDeclaration): number | undefined => {
  ctx.add(n, () => make.decl(ctx, n, 'namespace', {}))
  const id = ctx.idOf(n)
  const body = n.body
  if (id === undefined || !body) return id
  // `namespace A { … }` → scan the block; `namespace A.B { … }` → recurse on `B`.
  if (ts.isModuleBlock(body)) ctx.within(id, () => body.statements.forEach((s) => statement(ctx, s)))
  else if (ts.isModuleDeclaration(body)) ctx.within(id, () => namespace_(ctx, body))
  return id
}

const export_ = wrap((ctx, node, name: string, ref: number, star: boolean = false) =>
  make.decl(ctx, node, 'export', { name, ref, exported: true, star } as any),
)

const exports_ = (ctx: Context, node: ts.ExportDeclaration) => {
  if (!node.exportClause && node.moduleSpecifier) return exports_.star(ctx, node.moduleSpecifier)
  if (!node.exportClause) return undefined
  if (ts.isNamespaceExport(node.exportClause)) return exports_.namespace(ctx, node, node.exportClause)
  if (ts.isNamedExports(node.exportClause)) return exports_.named(ctx, node.exportClause)
  return undefined
}

/** Namespace exports `export * as myNamespace from './module'` */
exports_.namespace = (ctx: Context, node: ts.ExportDeclaration, clause: ts.NamespaceExport) => {
  if (!node.moduleSpecifier) return undefined
  const moduleSymbol = ctx.checker.getSymbolAtLocation(node.moduleSpecifier)
  if (!moduleSymbol) return undefined
  const sourceSymbol = make.findSourceSymbol(ctx, moduleSymbol)
  const sourceFile = make.symbolSourceFile(sourceSymbol)
  if (!sourceFile) return undefined
  ctx.scan(sourceFile)
  const id = ctx.idOf(sourceFile)
  if (id !== undefined) export_(ctx, node, clause.name.text, id)
}

/** Named exports `export { foo, bar } from './module'` */
exports_.named = (ctx: Context, clause: ts.NamedExports) => {
  for (const c of clause.elements) {
    const targetNode = c.propertyName ?? c.name
    const symbol = ctx.checker.getSymbolAtLocation(targetNode)
    if (!symbol) continue

    const sourceSymbol = make.findSourceSymbol(ctx, symbol)
    const decls = sourceSymbol?.declarations
    if (!decls) continue

    for (const d of decls) {
      if (ts.isSourceFile(d)) {
        ctx.scan(d)
        continue
      }

      if (ts.isExportSpecifier(d)) continue
      else if (ts.isImportSpecifier(d)) continue
      else statement(ctx, d)

      const id = ctx.idOf(d)
      if (id !== undefined) {
        export_(ctx, c.name, c.name.text, id)
      }
    }
  }
}

/** Star exports `export * from './module'` */
exports_.star = (ctx: Context, node: ts.Expression) => {
  const moduleSymbol = ctx.checker.getSymbolAtLocation(node)
  if (!moduleSymbol) return undefined
  const sourceFile = make.symbolSourceFile(moduleSymbol)
  if (!sourceFile) return undefined
  ctx.scan(sourceFile)
  const id = ctx.idOf(sourceFile)
  if (id !== undefined) export_(ctx, node, '', id, true)
}
