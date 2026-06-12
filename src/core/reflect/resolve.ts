import ts from 'typescript'

import type { ScanState } from './state.ts'
import * as T from './types.ts'

export const resolve = (s: ScanState) => {
  const idByDecl = s.idByNode

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

  const moduleIdForSpecifier = (origin: ts.ExportDeclaration): T.Id | undefined => {
    if (!origin.moduleSpecifier) return undefined
    const sym = s.checker.getSymbolAtLocation(origin.moduleSpecifier)
    if (!sym) return undefined
    const file = symbolSourceFile(sym)
    return file ? idByDecl.get(file) : undefined
  }

  for (const dec of s.exports) resolveExport(s, dec, idByDecl, moduleIdForSpecifier)
}

const resolveExport = (
  state: ScanState,
  exp: T.Declaration<'export'>,
  idByDecl: Map<ts.Node, T.Id>,
  moduleIdForSpecifier: (origin: ts.ExportDeclaration) => T.Id | undefined,
): void => {
  const form = state.exportsForm.get(exp.id)
  const origin = state.exportsOrigin.get(exp.id)
  if (!form || !origin) return

  // export default <expr> / export = <expr>  →  one name pointing at the target.
  if (ts.isExportAssignment(origin)) {
    const sym = state.checker.getSymbolAtLocation(origin.expression)
    if (!sym) return
    const id = idsForSymbol(idByDecl, state.checker, sym)[0]
    if (id !== undefined) exp.names.push({ name: origin.isExportEquals ? 'export=' : 'default', ref: id, type: false })
    return
  }

  // export * as foo from './x'  →  one name, points at the module itself.
  if (form === 'namespace-from') {
    const alias = state.exportsAlias.get(exp.id)
    const moduleId = moduleIdForSpecifier(origin)
    if (alias && moduleId !== undefined) exp.names.push({ name: alias, ref: moduleId, type: origin.isTypeOnly })
    return
  }

  // export * from './x'  →  re-export every named export of the module.
  if (form === 'star') {
    if (!origin.moduleSpecifier) return
    const moduleSym = state.checker.getSymbolAtLocation(origin.moduleSpecifier)
    if (!moduleSym) return
    exp.star = true
    for (const sym of state.checker.getExportsOfModule(moduleSym)) {
      const id = idsForSymbol(idByDecl, state.checker, sym)[0]
      if (id !== undefined) exp.names.push({ name: sym.getName(), ref: id, type: origin.isTypeOnly })
    }
    return
  }

  const entries = state.exportsEntries.get(exp.id) ?? []

  // export { a, b as c } from './x'  →  resolve each name in the module's exports.
  if (form === 'named-from') {
    if (!origin.moduleSpecifier) return
    const moduleSym = state.checker.getSymbolAtLocation(origin.moduleSpecifier)
    if (!moduleSym) return
    const exportSyms = state.checker.getExportsOfModule(moduleSym)
    for (const e of entries) {
      const sym = exportSyms.find((x) => x.getName() === e.name)
      if (!sym) continue
      const id = idsForSymbol(idByDecl, state.checker, sym)[0]
      if (id !== undefined) exp.names.push({ name: e.as ?? e.name, ref: id, type: e.type })
    }
    return
  }

  // named-local: export { a, b as c }  →  look each name up in local scope.
  if (origin.exportClause && ts.isNamedExports(origin.exportClause)) {
    for (const el of origin.exportClause.elements) {
      const sym = state.checker.getSymbolAtLocation(el.propertyName ?? el.name)
      if (!sym) continue
      const id = idsForSymbol(idByDecl, state.checker, sym)[0]
      if (id !== undefined) exp.names.push({ name: el.name.text, ref: id, type: origin.isTypeOnly || el.isTypeOnly })
    }
  }
}

const idsForSymbol = (idByDecl: Map<ts.Node, T.Id>, checker: ts.TypeChecker, sym: ts.Symbol): T.Id[] => {
  const collect = (sym: ts.Symbol, out: number[]): void => {
    for (const decl of sym.declarations ?? []) {
      const id = idByDecl.get(decl)
      if (id !== undefined && !out.includes(id)) out.push(id)
    }
  }
  const ids: T.Id[] = []
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

const asExternal = (
  ref: T.Type<'reference'>,
  external: 'stdlib' | 'package' | 'anonymous' | 'type-parameter',
): void => {
  const r = ref.target as Extract<T.TypeReferenceTarget, { type: 'external' }>
  r.type = 'external'
  r.external = external
}
const asInternal = (ref: T.Type<'reference'>, targetId: T.Id): void => {
  const r = ref.target as Extract<T.TypeReferenceTarget, { type: 'internal' }>
  r.type = 'internal'
  r.id = targetId
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
