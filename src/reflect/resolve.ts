import ts from 'typescript'

import type * as T from './types.js'
import type { ResolverContext } from './generate.ts'

export type { ResolverContext } from './generate.ts'

/**
 * Walk the lazy project, materializing every collection to a real array
 * (producing the 'json' variant) while collecting every ReferenceType and
 * ReExportReflection encountered. Because `ctx` is populated as a side effect
 * of iterating the lazy tree, resolution runs in a final pass *after*
 * materialization completes — by then every declaration in the project has
 * been visited and its symbol is in `ctx`.
 */
export const resolve = (
  lazy: T.ProjectReflection<'lazy'>,
  ctx: ResolverContext,
): T.ProjectReflection<'json'> => {
  const sink: Sink = { refs: [], reExports: [] }
  const project: T.ProjectReflection<'json'> = {
    name: lazy.name,
    ...(lazy.comment ? { comment: Comment_(lazy.comment) } : {}),
    children: Array.from(lazy.children, (m) => Module_(m, sink)),
  }
  const idByDecl = new Map<ts.Node, number>()
  for (const [id, sym] of ctx.symbolsById) sym.declarations?.forEach((d) => idByDecl.set(d, id))
  for (const r of sink.refs) resolveRef(r, ctx, idByDecl)
  for (const re of sink.reExports) resolveReExport(re, ctx, idByDecl)
  return project
}

interface Sink {
  refs: T.ReferenceType<'json'>[]
  reExports: T.ReExportReflection<'json'>[]
}

// ============================================================================
// MATERIALIZATION: lazy → json
// Each builder is a thin recursive descent that consumes every Iterable once.
// ============================================================================

const Base_ = (b: T.BaseReflection<'lazy'>): T.BaseReflection<'json'> => ({
  id: b.id,
  name: b.name,
  ...(b.comment ? { comment: Comment_(b.comment) } : {}),
  ...(b.sources ? { sources: [...b.sources] } : {}),
  ...(b.flags ? { flags: b.flags } : {}),
})

const Comment_ = (c: T.Comment<'lazy'>): T.Comment<'json'> => ({ text: c.text, tags: [...c.tags] })

const Module_ = (m: T.ModuleReflection<'lazy'>, sink: Sink): T.ModuleReflection<'json'> => ({
  ...Base_(m),
  kind: 'module',
  children: Array.from(m.children, (n) => ModuleMember_(n, sink)),
})

const ModuleMember_ = (
  n: T.ModuleMember<'lazy'>,
  sink: Sink,
): T.ModuleMember<'json'> => (isReExport(n) ? ReExport_(n, sink) : Decl_(n, sink))

const isReExport = (n: T.ModuleMember<'lazy'>): n is T.ReExportReflection<'lazy'> =>
  n.kind === 're-export-all' || n.kind === 're-export-namespace' || n.kind === 're-export-named'

const ReExport_ = (re: T.ReExportReflection<'lazy'>, sink: Sink): T.ReExportReflection<'json'> => {
  // Re-exports carry no nested collections, so we pass the same object through
  // — preserving identity so `ctx.reExportOrigins.get(re)` still works.
  const out = re as T.ReExportReflection<'json'>
  sink.reExports.push(out)
  return out
}

const Decl_ = (d: T.DeclarationReflection<'lazy'>, sink: Sink): T.DeclarationReflection<'json'> => {
  switch (d.kind) {
    case 'module':
      return Module_(d, sink)
    case 'variable':
      return Variable_(d, sink)
    case 'function':
      return Function_(d, sink)
    case 'class':
      return Class_(d, sink)
    case 'interface':
      return Interface_(d, sink)
    case 'type-alias':
      return TypeAlias_(d, sink)
    case 'enum':
      return Enum_(d)
  }
}

const Variable_ = (v: T.VariableReflection<'lazy'>, sink: Sink): T.VariableReflection<'json'> => ({
  ...Base_(v),
  kind: 'variable',
  type: Type_(v.type, sink),
  ...(v.defaultValue !== undefined ? { defaultValue: v.defaultValue } : {}),
})

