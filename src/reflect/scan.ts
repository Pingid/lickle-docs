import ts from 'typescript'
import path from 'node:path'

import type * as T from './types.ts'

// ============================================================================
// PUBLIC API
// ============================================================================

export interface Options {
  /** The root directory of the project. Paths are relative to this. */
  rootDir: string
  /** The compiler options for the project. */
  compilerOptions: ts.CompilerOptions
  /** Exclude certain kinds of nodes from the generated project. */
  exclude?: { sources?: boolean; comments?: boolean; typeParameters?: boolean }
  include?: { file?: (sf: ts.SourceFile) => boolean }
}

/**
 * Output of the scan pass. `children` is the partially-resolved tree;
 * `context` is an opaque handle threaded into the resolver. The context
 * fields are intentionally not part of the public API surface.
 */
export interface Result {
  children: T.Module<Registry>[]
  /** Internal handle consumed by `resolve.generation`. */
  context: Context
}

export interface Registry extends T.TypeRegistry {
  types: T.TypeMap<Registry> & {
    reference: T.ReferenceType<Registry> & { targetId?: number }
  }
  declarations: T.DeclarationMap<Registry> & {
    're-export': T.ReExport<Registry> & { ids?: number[] }
  }
}

export interface Context extends Options {
  nextId: () => number
  checker: ts.TypeChecker
  /** Records the symbol behind each declaration id. Used by the resolver. */
  symbolsById: Map<number, ts.Symbol>
  /** Records the syntactic origin of each `ReExport` declaration. */
  exportOrigins: Map<T.ReExport, ts.Node>
  /** Records the syntactic origin of each `ReferenceType` id. */
  referenceOrigins: Map<number, ts.Node>
  /** Cache of `path.relative(rootDir, sf.fileName)` — recomputed once per file. */
  relPath: WeakMap<ts.SourceFile, string>
}

export const files = (rootFiles: string[], options: Options): Result => {
  const program = ts.createProgram(rootFiles, options.compilerOptions)
  const ctx = makeContext(program.getTypeChecker(), options)
  const include = options.include?.file
  const children: T.Module<Registry>[] = []

  // BFS over source files starting at `rootFiles`. Root files are always
  // included; transitive re-export targets must pass `include.file`. We mutate
  // `queue` during iteration so a single indexed loop suffices.
  const seen = new Set<ts.SourceFile>()
  const queue: ts.SourceFile[] = []
  for (const f of rootFiles) {
    const sf = program.getSourceFile(f)
    if (sf && !seen.has(sf)) {
      seen.add(sf)
      queue.push(sf)
    }
  }

  for (let i = 0; i < queue.length; i++) {
    const sf = queue[i]!
    children.push(sourceFile(sf, ctx))
    for (const target of reExportedSources(sf, ctx.checker)) {
      if (seen.has(target)) continue
      if (include && !include(target)) continue
      seen.add(target)
      queue.push(target)
    }
  }

  return { children, context: ctx }
}

/** Source files reachable from `sf` via top-level `export … from '…'` clauses. */
const reExportedSources = (sf: ts.SourceFile, checker: ts.TypeChecker): ts.SourceFile[] => {
  const out: ts.SourceFile[] = []
  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt) || !stmt.moduleSpecifier) continue
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue
    const sym = checker.getSymbolAtLocation(stmt.moduleSpecifier)
    const decl = sym?.valueDeclaration ?? sym?.declarations?.[0]
    if (decl && ts.isSourceFile(decl)) out.push(decl)
  }
  return out
}

const makeContext = (checker: ts.TypeChecker, options: Options): Context => {
  let id = 0
  return {
    checker,
    rootDir: options.rootDir,
    compilerOptions: options.compilerOptions,
    exclude: options.exclude ?? {},
    nextId: () => ++id,
    symbolsById: new Map(),
    referenceOrigins: new Map(),
    exportOrigins: new Map(),
    relPath: new WeakMap(),
  }
}

// ============================================================================
// MODULES & DECLARATIONS
// ============================================================================

const sourceFile = (sf: ts.SourceFile, ctx: Context): T.Module => {
  const children: T.AnyDeclaration[] = []
  for (const stmt of sf.statements) {
    if (isExported(stmt)) appendDeclarations(stmt, ctx, children)
  }
  return {
    ...routableModule(sf, ctx),
    kind: 'module',
    path: relPath(sf, ctx),
    name: path.basename(sf.fileName).replace(/\.[^./]+$/, ''),
    children,
  }
}

