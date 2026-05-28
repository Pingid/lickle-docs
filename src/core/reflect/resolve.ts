import ts from 'typescript'

import type { Result } from './scan.ts'
import type * as T from './types.ts'
import * as scan from './scan.ts'
import * as walk from './walk.ts'

// ============================================================================
// PUBLIC API
// ============================================================================

/** Schema produced after running `resolveReferences`. */
export interface Registry extends T.TypeRegistry {
  declarations: T.DeclarationMap<Registry>
  types: TypeMap
}

export type Declaration = T.AnyDeclaration<Registry>

export interface TypeMap extends T.TypeMap<Registry> {
  reference: T.ReferenceType<Registry> & { targetId?: number }
}
export type Type = T.AnyType<Registry>

export type Source = T.Source
export type Routable = T.Routable
export type Module = T.Module<Registry>
export type Namespace = T.Namespace<Registry>
export type Exports = T.Exports<Registry>
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

/** Output of `run` / `generation` — the flat schema, ready for the indexed layer. */
export interface RunResult {
  declarations: Declaration[]
  children: number[]
}

/**
 * Scan + resolve in one call. Hides the internal scan `Result` from public
 * consumers — only the resolved flat schema leaves the boundary.
 */
export const run = (rootFiles: string[], options: scan.Options): RunResult => generation(scan.files(rootFiles, options))

/**
 * Walk every declaration once and populate `targetId` on each `ReferenceType`
 * plus `names[]` on each `Exports` clause. Mutates the input. References that
 * can't be resolved in-project are tagged with `external`.
 */
export const generation = (gen: Result): RunResult => {
  const { declarations, children, context: ctx } = gen

  // Map any TS declaration node back to its in-project reflection id.
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

  const moduleIdForSpecifier = (origin: ts.ExportDeclaration): number | undefined => {
    if (!origin.moduleSpecifier) return undefined
    const sym = ctx.checker.getSymbolAtLocation(origin.moduleSpecifier)
    if (!sym) return undefined
    return idsForSymbol(sym)[0]
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

  const resolveExports = (exp: T.Exports): void => {
    if (exp.names.length) return
    const form = ctx.exportsForm.get(exp.id)
    const origin = ctx.exportsOrigin.get(exp.id)
    if (!form || !origin) return

    if (form === 'namespace-from') {
      const alias = ctx.exportsAlias.get(exp.id)
      const moduleId = moduleIdForSpecifier(origin)
      if (alias && moduleId !== undefined) exp.names.push({ name: alias, id: moduleId })
      return
    }

    if (form === 'star') {
      if (!origin.moduleSpecifier) return
      const moduleSym = ctx.checker.getSymbolAtLocation(origin.moduleSpecifier)
      if (!moduleSym) return
      for (const sym of ctx.checker.getExportsOfModule(moduleSym)) {
        const [id] = idsForSymbol(sym)
        if (id !== undefined) exp.names.push({ name: sym.getName(), id })
      }
      return
    }

    const entries = ctx.exportsEntries.get(exp.id) ?? []

    if (form === 'named-from') {
      if (!origin.moduleSpecifier) return
      const moduleSym = ctx.checker.getSymbolAtLocation(origin.moduleSpecifier)
      if (!moduleSym) return
      const exportSyms = ctx.checker.getExportsOfModule(moduleSym)
      for (const e of entries) {
        const sym = exportSyms.find((s) => s.getName() === e.name)
        if (!sym) continue
        const [id] = idsForSymbol(sym)
        if (id !== undefined) exp.names.push({ name: e.as ?? e.name, id })
      }
      return
    }

    // named-local: look up each name in the enclosing source-file's locals.
    if (origin.exportClause && ts.isNamedExports(origin.exportClause)) {
      for (const el of origin.exportClause.elements) {
        const sym = ctx.checker.getSymbolAtLocation(el.propertyName ?? el.name)
        if (!sym) continue
        const [id] = idsForSymbol(sym)
        if (id !== undefined) exp.names.push({ name: el.name.text, id })
      }
    }
  }

  for (const decl of declarations) {
    walk.Declaration(decl as T.AnyDeclaration, { onReference: resolveRef, onExports: resolveExports })
  }

  return { declarations: declarations as unknown as Declaration[], children }
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