const Function_ = (f: T.FunctionReflection<'lazy'>, sink: Sink): T.FunctionReflection<'json'> => ({
  ...Base_(f),
  kind: 'function',
  signatures: Array.from(f.signatures, (s) => Signature_(s, sink)),
})

const Class_ = (c: T.ClassReflection<'lazy'>, sink: Sink): T.ClassReflection<'json'> => ({
  ...Base_(c),
  kind: 'class',
  ...(c.typeParameters ? { typeParameters: Array.from(c.typeParameters, (tp) => TypeParameter_(tp, sink)) } : {}),
  ...(c.extends ? { extends: Type_(c.extends, sink) } : {}),
  ...(c.implements ? { implements: Array.from(c.implements, (t) => Type_(t, sink)) } : {}),
  constructors: Array.from(c.constructors, (s) => Signature_(s, sink)),
  properties: Array.from(c.properties, (p) => Property_(p, sink)),
  methods: Array.from(c.methods, (m) => Method_(m, sink)),
  ...(c.indexSignature
    ? { indexSignature: Array.from(c.indexSignature, (i) => IndexSignature_(i, sink)) }
    : {}),
})

const Interface_ = (i: T.InterfaceReflection<'lazy'>, sink: Sink): T.InterfaceReflection<'json'> => ({
  ...Base_(i),
  kind: 'interface',
  ...(i.typeParameters ? { typeParameters: Array.from(i.typeParameters, (tp) => TypeParameter_(tp, sink)) } : {}),
  ...(i.extends ? { extends: Array.from(i.extends, (t) => Type_(t, sink)) } : {}),
  properties: Array.from(i.properties, (p) => Property_(p, sink)),
  methods: Array.from(i.methods, (m) => Method_(m, sink)),
  ...(i.callSignatures ? { callSignatures: Array.from(i.callSignatures, (s) => Signature_(s, sink)) } : {}),
  ...(i.constructSignatures ? { constructSignatures: Array.from(i.constructSignatures, (s) => Signature_(s, sink)) } : {}),
  ...(i.indexSignature ? { indexSignature: IndexSignature_(i.indexSignature, sink) } : {}),
})

const TypeAlias_ = (t: T.TypeAliasReflection<'lazy'>, sink: Sink): T.TypeAliasReflection<'json'> => ({
  ...Base_(t),
  kind: 'type-alias',
  ...(t.typeParameters ? { typeParameters: Array.from(t.typeParameters, (tp) => TypeParameter_(tp, sink)) } : {}),
  type: Type_(t.type, sink),
})

const Enum_ = (e: T.EnumReflection<'lazy'>): T.EnumReflection<'json'> => ({
  ...Base_(e),
  kind: 'enum',
  ...(e.isConst ? { isConst: true } : {}),
  members: Array.from(e.members, EnumMember_),
})

const EnumMember_ = (m: T.EnumMemberReflection<'lazy'>): T.EnumMemberReflection<'json'> => ({
  ...Base_(m),
  kind: 'enum-member',
  ...(m.value !== undefined ? { value: m.value } : {}),
})

const Property_ = (p: T.PropertyReflection<'lazy'>, sink: Sink): T.PropertyReflection<'json'> => ({
  ...Base_(p),
  kind: 'property',
  type: Type_(p.type, sink),
  ...(p.defaultValue !== undefined ? { defaultValue: p.defaultValue } : {}),
})

const Method_ = (m: T.MethodReflection<'lazy'>, sink: Sink): T.MethodReflection<'json'> => ({
  ...Base_(m),
  kind: 'method',
  signatures: Array.from(m.signatures, (s) => Signature_(s, sink)),
})

const IndexSignature_ = (i: T.IndexSignatureReflection<'lazy'>, sink: Sink): T.IndexSignatureReflection<'json'> => ({
  ...Base_(i),
  kind: 'index-signature',
  parameter: Array.from(i.parameter, (p) => Parameter_(p, sink)),
  type: Type_(i.type, sink),
})