/**
 * Append the declarations carried by a top-level statement to `out`.
 *
 * Variable declarations whose effective top-level type is callable (arrow
 * initializer, function-type annotation, or call-signature-only object
 * literal annotation) are surfaced as functions — this matches how TypeDoc
 * (and most readers) think about `export const foo = (x) => …`.
 */
const appendDeclarations = (node: ts.Node, ctx: Context, out: T.AnyDeclaration[]): void => {
  if (ts.isVariableStatement(node)) {
    for (const d of node.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue
      out.push(isCallableVariable(d) ? variableAsFunction(d, node, ctx) : variable(d, node, ctx))
    }
    return
  }
  if (ts.isFunctionDeclaration(node) && node.name) return void out.push(function_(node, ctx))
  if (ts.isClassDeclaration(node) && node.name) return void out.push(class_(node, ctx))
  if (ts.isInterfaceDeclaration(node)) return void out.push(interface_(node, ctx))
  if (ts.isTypeAliasDeclaration(node)) return void out.push(typeAlias(node, ctx))
  if (ts.isEnumDeclaration(node)) return void out.push(enum_(node, ctx))
  if (ts.isModuleDeclaration(node)) {
    const ns = namespace(node, ctx)
    if (ns) out.push(ns)
    return
  }
  if (ts.isExportDeclaration(node)) {
    const exp = export_(node, ctx)
    if (exp) out.push(exp)
    return
  }
  if (ts.isExportAssignment(node) && !node.isExportEquals) {
    const def = exportDefault(node, ctx)
    if (def) out.push(def)
  }
}

/**
 * Anything whose top-level type resolves to a callable. Three cases that
 * land at the same answer:
 *   - `const f = () => …` / `function expr` initializer
 *   - `const f: (x) => y` (function type annotation)
 *   - `const f: { (x): y }` (object literal annotation with only call signatures)
 */
const isCallableVariable = (d: ts.VariableDeclaration): boolean => {
  if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) return true
  if (d.type && ts.isFunctionTypeNode(d.type)) return true
  if (d.type && ts.isTypeLiteralNode(d.type)) {
    let hasCall = false
    let hasOther = false
    for (const m of d.type.members) {
      if (ts.isCallSignatureDeclaration(m)) hasCall = true
      else hasOther = true
    }
    return hasCall && !hasOther
  }
  return false
}

const variable = (d: ts.VariableDeclaration, _stmt: ts.VariableStatement, ctx: Context): T.Variable => ({
  ...routableBase(d, ctx),
  kind: 'variable',
  name: (d.name as ts.Identifier).text,
  type: d.type ? typeNode(d.type, ctx) : typeOf(ctx.checker.getTypeAtLocation(d), ctx),
  ...(d.initializer ? { defaultValue: d.initializer.getText() } : {}),
})

const variableAsFunction = (d: ts.VariableDeclaration, _stmt: ts.VariableStatement, ctx: Context): T.Func => ({
  ...routableBase(d, ctx),
  kind: 'function',
  name: (d.name as ts.Identifier).text,
  signatures: callableSignatures(d, ctx),
})

/** Resolve signatures from whichever syntactic vehicle made the variable callable. */
const callableSignatures = (d: ts.VariableDeclaration, ctx: Context): T.Signature[] => {
  if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
    return collectSignatures(d.initializer, ctx)
  }
  if (d.type && ts.isFunctionTypeNode(d.type)) return [signature(d.type, ctx)]
  if (d.type && ts.isTypeLiteralNode(d.type)) {
    return d.type.members.filter(ts.isCallSignatureDeclaration).map((m) => signature(m, ctx))
  }
  // Fallback: ask the checker.
  const t = ctx.checker.getTypeAtLocation(d)
  return t.getCallSignatures().map((s) => checkerSignature(s, d, ctx))
}

const function_ = (node: ts.FunctionDeclaration, ctx: Context): T.Func => ({
  ...routableBase(node, ctx),
  kind: 'function',
  name: node.name!.text,
  signatures: collectSignatures(node, ctx),
})

const class_ = (node: ts.ClassDeclaration, ctx: Context): T.Class => {
  const members = partitionClassMembers(node.members, ctx)
  return {
    ...routableBase(node, ctx),
    kind: 'class',
    name: node.name!.text,
    ...(node.typeParameters ? { typeParameters: node.typeParameters.map((tp) => typeParameter(tp, ctx)) } : {}),
    ...heritage(node, ctx),
    constructors: members.constructors,
    properties: members.properties,
    methods: members.methods,
    ...(members.indexSignature ? { indexSignature: members.indexSignature } : {}),
  }
}

