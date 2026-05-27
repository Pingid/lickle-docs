import ts from 'typescript'

import * as scan from './scan.ts'
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
  're-export': T.ReExport<Registry> & { ids: number[] }
}
export type Declaration = T.AnyDeclaration<Registry>

export interface TypeMap extends T.TypeMap<Registry> {
  reference: T.ReferenceType<Registry> & { targetId?: number }
}
export type Type = T.AnyType<Registry>

export type Source = T.Source
export type Routable = T.Routable
export type Module = T.Module<Registry>
export type ReExport = T.ReExport<Registry>
export type ReExportAll = T.ReExportAll<Registry>
export type ReExportNamespace = T.ReExportNamespace<Registry>
export type ReExportNamed = T.ReExportNamed<Registry>
export type NamedExport = T.NamedExport
export type Variable = T.Variable<Registry>
export type Func = T.Func<Registry>
export type Class = T.Class<Registry>
export type Interface = T.Interface<Registry>
export type TypeAlias = T.TypeAlias<Registry>
export type Enum = T.Enum<Registry>
export type EnumMember = T.EnumMember
export type Property = T.Property<Registry>
export type Method = T.Method<Registry>
export type IndexSignature = T.IndexSignature<Registry>
export type Signature = T.Signature<Registry>
export type Parameter = T.Parameter<Registry>
export type TypeParameter = T.TypeParameter<Registry>
export type IntrinsicType = T.IntrinsicType
export type LiteralType = T.LiteralType
export type ReferenceType = T.ReferenceType<Registry>
export type UnionType = T.UnionType<Registry>
export type IntersectionType = T.IntersectionType<Registry>
export type ArrayType = T.ArrayType<Registry>
export type TupleType = T.TupleType<Registry>
export type TupleElement = T.TupleElement<Registry>
export type FunctionType = T.FunctionType<Registry>
export type TypeOperatorType = T.TypeOperatorType<Registry>
export type QueryType = T.QueryType<Registry>
export type ReflectionType = T.ReflectionType<Registry>
export type ObjectLiteral = T.ObjectLiteral<Registry>
export type Comment = T.Comment<Registry>
export type CommentTag = T.CommentTag<Registry>
export type CommentPart = T.CommentPart

/**
 * Scan + resolve in one call. Hides the internal scan `Result` from public
 * consumers — only the resolved module tree leaves the boundary.
 */
export const run = (rootFiles: string[], options: scan.Options): T.Module<Registry>[] =>
  generation(scan.files(rootFiles, options))

/**
 * Walk the project and populate `targetId` on every `ReferenceType`, and `ids`
 * on every `ReExport`, whose declarations we know about. References that
 * can't be resolved in-project are tagged with `external` (`stdlib`,
 * `package`, or `anonymous`). Mutates in place.
 */
export const generation = (generation: Result): T.Module<Registry>[] => {
  const { children, context: ctx } = generation
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
    if (r.targetId !== undefined || r.external) return
    const origin = ctx.referenceOrigins.get(ref.id)
    if (!origin) {
      r.external = 'anonymous'
      return
    }
    const sym = symbolAt(origin, ref.name, ctx.checker)
    if (!sym) {
      r.external = 'anonymous'
      return
    }
    const [first] = idsForSymbol(sym)
    if (first !== undefined) {
      r.targetId = first
      return
    }
    r.external = classifySymbol(sym)
  }

  const resolveExport = (exp: T.ReExport): void => {
    const e = exp as T.ReExport & { ids?: number[] }
    if (e.ids !== undefined) return
    const origin = ctx.exportOrigins.get(exp)
    if (!origin) return
    const ids =
      exp.form === 'named'
        ? idsForNamedExport(exp, origin, ctx.checker, idsForSymbol)
        : idsForStarExport(origin, ctx.checker, idsForSymbol)
    e.ids = ids
  }

  children.forEach((c) => walk.Declaration(c, { onReference: resolveRef, onReExport: resolveExport }))

  return children as unknown as T.Module<Registry>[]
}

// ============================================================================
// EXPORT RESOLUTION
// ============================================================================

/** `export { a, b as c } from './x'` — resolve each named entry via the source clause. */
const idsForNamedExport = (
  exp: T.ReExportNamed,
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

/**
 * Bucket an external symbol into the schema's `external` taxonomy by its
 * declaration file path. The renderer uses this to style references — e.g.
 * grey-out `stdlib`, prepend `?` for `anonymous`.
 */
const classifySymbol = (sym: ts.Symbol): NonNullable<T.ReferenceType['external']> => {
  const decl = sym.declarations?.[0]
  if (!decl) return 'anonymous'
  const file = decl.getSourceFile().fileName
  if (/[\\/]node_modules[\\/]typescript[\\/]lib[\\/]/.test(file) || /[\\/]lib\.[^\\/]+\.d\.ts$/.test(file)) {
    return 'stdlib'
  }
  if (file.includes('/node_modules/') || file.includes('\\node_modules\\')) return 'package'
  return 'anonymous'
}