const Signature_ = (s: T.SignatureReflection<'lazy'>, sink: Sink): T.SignatureReflection<'json'> => ({
  ...Base_(s),
  kind: 'signature',
  ...(s.typeParameters ? { typeParameters: Array.from(s.typeParameters, (tp) => TypeParameter_(tp, sink)) } : {}),
  parameters: Array.from(s.parameters, (p) => Parameter_(p, sink)),
  type: Type_(s.type, sink),
})

const Parameter_ = (p: T.ParameterReflection<'lazy'>, sink: Sink): T.ParameterReflection<'json'> => ({
  ...Base_(p),
  kind: 'parameter',
  type: Type_(p.type, sink),
  isOptional: p.isOptional,
  ...(p.isRest ? { isRest: true } : {}),
  ...(p.defaultValue !== undefined ? { defaultValue: p.defaultValue } : {}),
})

const TypeParameter_ = (tp: T.TypeParameterReflection<'lazy'>, sink: Sink): T.TypeParameterReflection<'json'> => ({
  name: tp.name,
  ...(tp.constraint ? { constraint: Type_(tp.constraint, sink) } : {}),
  ...(tp.default ? { default: Type_(tp.default, sink) } : {}),
})

const Type_ = (t: T.TypeReflection<'lazy'>, sink: Sink): T.TypeReflection<'json'> => {
  switch (t.kind) {
    case 'intrinsic':
    case 'literal':
      return t
    case 'reference':
      return Reference_(t, sink)
    case 'union':
      return { kind: 'union', types: Array.from(t.types, (x) => Type_(x, sink)) }
    case 'intersection':
      return { kind: 'intersection', types: Array.from(t.types, (x) => Type_(x, sink)) }
    case 'array':
      return { kind: 'array', elementType: Type_(t.elementType, sink) }
    case 'tuple':
      return { kind: 'tuple', elements: Array.from(t.elements, (el) => TupleElement_(el, sink)) }
    case 'function-type':
      return { kind: 'function-type', signatures: Array.from(t.signatures, (s) => Signature_(s, sink)) }
    case 'type-operator':
      return { kind: 'type-operator', operator: t.operator, target: Type_(t.target, sink) }
    case 'query':
      return { kind: 'query', queryType: Reference_(t.queryType, sink) }
    case 'reflection':
      return { kind: 'reflection', declaration: ObjectLiteral_(t.declaration, sink) }
  }
}

const Reference_ = (r: T.ReferenceType<'lazy'>, sink: Sink): T.ReferenceType<'json'> => {
  const out: T.ReferenceType<'json'> = {
    kind: 'reference',
    id: r.id,
    name: r.name,
    ...(r.typeArguments ? { typeArguments: Array.from(r.typeArguments, (t) => Type_(t, sink)) } : {}),
    ...(r.targetId !== undefined ? { targetId: r.targetId } : {}),
  }
  sink.refs.push(out)
  return out
}

const TupleElement_ = (el: T.TupleElement<'lazy'>, sink: Sink): T.TupleElement<'json'> => ({
  type: Type_(el.type, sink),
  ...(el.name !== undefined ? { name: el.name } : {}),
  ...(el.isOptional ? { isOptional: true } : {}),
  ...(el.isRest ? { isRest: true } : {}),
})

const ObjectLiteral_ = (o: T.ObjectLiteralReflection<'lazy'>, sink: Sink): T.ObjectLiteralReflection<'json'> => ({
  ...Base_(o),
  kind: 'object-literal',
  properties: Array.from(o.properties, (p) => Property_(p, sink)),
  ...(o.methods ? { methods: Array.from(o.methods, (m) => Method_(m, sink)) } : {}),
  ...(o.callSignatures ? { callSignatures: Array.from(o.callSignatures, (s) => Signature_(s, sink)) } : {}),
  ...(o.constructSignatures ? { constructSignatures: Array.from(o.constructSignatures, (s) => Signature_(s, sink)) } : {}),
  ...(o.indexSignature ? { indexSignature: Array.from(o.indexSignature, (i) => IndexSignature_(i, sink)) } : {}),
})