const interface_ = (node: ts.InterfaceDeclaration, ctx: Context): T.Interface => {
  const members = partitionInterfaceMembers(node.members, ctx)
  let extendsTypes: T.AnyType[] | undefined
  if (node.heritageClauses) {
    for (const h of node.heritageClauses) {
      if (h.token !== ts.SyntaxKind.ExtendsKeyword) continue
      ;(extendsTypes ??= []).push(...h.types.map((t) => typeNode(t, ctx)))
    }
  }
  return {
    ...routableBase(node, ctx),
    kind: 'interface',
    name: node.name.text,
    ...(node.typeParameters ? { typeParameters: node.typeParameters.map((tp) => typeParameter(tp, ctx)) } : {}),
    ...(extendsTypes?.length ? { extends: extendsTypes } : {}),
    properties: members.properties,
    methods: members.methods,
    ...(members.callSignatures.length ? { callSignatures: members.callSignatures } : {}),
    ...(members.constructSignatures.length ? { constructSignatures: members.constructSignatures } : {}),
    ...(members.indexSignature ? { indexSignature: members.indexSignature } : {}),
  }
}

const typeAlias = (node: ts.TypeAliasDeclaration, ctx: Context): T.TypeAlias => ({
  ...routableBase(node, ctx),
  kind: 'type-alias',
  name: node.name.text,
  ...(node.typeParameters ? { typeParameters: node.typeParameters.map((tp) => typeParameter(tp, ctx)) } : {}),
  type: typeNode(node.type, ctx),
})

const enum_ = (node: ts.EnumDeclaration, ctx: Context): T.Enum => ({
  ...routableBase(node, ctx),
  kind: 'enum',
  name: node.name.text,
  const: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ConstKeyword),
  members: node.members.map((m): T.EnumMember => {
    const value = ctx.checker.getConstantValue(m)
    return {
      ...base(m, ctx),
      kind: 'enum-member',
      name: m.name.getText(),
      ...(value !== undefined ? { value } : {}),
    }
  }),
})

const namespace = (node: ts.ModuleDeclaration, ctx: Context): T.Module | undefined => {
  if (!node.body || !ts.isModuleBlock(node.body)) return undefined
  const children: T.AnyDeclaration[] = []
  for (const stmt of node.body.statements) if (isExported(stmt)) appendDeclarations(stmt, ctx, children)
  return { ...routableModule(node, ctx), kind: 'module', name: moduleName(node.name), children }
}

const moduleName = (n: ts.ModuleName): string => ('text' in n ? n.text : (n as ts.Node).getText())

/** One `ExportDeclaration` becomes one discriminated `ReExport`. */
const export_ = (node: ts.ExportDeclaration, ctx: Context): T.ReExport | undefined => {
  if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return undefined
  const sourceModule = node.moduleSpecifier.text
  let exp: T.ReExport
  if (!node.exportClause) {
    exp = { ...base(node, ctx), kind: 're-export', form: 'all', sourceModule }
  } else if (ts.isNamespaceExport(node.exportClause)) {
    exp = { ...base(node, ctx), kind: 're-export', form: 'namespace', sourceModule, as: node.exportClause.name.text }
  } else {
    const named: T.NamedExport[] = node.exportClause.elements.map((el) => ({
      name: (el.propertyName ?? el.name).text,
      ...(el.propertyName ? { as: el.name.text } : {}),
    }))
    exp = { ...base(node, ctx), kind: 're-export', form: 'named', sourceModule, named }
  }
  ctx.exportOrigins.set(exp, node)
  return exp
}

/**
 * `export default <expr>`. Surfaces as a `default`-named function (when the
 * expression is a function/arrow) or variable (everything else). The bare
 * declaration form `export default function foo() {}` already arrives via
 * the `FunctionDeclaration` branch since it carries the export modifier.
 */
const exportDefault = (node: ts.ExportAssignment, ctx: Context): T.AnyDeclaration | undefined => {
  const expr = node.expression
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    return {
      ...routableBase(node, ctx),
      kind: 'function',
      name: 'default',
      signatures: collectSignatures(expr, ctx),
    }
  }
  // Skip identifiers — the local declaration is already exported.
  if (ts.isIdentifier(expr)) return undefined
  return {
    ...routableBase(node, ctx),
    kind: 'variable',
    name: 'default',
    type: typeOf(ctx.checker.getTypeAtLocation(expr), ctx),
    defaultValue: expr.getText(),
  }
}

