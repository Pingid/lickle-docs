import ts from 'typescript'

import type { Result } from './scan.ts'
import type * as T from './types.ts'
import * as walk from './walk.ts'

// ============================================================================
// PUBLIC API
// ============================================================================

/** Schema produced after running `resolveReferences`. */
export interface Registry extends T.TypeRegistry {
  declarations: DeclarationMap
  types: TypeMap
}

export interface DeclarationMap extends T.DeclarationMap<Registry> {
  'type-alias': T.TypeAlias<Registry> & { targetId: number }
  're-export': T.ReExport & { ids: number[] }
}
export type Declaration = T.AnyDeclaration<Registry>

export interface TypeMap extends T.TypeMap<Registry> {
  reference: T.ReferenceType<Registry> & { targetId: number }
}
export type Type = T.AnyType<Registry>

export type Project = T.Project<Registry>

/**
 * Information the first pass must record so the second pass can resolve names
 * to declaration ids via the checker. Keyed by reflection id.
 */
export interface ResolverContext {
  checker: ts.TypeChecker
  /** For each declaration id, the symbol it came from. */
  symbolsById: Map<number, ts.Symbol>
  /** For each reference id, the node it was generated from. */
  referenceOrigins: Map<number, ts.Node>
  /** For each `Export` declaration, the `ExportDeclaration` it came from. */
  exportOrigins: Map<T.ReExport, ts.Node>
}

/**
 * Walk the project and populate `targetId` on every `ReferenceType`, and `ids`
 * on every `Export`, whose declarations we know about. Mutates in place.
 */
export const project = (generation: Result): Project => {
  const { project, context: ctx } = generation
  // Build a lookup from any declaration node belonging to a recorded symbol
  // back to its reflection id. Symbols can have multiple declarations (merged
  // interfaces, namespaces) so we index every one.
  const idByDecl = new Map<ts.Node, number>()
  for (const [id, sym] of ctx.symbolsById) sym.declarations?.forEach((d) => idByDecl.set(d, id))

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
    const r = ref as T.ReferenceType & { targetId?: number }
    if (r.targetId !== undefined) return
    const origin = ctx.referenceOrigins.get(ref.id)
    if (!origin) return
    const sym = symbolAt(origin, ref.name, ctx.checker)
    if (!sym) return
    const [first] = idsForSymbol(sym)
    if (first !== undefined) r.targetId = first
  }

  const resolveExport = (exp: T.ReExport): void => {
    const e = exp as T.ReExport & { ids?: number[] }
    if (e.ids !== undefined) return
    const origin = ctx.exportOrigins.get(exp)
    if (!origin) return
    const ids = exp.named.length
      ? idsForNamedExport(exp, origin, ctx.checker, idsForSymbol)
      : idsForStarExport(origin, ctx.checker, idsForSymbol)
    if (ids.length) e.ids = ids
  }

  walk.Project(project, { onReference: resolveRef, onReExport: resolveExport })

  return project as unknown as T.Project<Registry>
}

// ============================================================================
// EXPORT RESOLUTION
// ============================================================================

/** `export { a, b as c } from './x'` — resolve each named entry via the source clause. */
const idsForNamedExport = (
  exp: T.ReExport,
  origin: ts.Node,
  checker: ts.TypeChecker,
  idsForSymbol: (s: ts.Symbol) => number[],
): number[] => {
  if (!ts.isExportDeclaration(origin) || !origin.exportClause || !ts.isNamedExports(origin.exportClause)) return []
  const ids: number[] = []
  for (const entry of exp.named) {
    const spec = origin.exportClause.elements.find((el) => (el.propertyName ?? el.name).text === entry.name)
    if (!spec) continue
    const sym = checker.getSymbolAtLocation(spec.propertyName ?? spec.name)
    if (!sym) continue
    for (const id of idsForSymbol(sym)) if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/** `export * [as foo] from './x'` — enumerate every export of the source module. */
const idsForStarExport = (
  origin: ts.Node,
  checker: ts.TypeChecker,
  idsForSymbol: (s: ts.Symbol) => number[],
): number[] => {
  if (!ts.isExportDeclaration(origin) || !origin.moduleSpecifier) return []
  const moduleSym = checker.getSymbolAtLocation(origin.moduleSpecifier)
  if (!moduleSym) return []
  const ids: number[] = []
  for (const exp of checker.getExportsOfModule(moduleSym)) {
    for (const id of idsForSymbol(exp)) if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

// ============================================================================
// SYMBOL LOOKUP
// Re-asks the checker which symbol `name` resolves to at the origin node.
// ============================================================================

const symbolAt = (origin: ts.Node, name: string, checker: ts.TypeChecker): ts.Symbol | undefined => {
  // Common case: the origin is a TypeReference — its symbol is exactly what we want.
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