// ============================================================================
// RESOLUTION
// Once materialization is done, ctx.symbolsById is fully populated. We can
// turn every (ReferenceType, origin node) pair into a `targetId`, and every
// re-export into a list of `resolvedIds`.
// ============================================================================

const resolveRef = (r: T.ReferenceType<'json'>, ctx: ResolverContext, idByDecl: Map<ts.Node, number>): void => {
  if (r.targetId !== undefined) return
  const origin = ctx.referenceOrigins.get(r.id)
  if (!origin) return
  const sym = symbolAt(origin, r.name, ctx.checker)
  if (!sym) return
  const [first] = idsForSymbol(sym, ctx, idByDecl)
  if (first !== undefined) r.targetId = first
}

const resolveReExport = (
  re: T.ReExportReflection<'json'>,
  ctx: ResolverContext,
  idByDecl: Map<ts.Node, number>,
): void => {
  if (re.resolvedIds !== undefined) return
  const origin = ctx.reExportOrigins.get(re as unknown as T.ReExportReflection<'lazy'>)
  if (!origin) return
  const ids =
    re.kind === 're-export-named'
      ? idsForNamedReExport(origin, ctx, idByDecl)
      : idsForStarReExport(origin, ctx, idByDecl)
  if (ids.length) re.resolvedIds = ids
}

/** All in-project reflection ids contributed by `sym` (after following aliases). */
const idsForSymbol = (sym: ts.Symbol, ctx: ResolverContext, idByDecl: Map<ts.Node, number>): number[] => {
  const target = sym.flags & ts.SymbolFlags.Alias ? ctx.checker.getAliasedSymbol(sym) : sym
  const ids: number[] = []
  for (const decl of target.declarations ?? []) {
    const id = idByDecl.get(decl)
    if (id !== undefined && !ids.includes(id)) ids.push(id)
  }
  return ids
}

/** `export { a as b }` — `propertyName` is the source name when aliased. */
const idsForNamedReExport = (
  specifier: ts.Node,
  ctx: ResolverContext,
  idByDecl: Map<ts.Node, number>,
): number[] => {
  if (!ts.isExportSpecifier(specifier)) return []
  const sym = ctx.checker.getSymbolAtLocation(specifier.propertyName ?? specifier.name)
  return sym ? idsForSymbol(sym, ctx, idByDecl) : []
}

/** `export * [as foo] from './x'` — enumerate every export of the source module. */
const idsForStarReExport = (
  decl: ts.Node,
  ctx: ResolverContext,
  idByDecl: Map<ts.Node, number>,
): number[] => {
  if (!ts.isExportDeclaration(decl) || !decl.moduleSpecifier) return []
  const moduleSym = ctx.checker.getSymbolAtLocation(decl.moduleSpecifier)
  if (!moduleSym) return []
  const ids: number[] = []
  for (const exp of ctx.checker.getExportsOfModule(moduleSym)) {
    for (const id of idsForSymbol(exp, ctx, idByDecl)) if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

// ============================================================================
// SYMBOL LOOKUP
// Re-asks the checker which symbol `name` resolves to *at the origin node*.
// ============================================================================
const symbolAt = (origin: ts.Node, name: string, checker: ts.TypeChecker): ts.Symbol | undefined => {
  if (ts.isTypeReferenceNode(origin) || ts.isExpressionWithTypeArguments(origin)) {
    const target = ts.isTypeReferenceNode(origin) ? origin.typeName : origin.expression
    const direct = checker.getSymbolAtLocation(target)
    if (direct) return direct
  }
  const root = name.split('.')[0]
  const inScope = checker.getSymbolsInScope(origin, ts.SymbolFlags.Type | ts.SymbolFlags.Value)
  return inScope.find((s) => s.getName() === root)
}