// ============================================================================
// CLASS / INTERFACE MEMBERS
// ============================================================================

interface ClassMemberBuckets {
  constructors: T.Signature[]
  properties: T.Property[]
  methods: T.Method[]
  indexSignature?: T.IndexSignature
}

const partitionClassMembers = (members: ts.NodeArray<ts.ClassElement>, ctx: Context): ClassMemberBuckets => {
  const buckets: ClassMemberBuckets = { constructors: [], properties: [], methods: [] }
  for (const m of members) {
    if (ts.isConstructorDeclaration(m)) buckets.constructors.push(signature(m, ctx))
    else if (ts.isPropertyDeclaration(m) && ts.isIdentifier(m.name)) buckets.properties.push(property(m, ctx))
    else if (ts.isMethodDeclaration(m) && ts.isIdentifier(m.name)) buckets.methods.push(method(m, ctx))
    else if (ts.isIndexSignatureDeclaration(m)) buckets.indexSignature = indexSignature(m, ctx)
  }
  return buckets
}

interface InterfaceMemberBuckets {
  properties: T.Property[]
  methods: T.Method[]
  callSignatures: T.Signature[]
  constructSignatures: T.Signature[]
  indexSignature?: T.IndexSignature
}

const partitionInterfaceMembers = (members: ts.NodeArray<ts.TypeElement>, ctx: Context): InterfaceMemberBuckets => {
  const buckets: InterfaceMemberBuckets = {
    properties: [],
    methods: [],
    callSignatures: [],
    constructSignatures: [],
  }
  for (const m of members) {
    if (ts.isPropertySignature(m) && ts.isIdentifier(m.name)) buckets.properties.push(propertySignature(m, ctx))
    else if (ts.isMethodSignature(m) && ts.isIdentifier(m.name)) {
      buckets.methods.push({
        ...base(m, ctx),
        kind: 'method',
        name: m.name.text,
        signatures: [signature(m, ctx)],
      })
    } else if (ts.isCallSignatureDeclaration(m)) buckets.callSignatures.push(signature(m, ctx))
    else if (ts.isConstructSignatureDeclaration(m)) buckets.constructSignatures.push(signature(m, ctx))
    else if (ts.isIndexSignatureDeclaration(m)) buckets.indexSignature = indexSignature(m, ctx)
  }
  return buckets
}

const property = (node: ts.PropertyDeclaration, ctx: Context): T.Property => ({
  ...base(node, ctx),
  kind: 'property',
  name: (node.name as ts.Identifier).text,
  type: node.type ? typeNode(node.type, ctx) : typeOf(ctx.checker.getTypeAtLocation(node), ctx),
  ...(node.initializer ? { defaultValue: node.initializer.getText() } : {}),
  ...(node.questionToken ? { optional: true } : {}),
})

const propertySignature = (node: ts.PropertySignature, ctx: Context): T.Property => ({
  ...base(node, ctx),
  kind: 'property',
  name: (node.name as ts.Identifier).text,
  type: node.type ? typeNode(node.type, ctx) : intrinsic('unknown'),
  ...(node.questionToken ? { optional: true } : {}),
})

const method = (node: ts.MethodDeclaration, ctx: Context): T.Method => ({
  ...base(node, ctx),
  kind: 'method',
  name: (node.name as ts.Identifier).text,
  signatures: collectSignatures(node, ctx),
})

const indexSignature = (node: ts.IndexSignatureDeclaration, ctx: Context): T.IndexSignature => ({
  ...base(node, ctx),
  kind: 'index-signature',
  parameter: parameter(node.parameters[0]!, ctx),
  type: node.type ? typeNode(node.type, ctx) : intrinsic('unknown'),
})

// ============================================================================
// SIGNATURES, PARAMETERS, TYPE PARAMETERS
// ============================================================================

/** Pull all overload + implementation signatures from a function-like declaration. */
const collectSignatures = (node: ts.SignatureDeclaration, ctx: Context): T.Signature[] => {
  const t = ctx.checker.getTypeAtLocation(node)
  const sigs = t.getCallSignatures()
  return sigs.length ? sigs.map((s) => checkerSignature(s, node, ctx)) : [signature(node, ctx)]
}

