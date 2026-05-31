import ts from 'typescript'

import type { ScanState } from './state.ts'
import * as T from './types.ts'

export const resolve = (s: ScanState) => {
  const idByDecl = new Map<ts.Node, number>()
  for (const [id, sym] of s.symbolsById) sym.declarations?.forEach((d) => idByDecl.set(d, id))

  for (const ref of s.references) {
    const sym = s.referenceSymbols.get(ref.id) ?? symbolAt(s.checker, s.referenceOrigins.get(ref.id))
    if (!sym) {
      asExternal(ref, 'anonymous')
      continue
    }
    const ids = idsForSymbol(idByDecl, s.checker, sym)
    if (ids[0]) asInternal(ref, ids[0])
    else asExternal(ref, classifySymbol(sym))
  }

  const moduleIdForSpecifier = (origin: ts.ExportDeclaration): number | undefined => {
    if (!origin.moduleSpecifier) return undefined
    const sym = s.checker.getSymbolAtLocation(origin.moduleSpecifier)
    if (!sym) return undefined
    const file = symbolSourceFile(sym)
    return file ? idByDecl.get(file) : undefined
  }

  for (const c1 of s.exports) resolveExport(s, c1, idByDecl, moduleIdForSpecifier)

  return s
}

const resolveExport = (
  s: ScanState,
  exp: T.Declaration<'export'>,
  idByDecl: Map<ts.Node, number>,
  moduleIdForSpecifier: (origin: ts.ExportDeclaration) => number | undefined,
): void => {
  const form = s.exportsForm.get(exp.id)
  const origin = s.exportsOrigin.get(exp.id)
  if (!form || !origin) return

  // export default <expr> / export = <expr>  →  one name pointing at the target.
  if (ts.isExportAssignment(origin)) {
    const sym = s.checker.getSymbolAtLocation(origin.expression)
    if (!sym) return
    const id = idsForSymbol(idByDecl, s.checker, sym)[0]
    if (id !== undefined) exp.names.push({ name: origin.isExportEquals ? 'export=' : 'default', ref: id })
    return
  }

  // export * as foo from './x'  →  one name, points at the module itself.
  if (form === 'namespace-from') {
    const alias = s.exportsAlias.get(exp.id)
    const moduleId = moduleIdForSpecifier(origin)
    if (alias && moduleId !== undefined) exp.names.push({ name: alias, ref: moduleId })
    return
  }

  // export * from './x'  →  re-export every named export of the module.
  if (form === 'star') {
    if (!origin.moduleSpecifier) return
    const moduleSym = s.checker.getSymbolAtLocation(origin.moduleSpecifier)
    if (!moduleSym) return
    exp.star = true
    for (const sym of s.checker.getExportsOfModule(moduleSym)) {
      const id = idsForSymbol(idByDecl, s.checker, sym)[0]
      if (id !== undefined) exp.names.push({ name: sym.getName(), ref: id })
    }
    return
  }

  const entries = s.exportsEntries.get(exp.id) ?? []

  // export { a, b as c } from './x'  →  resolve each name in the module's exports.
  if (form === 'named-from') {
    if (!origin.moduleSpecifier) return
    const moduleSym = s.checker.getSymbolAtLocation(origin.moduleSpecifier)
    if (!moduleSym) return
    const exportSyms = s.checker.getExportsOfModule(moduleSym)
    for (const e of entries) {
      const sym = exportSyms.find((x) => x.getName() === e.name)
      if (!sym) continue
      const id = idsForSymbol(idByDecl, s.checker, sym)[0]
      if (id !== undefined) exp.names.push({ name: e.as ?? e.name, ref: id })
    }
    return
  }

  // named-local: export { a, b as c }  →  look each name up in local scope.
  if (origin.exportClause && ts.isNamedExports(origin.exportClause)) {
    for (const el of origin.exportClause.elements) {
      const sym = s.checker.getSymbolAtLocation(el.propertyName ?? el.name)
      if (!sym) continue
      const id = idsForSymbol(idByDecl, s.checker, sym)[0]
      if (id !== undefined) exp.names.push({ name: el.name.text, ref: id })
    }
  }
}

const idsForSymbol = (idByDecl: Map<ts.Node, number>, checker: ts.TypeChecker, sym: ts.Symbol): number[] => {
  const collect = (s: ts.Symbol, out: number[]): void => {
    for (const decl of s.declarations ?? []) {
      const id = idByDecl.get(decl)
      if (id !== undefined && !out.includes(id)) out.push(id)
    }
  }
  const ids: number[] = []
  collect(sym, ids)

  // Export specifiers / import aliases declare themselves as the symbol's
  // declarations, which are never in `idByDecl`. Follow the alias chain so
  // local re-exports (`export { Foo }`) and re-exported re-exports resolve.
  if (sym.flags & ts.SymbolFlags.Alias) {
    const target = checker.getAliasedSymbol(sym)
    if (target !== sym) collect(target, ids)
  }
  return ids
}

const symbolAt = (checker: ts.TypeChecker, origin?: ts.Node): ts.Symbol | undefined => {
  if (!origin) return undefined
  if (ts.isTypeReferenceNode(origin) || ts.isExpressionWithTypeArguments(origin)) {
    const target = ts.isTypeReferenceNode(origin) ? origin.typeName : origin.expression
    const direct = checker.getSymbolAtLocation(target)
    if (direct) return direct
  }
  return undefined
}

const asExternal = (ref: T.Type<'reference'>, external: 'stdlib' | 'package' | 'anonymous' | 'type-parameter'): void => {
  const r = ref as Extract<T.Type<'reference'>, { type: 'external' }>
  r.type = 'external'
  r.external = external
}
const asInternal = (ref: T.Type<'reference'>, targetId: number): void => {
  const r = ref as Extract<T.Type<'reference'>, { type: 'internal' }>
  r.type = 'internal'
  r.targetId = targetId
}

const symbolSourceFile = (sym?: ts.Symbol): ts.SourceFile | undefined =>
  sym?.declarations?.find(ts.isSourceFile) ?? sym?.declarations?.[0]?.getSourceFile()

const classifySymbol = (sym: ts.Symbol): 'stdlib' | 'package' | 'anonymous' | 'type-parameter' => {
  if (sym.flags & ts.SymbolFlags.TypeParameter) return 'type-parameter'
  const decl = sym.declarations?.[0]
  if (!decl) return 'anonymous'
  const file = decl.getSourceFile().fileName
  if (/[\\/]node_modules[\\/]typescript[\\/]lib[\\/]/.test(file) || /[\\/]lib\.[^\\/]+\.d\.ts$/.test(file)) {
    return 'stdlib'
  }
  if (file.includes('/node_modules/') || file.includes('\\node_modules\\')) return 'package'
  return 'anonymous'
}
