import ts from 'typescript'

import type * as T from './types.js'
import * as walk from './walk.ts'

/**
 * Information the first pass must record so the second pass can resolve names
 * to declaration ids via the checker. Keyed by reflection id.
 */
export interface ResolverContext {
  checker: ts.TypeChecker
  /** For each declaration id, the symbol it came from. */
  symbolsById: Map<number, ts.Symbol>
  /** For each reference id, the node it was generated from (so we can re-ask the checker for symbols in scope at that location). */
  referenceOrigins: Map<number, ts.Node>
  /** For each ReExportReflection, the ExportDeclaration / ExportSpecifier it was generated from. */
  reExportOrigins: Map<T.ReExportReflection, ts.Node>
}

/**
 * Walk the project and populate `targetId` on every ReferenceType, and
 * `resolvedIds` on every ReExportReflection, whose declarations we know about.
 *
 * Mutates in place and returns the same object for convenience.
 */
export const resolveReferences = (project: T.ProjectReflection, ctx: ResolverContext): T.ProjectReflection => {
  // Build a lookup from any declaration node belonging to a recorded symbol
  // back to its reflection id. Symbols can have multiple declarations (merged
  // interfaces, namespaces) so we index every one.
  const idByDecl = new Map<ts.Node, number>()
  for (const [id, sym] of ctx.symbolsById) {
    sym.declarations?.forEach((d) => idByDecl.set(d, id))
  }

  /** All in-project reflection ids contributed by `sym` (after following aliases). */
  const idsForSymbol = (sym: ts.Symbol): number[] => {
    const target = sym.flags & ts.SymbolFlags.Alias ? ctx.checker.getAliasedSymbol(sym) : sym
    const ids: number[] = []
    for (const decl of target.declarations ?? []) {
      const id = idByDecl.get(decl)
      if (id !== undefined && !ids.includes(id)) ids.push(id)
    }
    return ids
  }

  const resolveRef = (ref: T.ReferenceType): void => {
    if (ref.targetId !== undefined) return
    const origin = ctx.referenceOrigins.get(ref.id)
    if (!origin) return
    const sym = symbolAt(origin, ref.name, ctx.checker)
    if (!sym) return
    const [first] = idsForSymbol(sym)
    if (first !== undefined) ref.targetId = first
  }

  /** `export { a as b }` — `propertyName` is the source name when aliased. */
  const idsForNamedReExport = (specifier: ts.Node): number[] => {
    if (!ts.isExportSpecifier(specifier)) return []
    const sym = ctx.checker.getSymbolAtLocation(specifier.propertyName ?? specifier.name)
    return sym ? idsForSymbol(sym) : []
  }

  /** `export * [as foo] from './x'` — enumerate every export of the source module. */
  const idsForStarReExport = (decl: ts.Node): number[] => {
    if (!ts.isExportDeclaration(decl) || !decl.moduleSpecifier) return []
    const moduleSym = ctx.checker.getSymbolAtLocation(decl.moduleSpecifier)
    if (!moduleSym) return []
    const ids: number[] = []
    for (const exp of ctx.checker.getExportsOfModule(moduleSym)) {
      for (const id of idsForSymbol(exp)) if (!ids.includes(id)) ids.push(id)
    }
    return ids
  }

  const resolveReExport = (re: T.ReExportReflection): void => {
    if (re.resolvedIds !== undefined) return
    const origin = ctx.reExportOrigins.get(re)
    if (!origin) return
    const ids = re.kind === 're-export-named' ? idsForNamedReExport(origin) : idsForStarReExport(origin)
    if (ids.length) re.resolvedIds = ids
  }

  walk.Project(project, { onReference: resolveRef, onReExport: resolveReExport })

  return project
}

// ============================================================================
// SYMBOL LOOKUP
// Re-asks the checker which symbol `name` resolves to *at the origin node*.
// ============================================================================
const symbolAt = (origin: ts.Node, name: string, checker: ts.TypeChecker): ts.Symbol | undefined => {
  // Common case: the origin is a TypeReference node — its symbol is exactly what we want.
  if (ts.isTypeReferenceNode(origin) || ts.isExpressionWithTypeArguments(origin)) {
    const target = ts.isTypeReferenceNode(origin) ? origin.typeName : origin.expression
    const direct = checker.getSymbolAtLocation(target)
    if (direct) return direct
  }
  // Fallback: dotted names ("foo.Bar") need walking; for the first segment, ask
  // for the symbol resolved in the origin's scope.
  const root = name.split('.')[0]
  const inScope = checker.getSymbolsInScope(origin, ts.SymbolFlags.Type | ts.SymbolFlags.Value)
  return inScope.find((s) => s.getName() === root)
}