/** Build a signature from a syntactic declaration (preserves origin nodes for references). */
const signature = (node: ts.SignatureDeclaration, ctx: Context): T.Signature => ({
  ...base(node, ctx),
  kind: 'signature',
  ...(node.name ? { name: node.name.getText() } : {}),
  ...(node.typeParameters ? { typeParameters: node.typeParameters.map((tp) => typeParameter(tp, ctx)) } : {}),
  parameters: node.parameters.map((p) => parameter(p, ctx)),
  type: node.type
    ? typeNode(node.type, ctx)
    : typeOf(ctx.checker.getReturnTypeOfSignature(ctx.checker.getSignatureFromDeclaration(node)!), ctx),
})

/** Build a signature from a checker `ts.Signature` (used when overloads have no declaration). */
const checkerSignature = (sig: ts.Signature, enclosing: ts.Node, ctx: Context): T.Signature => {
  // Prefer the syntactic conversion when we have a declaration — it preserves
  // origin nodes for ReferenceTypes, which the resolver needs.
  const decl = sig.getDeclaration()
  if (decl) return signature(decl, ctx)
  return {
    ...base(enclosing, ctx),
    kind: 'signature',
    ...(sig.typeParameters?.length
      ? { typeParameters: sig.typeParameters.map((tp) => typeParameterFromType(tp, ctx)) }
      : {}),
    parameters: sig.parameters.map((p) => symbolAsParameter(p, ctx)),
    type: typeOf(ctx.checker.getReturnTypeOfSignature(sig), ctx),
  }
}

const parameter = (node: ts.ParameterDeclaration, ctx: Context): T.Parameter => ({
  ...base(node, ctx),
  kind: 'parameter',
  name: node.name.getText(),
  type: node.type ? typeNode(node.type, ctx) : typeOf(ctx.checker.getTypeAtLocation(node), ctx),
  optional: !!node.questionToken || !!node.initializer,
  ...(node.dotDotDotToken ? { rest: true } : {}),
  ...(node.initializer ? { default: node.initializer.getText() } : {}),
})

const symbolAsParameter = (sym: ts.Symbol, ctx: Context): T.Parameter => {
  const decl = sym.valueDeclaration as ts.ParameterDeclaration | undefined
  if (decl && ts.isParameter(decl)) return parameter(decl, ctx)
  const origin = decl ?? sym.declarations?.[0]
  return {
    ...base(origin ?? ({} as ts.Node), ctx),
    kind: 'parameter',
    name: sym.getName(),
    type: origin ? typeOf(ctx.checker.getTypeOfSymbolAtLocation(sym, origin), ctx) : intrinsic('unknown'),
    optional: !!(sym.flags & ts.SymbolFlags.Optional),
  }
}

const typeParameter = (node: ts.TypeParameterDeclaration, ctx: Context): T.TypeParameter => ({
  name: node.name.text,
  ...(node.constraint ? { constraint: typeNode(node.constraint, ctx) } : {}),
  ...(node.default ? { default: typeNode(node.default, ctx) } : {}),
})

const typeParameterFromType = (tp: ts.TypeParameter, ctx: Context): T.TypeParameter => {
  const constraint = tp.getConstraint()
  const dflt = tp.getDefault()
  return {
    name: tp.symbol?.getName() ?? 'T',
    ...(constraint ? { constraint: typeOf(constraint, ctx) } : {}),
    ...(dflt ? { default: typeOf(dflt, ctx) } : {}),
  }
}

// ============================================================================
// TYPES
// Two entry points: a syntactic one (TypeNode → AnyType) and a semantic one
// (ts.Type → AnyType). Syntactic preserves what the author wrote; semantic is
// the fallback for inferred types.
// ============================================================================

const typeNode = (node: ts.TypeNode, ctx: Context): T.AnyType => {
  if (ts.isLiteralTypeNode(node)) {
    const lit = node.literal
    if (lit.kind === ts.SyntaxKind.NullKeyword) return { kind: 'literal', value: null }
    if (ts.isStringLiteral(lit)) return { kind: 'literal', value: lit.text }
    if (ts.isNumericLiteral(lit)) return { kind: 'literal', value: Number(lit.text) }
    if (lit.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'literal', value: true }
    if (lit.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'literal', value: false }
  }

  const kw = INTRINSIC_KEYWORDS[node.kind]
  if (kw) return intrinsic(kw)

  if (ts.isArrayTypeNode(node)) return { kind: 'array', elementType: typeNode(node.elementType, ctx) }
  if (ts.isTupleTypeNode(node)) return { kind: 'tuple', elements: node.elements.map((el) => tupleElement(el, ctx)) }
  if (ts.isUnionTypeNode(node)) return { kind: 'union', types: node.types.map((t) => typeNode(t, ctx)) }
  if (ts.isIntersectionTypeNode(node)) {
    return { kind: 'intersection', types: node.types.map((t) => typeNode(t, ctx)) }
  }
  if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) {
    return { kind: 'function-type', signatures: [signature(node, ctx)] }
  }
  if (ts.isTypeOperatorNode(node)) {
    return { kind: 'type-operator', operator: TYPE_OPERATORS[node.operator]!, target: typeNode(node.type, ctx) }
  }
  if (ts.isTypeQueryNode(node)) {
    return { kind: 'query', queryType: reference(ctx, node.exprName, node.exprName.getText()) }
  }
  if (ts.isTypeReferenceNode(node)) {
    return reference(
      ctx,
      node,
      node.typeName.getText(),
      node.typeArguments?.map((a) => typeNode(a, ctx)),
    )
  }
  if (ts.isTypeLiteralNode(node)) return { kind: 'reflection', declaration: typeLiteral(node, ctx) }

  // Fallback: hand off to the semantic resolver.
  return typeOf(ctx.checker.getTypeFromTypeNode(node), ctx)
}

const tupleElement = (el: ts.TypeNode, ctx: Context): T.TupleElement => {
  if (ts.isNamedTupleMember(el)) {
    return {
      type: typeNode(el.type, ctx),
      name: el.name.text,
      ...(el.questionToken ? { optional: true } : {}),
      ...(el.dotDotDotToken ? { rest: true } : {}),
    }
  }
  if (ts.isOptionalTypeNode(el)) return { type: typeNode(el.type, ctx), optional: true }
  if (ts.isRestTypeNode(el)) return { type: typeNode(el.type, ctx), rest: true }
  return { type: typeNode(el, ctx) }
}

const typeOf = (t: ts.Type, ctx: Context): T.AnyType => {
  const flags = t.flags
  if (flags & ts.TypeFlags.String) return intrinsic('string')
  if (flags & ts.TypeFlags.Number) return intrinsic('number')
  if (flags & ts.TypeFlags.Boolean) return intrinsic('boolean')
  if (flags & ts.TypeFlags.BigInt) return intrinsic('bigint')
  if (flags & ts.TypeFlags.ESSymbol) return intrinsic('symbol')
  if (flags & ts.TypeFlags.Void) return intrinsic('void')
  if (flags & ts.TypeFlags.Undefined) return intrinsic('undefined')
  if (flags & ts.TypeFlags.Null) return { kind: 'literal', value: null }
  if (flags & ts.TypeFlags.Never) return intrinsic('never')
  if (flags & ts.TypeFlags.Any) return intrinsic('any')
  if (flags & ts.TypeFlags.Unknown) return intrinsic('unknown')

  if (t.isStringLiteral()) return { kind: 'literal', value: t.value }
  if (t.isNumberLiteral()) return { kind: 'literal', value: t.value }

  if (t.isUnion()) return { kind: 'union', types: t.types.map((x) => typeOf(x, ctx)) }
  if (t.isIntersection()) return { kind: 'intersection', types: t.types.map((x) => typeOf(x, ctx)) }

  const sym = t.getSymbol() ?? t.aliasSymbol
  const origin = sym?.declarations?.[0]
  const name = sym?.getName() ?? ctx.checker.typeToString(t)
  const args = t.aliasTypeArguments?.map((a) => typeOf(a, ctx))
  // Anonymous: no symbol declaration to anchor to. Tag explicitly so the
  // resolver knows there's nothing to look up.
  if (origin) return reference(ctx, origin, name, args)
  return anonymousReference(ctx, name, args)
}

const typeLiteral = (node: ts.TypeLiteralNode, ctx: Context): T.ObjectLiteral => {
  const buckets = partitionInterfaceMembers(node.members, ctx)
  return {
    ...base(node, ctx),
    kind: 'object-literal',
    properties: buckets.properties,
    ...(buckets.methods.length ? { methods: buckets.methods } : {}),
    ...(buckets.callSignatures.length ? { callSignatures: buckets.callSignatures } : {}),
    ...(buckets.constructSignatures.length ? { constructSignatures: buckets.constructSignatures } : {}),
    ...(buckets.indexSignature ? { indexSignature: buckets.indexSignature } : {}),
  }
}

const INTRINSIC_KEYWORDS: Partial<Record<ts.SyntaxKind, T.IntrinsicType['name']>> = {
  [ts.SyntaxKind.StringKeyword]: 'string',
  [ts.SyntaxKind.NumberKeyword]: 'number',
  [ts.SyntaxKind.BooleanKeyword]: 'boolean',
  [ts.SyntaxKind.BigIntKeyword]: 'bigint',
  [ts.SyntaxKind.SymbolKeyword]: 'symbol',
  [ts.SyntaxKind.VoidKeyword]: 'void',
  [ts.SyntaxKind.UndefinedKeyword]: 'undefined',
  [ts.SyntaxKind.NeverKeyword]: 'never',
  [ts.SyntaxKind.AnyKeyword]: 'any',
  [ts.SyntaxKind.UnknownKeyword]: 'unknown',
  [ts.SyntaxKind.ObjectKeyword]: 'object',
}

const TYPE_OPERATORS: Partial<Record<ts.SyntaxKind, 'keyof' | 'readonly' | 'unique'>> = {
  [ts.SyntaxKind.KeyOfKeyword]: 'keyof',
  [ts.SyntaxKind.ReadonlyKeyword]: 'readonly',
  [ts.SyntaxKind.UniqueKeyword]: 'unique',
}

// ============================================================================
// HELPERS
// ============================================================================

const intrinsic = (name: T.IntrinsicType['name']): T.IntrinsicType => ({ kind: 'intrinsic', name })

/** Build a `ReferenceType`, registering its origin node so the resolver can find it. */
const reference = (ctx: Context, origin: ts.Node, name: string, typeArguments?: T.AnyType[]): T.ReferenceType => {
  const id = ctx.nextId()
  ctx.referenceOrigins.set(id, origin)
  return { kind: 'reference', id, name, ...(typeArguments?.length ? { typeArguments } : {}) }
}

/** A reference with no syntactic origin — pre-classified as anonymous. */
const anonymousReference = (ctx: Context, name: string, typeArguments?: T.AnyType[]): T.ReferenceType => ({
  kind: 'reference',
  id: ctx.nextId(),
  name,
  external: 'anonymous',
  ...(typeArguments?.length ? { typeArguments } : {}),
})

/** Routable declarations (every kind that owns a documentation page) get the naming triple. */
const routableBase = (node: ts.Node, ctx: Context): T.Base & T.Routable => ({
  ...base(node, ctx),
  // Naming fields are stamped during the JSON build pass; placeholders keep
  // the declaration shape stable for the resolver.
  slug: '',
  qualifiedName: '',
  displayName: '',
})

const routableModule = (node: ts.Node, ctx: Context): T.Base & T.Routable => routableBase(node, ctx)

const base = (node: ts.Node, ctx: Context): T.Base => {
  const id = ctx.nextId()
  const named = (node as { name?: ts.Node }).name
  const sym = ctx.checker.getSymbolAtLocation(named ?? node)
  if (sym) ctx.symbolsById.set(id, sym)
  const result: T.Base = { id }
  if (!ctx.exclude?.comments) {
    const comment = commentFor(node, ctx)
    if (comment) result.comment = comment
  }
  if (!ctx.exclude?.sources) {
    const decls = sym?.declarations
    if (decls?.length) {
      const sources: T.Source[] = new Array(decls.length)
      for (let i = 0; i < decls.length; i++) sources[i] = sourceOf(decls[i]!, ctx)
      result.sources = sources
    } else {
      result.sources = [sourceOf(node, ctx)]
    }
  }
  return result
}

const sourceOf = (node: ts.Node, ctx: Context): T.Source => {
  const sf = node.getSourceFile()
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart())
  return { file: relPath(sf, ctx), line: line + 1, column: character + 1 }
}

const relPath = (sf: ts.SourceFile, ctx: Context): string => {
  const cached = ctx.relPath.get(sf)
  if (cached !== undefined) return cached
  const rel = path.relative(ctx.rootDir, sf.fileName)
  ctx.relPath.set(sf, rel)
  return rel
}

const isExported = (node: ts.Node): boolean => {
  if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) return true
  const mods = (node as { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

const heritage = (node: ts.ClassDeclaration, ctx: Context): Pick<T.Class, 'extends' | 'implements'> => {
  const result: Pick<T.Class, 'extends' | 'implements'> = {}
  node.heritageClauses?.forEach((h) => {
    if (h.token === ts.SyntaxKind.ExtendsKeyword) result.extends = h.types.map((t) => typeNode(t, ctx))
    else if (h.token === ts.SyntaxKind.ImplementsKeyword) result.implements = h.types.map((t) => typeNode(t, ctx))
  })
  return result
}

// ============================================================================
// COMMENTS
// ============================================================================

const commentFor = (node: ts.Node, ctx: Context): T.Comment | undefined => {
  const all = ts.getJSDocCommentsAndTags(node)
  if (!all.length) return undefined
  const parts: T.CommentPart[] = []
  const tags: T.CommentTag[] = []
  let seenBlock = false
  for (const b of all) {
    if (!ts.isJSDoc(b)) continue
    seenBlock = true
    appendCommentBody(b.comment, parts)
    if (b.tags) for (const t of b.tags) tags.push(buildTag(t, ctx))
  }
  if (!seenBlock) return undefined
  return { parts, ...(tags.length ? { tags } : {}) }
}

/** Flatten a JSDoc comment into `parts`. */
const appendCommentBody = (
  comment: string | ts.NodeArray<ts.JSDocComment> | undefined,
  parts: T.CommentPart[],
): void => {
  if (!comment) return
  if (typeof comment === 'string') {
    const trimmed = comment.trim()
    if (trimmed) parts.push({ kind: 'text', text: trimmed })
    return
  }
  for (const c of comment) {
    if (c.kind === ts.SyntaxKind.JSDocText) {
      parts.push({ kind: 'text', text: c.text })
      continue
    }
    const target = c.name?.getText() ?? ''
    const linkText = c.text || undefined
    const style = ts.isJSDocLinkCode(c) ? ('code' as const) : ts.isJSDocLinkPlain(c) ? ('plain' as const) : undefined
    parts.push({ kind: 'link', target, ...(linkText ? { text: linkText } : {}), ...(style ? { style } : {}) })
  }
}

const buildTag = (tag: ts.JSDocTag, ctx: Context): T.CommentTag => {
  const text = ts.getTextOfJSDocComment(tag.comment)?.trim() ?? ''
  const exprType = (te?: ts.JSDocTypeExpression) => (te ? typeNode(te.type, ctx) : undefined)

  if (ts.isJSDocPropertyTag(tag)) {
    return {
      tag: '@property',
      name: tag.name.getText(),
      type: exprType(tag.typeExpression),
      text,
    }
  }
  if (ts.isJSDocParameterTag(tag)) {
    return {
      tag: '@param',
      name: tag.name.getText(),
      type: exprType(tag.typeExpression),
      ...(tag.isBracketed ? { optional: true } : {}),
      text,
    }
  }
  if (ts.isJSDocReturnTag(tag)) {
    const type = exprType(tag.typeExpression)
    return { tag: '@returns', ...(type ? { type } : {}), text }
  }
  if (ts.isJSDocThrowsTag(tag)) {
    const type = exprType(tag.typeExpression)
    return { tag: '@throws', ...(type ? { type } : {}), text }
  }
  if (ts.isJSDocTypeTag(tag)) return { tag: '@type', type: exprType(tag.typeExpression)!, text }
  if (ts.isJSDocSatisfiesTag(tag)) return { tag: '@satisfies', type: exprType(tag.typeExpression)!, text }
  if (ts.isJSDocTemplateTag(tag)) {
    return { tag: '@template', typeParameters: tag.typeParameters.map((tp) => typeParameter(tp, ctx)), text }
  }
  if (ts.isJSDocSeeTag(tag)) {
    return { tag: '@see', ...(tag.name ? { target: tag.name.name.getText() } : {}), text }
  }
  if (ts.isJSDocAugmentsTag(tag)) return { tag: '@augments', class: typeNode(tag.class, ctx), text }
  if (ts.isJSDocImplementsTag(tag)) return { tag: '@implements', class: typeNode(tag.class, ctx), text }

  const name = '@' + tag.tagName.text
  if (name === '@example') return parseExample(text)
  return { tag: name, text }
}

/**
 * Pull an optional caption out of an `@example` body. Two forms are recognised:
 *   1. Legacy JSDoc: `<caption>…</caption>` prefix.
 *   2. TypeDoc-style: any text on the line(s) before the first fenced code
 *      block becomes the caption; the fence and its body become the code.
 * When neither pattern matches, the entire body is treated as `code`.
 */
const parseExample = (raw: string): T.CommentTagMap['@example'] => {
  const html = raw.match(/^<caption>([\s\S]*?)<\/caption>\s*([\s\S]*)$/)
  if (html) return { tag: '@example', caption: html[1]!.trim(), code: html[2]!.trim() }
  const fence = raw.search(/^```/m)
  if (fence > 0) {
    const caption = raw.slice(0, fence).trim()
    if (caption) return { tag: '@example', caption, code: raw.slice(fence).trim() }
  }
  return { tag: '@example', code: raw.trim() }
}
