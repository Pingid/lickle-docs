import { makeScanState, type ScanOptions, type ScanState as State } from '../state.ts'
import ts from 'typescript'

import type * as T from '../types.ts'

import { commentForModule, commentForNode } from './comment.ts'

export const scan = (options: ScanOptions) => {
  const { s, files } = setup(options)

  while (files.length) {
    const sf = files.shift()!
    scan.SourceFile(s, sf, files)
  }

  return s
}

export const scanAsync = async (options: ScanOptions, abortSignal?: AbortSignal) => {
  const { s, files } = setup(options)

  while (files.length) {
    const sf = files.shift()!
    scan.SourceFile(s, sf, files)
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (abortSignal?.aborted) throw new Error('Aborted')
  }

  return s
}

const setup = (options: ScanOptions) => {
  const program = ts.createProgram(options.cmd.fileNames, options.cmd.options)
  const checker = program.getTypeChecker()
  const s = makeScanState(checker, options)

  const files = new Array<ts.SourceFile>()
  for (const file of program.getSourceFiles()) {
    if (!options.include(file)) continue
    const sf = program.getSourceFile(file.fileName)
    if (!sf) continue
    files.push(sf)
  }

  return { s, files }
}

scan.SourceFile = (s: State, node: ts.SourceFile, queue: ts.SourceFile[]) => {
  if (s.seen.has(node) || !s.include(node)) return

  s.seen.add(node)
  s.parent = s.root
  const f = statement(s, node, 'module', () => ({ path: s.getPath(node) }))
  s.parent = f.id
  node.statements.forEach((stmt) => {
    if (ts.isExportDeclaration(stmt)) return scan.ExportDeclaration(s, stmt, queue)
    if (ts.isExportAssignment(stmt)) return scan.ExportAssignment(s, stmt)
    scan.Statement(s, stmt)
  })
  return
}

scan.Statement = (s: State, node: ts.Statement) => {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.forEach((d) => scan.VariableDeclaration(s, d))
  }
  if (ts.isVariableDeclaration(node)) return scan.VariableDeclaration(s, node)
  if (ts.isFunctionDeclaration(node)) return scan.FunctionDeclaration(s, node)
  if (ts.isClassDeclaration(node)) return scan.ClassDeclaration(s, node)
  if (ts.isInterfaceDeclaration(node)) return scan.InterfaceDeclaration(s, node)
  if (ts.isTypeAliasDeclaration(node)) return scan.TypeAliasDeclaration(s, node)
  if (ts.isEnumDeclaration(node)) return scan.EnumDeclaration(s, node)
  if (ts.isModuleDeclaration(node)) return scan.ModuleDeclaration(s, node)
}

scan.VariableDeclaration = (s: State, node: ts.VariableDeclaration) => {
  const annotated = node.type && callSignaturesOf(node.type)
  if (annotated?.length) {
    return statement(s, node, 'function', () => ({ signatures: annotated.map((d) => signature(s, d)) }))
  }
  const init = node.initializer
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
    return statement(s, node, 'function', () => functionBody(s, init))
  }
  return statement(s, node, 'variable', () => ({
    type: node.type ? scan.Type(s, node.type) : inferAt(s, node),
    defaultValue: node.initializer?.getText(),
  }))
}

/** Signature declarations of a function-type or a pure call-signature object type. */
const callSignaturesOf = (node: ts.TypeNode): ts.SignatureDeclarationBase[] | undefined => {
  const t = ts.isParenthesizedTypeNode(node) ? node.type : node
  if (ts.isFunctionTypeNode(t)) return [t]
  if (ts.isTypeLiteralNode(t)) {
    const calls = t.members.filter(ts.isCallSignatureDeclaration)
    if (calls.length && calls.length === t.members.length) return calls
  }
  return undefined
}

scan.FunctionDeclaration = (s: State, decl: ts.FunctionDeclaration) => {
  const sym = decl.name ? s.checker.getSymbolAtLocation(decl.name) : undefined
  const overloads = sym?.declarations?.filter(ts.isFunctionDeclaration) ?? [decl]
  if (overloads.length > 1 && overloads[0] !== decl) return
  const sigs = overloads.filter((d) => !d.body)
  const chosen = sigs.length ? sigs : overloads
  return statement(s, decl, 'function', () => ({ signatures: chosen.map((d) => signature(s, d)) }))
}

scan.ClassDeclaration = (s: State, node: ts.ClassDeclaration) => {
  const constructors: T.Part<'signature'>[] = []
  const properties: T.Part<'property'>[] = []
  const methods: T.Part<'method'>[] = []
  let indexSignature: T.Part<'index-signature'> | undefined
  for (const m of node.members) {
    if (ts.isConstructorDeclaration(m)) constructors.push(signature(s, m))
    else if (ts.isPropertyDeclaration(m) && ts.isIdentifier(m.name)) properties.push(property(s, m))
    else if (ts.isMethodDeclaration(m) && ts.isIdentifier(m.name)) methods.push(method(s, m))
    else if (ts.isIndexSignatureDeclaration(m)) indexSignature = indexSignatureDecl(s, m)
  }
  return statement(s, node, 'class', () => ({
    ...generics(s, node),
    ...heritage(s, node),
    constructors,
    properties,
    methods,
    ...(indexSignature ? { indexSignature } : {}),
  }))
}

scan.InterfaceDeclaration = (s: State, node: ts.InterfaceDeclaration) =>
  statement(s, node, 'interface', () => ({
    ...generics(s, node),
    ...interfaceExtends(s, node),
    ...objectMembers(s, node.members),
  }))

scan.TypeAliasDeclaration = (s: State, node: ts.TypeAliasDeclaration) =>
  statement(s, node, 'type-alias', () => ({
    ...generics(s, node),
    type: scan.Type(s, node.type),
  }))

scan.EnumDeclaration = (s: State, node: ts.EnumDeclaration) =>
  statement(s, node, 'enum', () => ({
    const: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ConstKeyword),
    members: node.members.map((m) => enumMember(s, m)),
  }))

scan.ModuleDeclaration = (s: State, node: ts.ModuleDeclaration) => {
  const ns = statement(s, node, 'namespace', () => ({}))
  const body = node.body
  if (!body) return ns

  const prev = s.parent
  s.parent = ns.id
  if (ts.isModuleBlock(body)) {
    body.statements.forEach((stmt) => scan.Statement(s, stmt))
  } else if (ts.isModuleDeclaration(body)) {
    // `namespace A.B { … }` → recurse on the inner `B`.
    scan.ModuleDeclaration(s, body)
  }
  s.parent = prev
  return ns
}

scan.ExportDeclaration = (s: State, node: ts.ExportDeclaration, queue: ts.SourceFile[]) => {
  const spec = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined

  // Enqueue the source module so its declarations exist for resolution.
  if (spec) {
    const sym = s.checker.getSymbolAtLocation(node.moduleSpecifier!)
    const decl = sym?.valueDeclaration ?? sym?.declarations?.[0]
    if (decl && ts.isSourceFile(decl) && !s.seen.has(decl) && s.include(decl)) {
      queue.push(decl)
    }
  }

  // Emit an `export` declaration node (ref filled by resolver).
  const exp = statement(s, node, 'export', () => ({ names: [], star: false }))
  s.exports.push(exp)

  if (!node.exportClause) {
    if (!spec) return
    s.exportsForm.set(exp.id, 'star')
    s.exportsSpec.set(exp.id, spec)
    s.exportsOrigin.set(exp.id, node)
    exp.star = true
    return
  }
  if (ts.isNamespaceExport(node.exportClause)) {
    if (!spec) return
    s.exportsForm.set(exp.id, 'namespace-from')
    s.exportsSpec.set(exp.id, spec)
    s.exportsAlias.set(exp.id, node.exportClause.name.text)
    s.exportsOrigin.set(exp.id, node)
    return
  }
  const entries = node.exportClause.elements.map((el) => ({
    name: (el.propertyName ?? el.name).text,
    ...(el.propertyName ? { as: el.name.text } : {}),
  }))
  s.exportsForm.set(exp.id, spec ? 'named-from' : 'named-local')
  if (spec) s.exportsSpec.set(exp.id, spec)
  s.exportsEntries.set(exp.id, entries)
  s.exportsOrigin.set(exp.id, node)
}

// `export default <expr>` / `export = <expr>`. The target is resolved later.
scan.ExportAssignment = (s: State, node: ts.ExportAssignment) => {
  const exp = statement(s, node, 'export', () => ({ names: [], star: false }))
  s.exports.push(exp)
  s.exportsForm.set(exp.id, 'assignment')
  s.exportsOrigin.set(exp.id, node)
  return exp
}

// ---------------- Type Components ----------------
scan.Type = (s: State, node: ts.TypeNode): T.Type => {
  if (ts.isLiteralTypeNode(node)) return scan.Literal(s, node)
  if (ts.isArrayTypeNode(node)) return scan.Array(s, node)
  if (ts.isTupleTypeNode(node)) return scan.Tuple(s, node)
  if (ts.isUnionTypeNode(node)) return scan.Union(s, node)
  if (ts.isIntersectionTypeNode(node)) return scan.Intersection(s, node)
  if (ts.isTypeOperatorNode(node)) return scan.TypeOperator(s, node)
  if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) return scan.FunctionType(s, node)
  if (ts.isTypeLiteralNode(node)) return scan.Record(s, node)
  if (ts.isParenthesizedTypeNode(node)) return scan.Type(s, node.type)
  if (ts.isConditionalTypeNode(node)) return scan.Conditional(s, node)
  if (ts.isInferTypeNode(node)) return scan.Infer(s, node)
  if (ts.isIndexedAccessTypeNode(node)) return scan.IndexedAccess(s, node)
  if (ts.isMappedTypeNode(node)) return scan.Mapped(s, node)
  if (ts.isTypeQueryNode(node)) return scan.Query(s, node)
  if (ts.isTemplateLiteralTypeNode(node)) return scan.TemplateLiteral(s, node)
  if (ts.isTypePredicateNode(node)) return scan.Predicate(s, node)
  if (ts.isImportTypeNode(node)) return scan.ImportType(s, node)
  const name = INTRINSICS[node.kind]
  if (name) return scan.Intrinsic(s, node, name)

  if (ts.isTypeReferenceNode(node)) return scan.TypeReference(s, node)
  if (ts.isExpressionWithTypeArguments(node)) return scan.ExpressionWithTypeArguments(s, node)

  return scan.Unknown(s, node)
}

scan.Literal = (s: State, node: ts.LiteralTypeNode): T.Type<'literal'> =>
  type(s, node, 'literal', { value: literalValue(node.literal) })

scan.Array = (s: State, node: ts.ArrayTypeNode): T.Type<'array'> =>
  type(s, node, 'array', { elementType: scan.Type(s, node.elementType) })

scan.Union = (s: State, node: ts.UnionTypeNode): T.Type<'union'> =>
  type(s, node, 'union', { types: node.types.map((t) => scan.Type(s, t)) })

scan.Intersection = (s: State, node: ts.IntersectionTypeNode): T.Type<'intersection'> =>
  type(s, node, 'intersection', { types: node.types.map((t) => scan.Type(s, t)) })

scan.Tuple = (s: State, node: ts.TupleTypeNode): T.Type<'tuple'> =>
  type(s, node, 'tuple', { elements: node.elements.map((el) => tupleElement(s, el)) })

scan.TypeOperator = (s: State, node: ts.TypeOperatorNode): T.Type<'type-operator'> =>
  type(s, node, 'type-operator', { operator: TYPE_OPERATORS[node.operator]!, target: scan.Type(s, node.type) })

scan.FunctionType = (s: State, node: ts.FunctionTypeNode | ts.ConstructorTypeNode): T.Type<'function-type'> =>
  type(s, node, 'function-type', { signatures: [signature(s, node)] })

scan.Record = (s: State, node: ts.TypeLiteralNode): T.Type<'record'> =>
  type(s, node, 'record', objectMembers(s, node.members))

scan.Conditional = (s: State, node: ts.ConditionalTypeNode): T.Type<'conditional'> =>
  type(s, node, 'conditional', {
    check: scan.Type(s, node.checkType),
    extends: scan.Type(s, node.extendsType),
    true: scan.Type(s, node.trueType),
    false: scan.Type(s, node.falseType),
  })

scan.Infer = (s: State, node: ts.InferTypeNode): T.Type<'infer'> =>
  type(s, node, 'infer', {
    name: node.typeParameter.name.text,
    ...(node.typeParameter.constraint ? { constraint: scan.Type(s, node.typeParameter.constraint) } : {}),
  })

scan.IndexedAccess = (s: State, node: ts.IndexedAccessTypeNode): T.Type<'indexed-access'> =>
  type(s, node, 'indexed-access', { object: scan.Type(s, node.objectType), index: scan.Type(s, node.indexType) })

scan.Mapped = (s: State, node: ts.MappedTypeNode): T.Type<'mapped'> =>
  type(s, node, 'mapped', {
    typeParameter: scan.TypeParam(s, node.typeParameter),
    ...(node.nameType ? { nameType: scan.Type(s, node.nameType) } : {}),
    ...(node.type ? { type: scan.Type(s, node.type) } : {}),
    ...(node.questionToken ? { optional: true } : {}),
    ...(node.readonlyToken ? { readonly: true } : {}),
  })

scan.Query = (s: State, node: ts.TypeQueryNode): T.Type<'query'> =>
  type(s, node, 'query', {
    name: node.exprName.getText(),
    ...(node.typeArguments?.length ? { args: node.typeArguments.map((a) => scan.Type(s, a)) } : {}),
  })

scan.TemplateLiteral = (s: State, node: ts.TemplateLiteralTypeNode): T.Type<'template-literal'> =>
  type(s, node, 'template-literal', {
    head: node.head.text,
    spans: node.templateSpans.map((sp) => ({ type: scan.Type(s, sp.type), literal: sp.literal.text })),
  })

scan.Predicate = (s: State, node: ts.TypePredicateNode): T.Type<'predicate'> =>
  type(s, node, 'predicate', {
    parameter: node.parameterName.getText(),
    ...(node.assertsModifier ? { asserts: true } : {}),
    ...(node.type ? { type: scan.Type(s, node.type) } : {}),
  })

scan.ImportType = (s: State, node: ts.ImportTypeNode): T.Type<'import-type'> => {
  const arg =
    ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)
      ? node.argument.literal.text
      : node.argument.getText()
  return type(s, node, 'import-type', {
    argument: arg,
    ...(node.qualifier ? { qualifier: node.qualifier.getText() } : {}),
    ...(node.isTypeOf ? { isTypeOf: true } : {}),
    ...(node.typeArguments?.length ? { args: node.typeArguments.map((a) => scan.Type(s, a)) } : {}),
  })
}

scan.TypeReference = (s: State, node: ts.TypeReferenceNode): T.Type<'reference'> =>
  reference(s, node, node.typeArguments)

/** `extends`/`implements` clauses surface base types as `ExpressionWithTypeArguments`. */
scan.ExpressionWithTypeArguments = (s: State, node: ts.ExpressionWithTypeArguments): T.Type<'reference'> =>
  reference(s, node, node.typeArguments)

/** Shared reference builder: names the target via {@link getName} and defers symbol resolution to `resolve`. */
const reference = (s: State, node: ts.Node, typeArguments?: ts.NodeArray<ts.TypeNode>): T.Type<'reference'> => {
  const r = type(s, node, 'reference', { type: 'internal', targetId: 0 } as any)
  r.id = s.nextId()
  r.owner = s.currentStmt
  r.name = getName(node) ?? 'unknown'
  if (typeArguments?.length) r.args = typeArguments.map((a) => scan.Type(s, a))
  s.references.push(r)
  s.referenceOrigins.set(r.id, node)
  return r
}

scan.Unknown = (s: State, node: ts.Node): T.Type<'unknown'> =>
  type(s, node, 'unknown', { text: node.getText(), nodeType: ts.SyntaxKind[node.kind] })

scan.Intrinsic = (s: State, node: ts.Node, name: T.IntrinsicName): T.Type => {
  return type(s, node, 'intrinsic', { name })
}

scan.TypeParam = (s: State, node: ts.TypeParameterDeclaration): T.Part<'generic'> => {
  return part(s, node, 'generic', {
    constraint: node.constraint ? scan.Type(s, node.constraint) : undefined,
    default: node.default ? scan.Type(s, node.default) : undefined,
  })
}

// ---------------- Inference ----------------
/**
 * Infer a declaration's type from the checker when no annotation is present.
 * Builds a structured `Type` for the common shapes (primitives, literals,
 * unions, arrays, named references, object literals) and falls back to the
 * checker's string form for anything more exotic — the hybrid contract.
 */
const inferAt = (s: State, node: ts.Node): T.Type => fromType(s, node, s.checker.getTypeAtLocation(node), new Set())

const inferReturn = (s: State, node: ts.SignatureDeclarationBase): T.Type => {
  const sig = s.checker.getSignatureFromDeclaration(node as ts.SignatureDeclaration)
  return sig ? fromType(s, node, sig.getReturnType(), new Set()) : scan.Intrinsic(s, node, 'unknown')
}

const fromType = (s: State, ctx: ts.Node, type: ts.Type, seen: Set<ts.Type>): T.Type =>
  structured(s, ctx, type, seen) ?? inferredText(s, ctx, type)

const inferredText = (s: State, ctx: ts.Node, type: ts.Type): T.Type =>
  inode(s, 'unknown', {
    text: s.checker.typeToString(type, ctx, ts.TypeFormatFlags.NoTruncation),
    nodeType: 'inferred',
  })

const structured = (s: State, ctx: ts.Node, type: ts.Type, seen: Set<ts.Type>): T.Type | undefined => {
  const f = type.flags
  // Literals first — their flags never overlap the primitive intrinsics.
  if (f & ts.TypeFlags.StringLiteral) return inode(s, 'literal', { value: (type as ts.StringLiteralType).value })
  if (f & ts.TypeFlags.NumberLiteral) return inode(s, 'literal', { value: (type as ts.NumberLiteralType).value })
  if (f & ts.TypeFlags.BigIntLiteral) {
    const v = (type as ts.BigIntLiteralType).value
    return inode(s, 'literal', { value: BigInt((v.negative ? '-' : '') + v.base10Value) })
  }
  if (f & ts.TypeFlags.BooleanLiteral) return inode(s, 'literal', { value: (type as any).intrinsicName === 'true' })
  const intr = intrinsicName(f)
  if (intr) return inode(s, 'intrinsic', { name: intr })
  // Keep a named alias rather than expanding it inline.
  const alias = type.aliasSymbol
  if (alias && isNamed(alias))
    return inferRef(s, alias.getName(), alias, mapArgs(s, ctx, type.aliasTypeArguments, seen))
  if (type.isUnion()) return inode(s, 'union', { types: type.types.map((t) => fromType(s, ctx, t, seen)) })
  if (type.isIntersection())
    return inode(s, 'intersection', { types: type.types.map((t) => fromType(s, ctx, t, seen)) })
  return objectType(s, ctx, type, seen)
}

/** Arrays, named references, and anonymous object literals. */
const objectType = (s: State, ctx: ts.Node, type: ts.Type, seen: Set<ts.Type>): T.Type | undefined => {
  if (!(type.flags & ts.TypeFlags.Object)) return undefined
  const obj = type as ts.ObjectType
  if (obj.objectFlags & ts.ObjectFlags.Reference) {
    const ref = type as ts.TypeReference
    if (ref.target.objectFlags & ts.ObjectFlags.Tuple) return undefined // → string form
    const args = s.checker.getTypeArguments(ref)
    const tname = ref.target.symbol?.getName()
    if ((tname === 'Array' || tname === 'ReadonlyArray') && args.length === 1)
      return inode(s, 'array', { elementType: fromType(s, ctx, args[0]!, seen) })
    const sym = type.getSymbol()
    if (sym && isNamed(sym)) return inferRef(s, sym.getName(), sym, mapArgs(s, ctx, args, seen))
  }
  const sym = type.getSymbol()
  if (sym && isNamed(sym)) return inferRef(s, sym.getName(), sym, undefined)
  // Callable / constructable objects are too rich for a record — defer to text.
  if (type.getCallSignatures().length || type.getConstructSignatures().length) return undefined
  const props = type.getProperties()
  if (!props.length || seen.has(type)) return undefined
  seen.add(type)
  return inode(s, 'record', { properties: props.map((p) => inferProp(s, ctx, p, seen)), methods: [] })
}

const inferProp = (s: State, ctx: ts.Node, sym: ts.Symbol, seen: Set<ts.Type>): T.Part<'property'> => {
  const decl = sym.valueDeclaration ?? sym.declarations?.[0] ?? ctx
  const pt = s.checker.getTypeOfSymbolAtLocation(sym, decl)
  return {
    kind: 'property',
    parent: s.parent,
    sources: [],
    name: sym.getName(),
    type: fromType(s, ctx, pt, seen),
    ...(sym.flags & ts.SymbolFlags.Optional ? { optional: true } : {}),
  } as T.Part<'property'>
}

const inferRef = (s: State, name: string, symbol: ts.Symbol, args?: T.Type[]): T.Type<'reference'> => {
  const r = {
    kind: 'reference',
    parent: s.parent,
    sources: [],
    type: 'internal',
    targetId: 0,
    id: s.nextId(),
    name,
    owner: s.currentStmt,
    ...(args?.length ? { args } : {}),
  } as T.Type<'reference'>
  s.references.push(r)
  s.referenceSymbols.set(r.id, symbol)
  return r
}

const mapArgs = (
  s: State,
  ctx: ts.Node,
  args: readonly ts.Type[] | undefined,
  seen: Set<ts.Type>,
): T.Type[] | undefined => (args?.length ? args.map((a) => fromType(s, ctx, a, seen)) : undefined)

/** A symbol that should render as a clickable name rather than an expanded shape. */
const isNamed = (sym: ts.Symbol): boolean => {
  if (sym.flags & ts.SymbolFlags.TypeParameter) return false
  const n = sym.getName()
  return !!n && !n.startsWith('__')
}

const inode = <K extends keyof T.TypeMap>(
  s: State,
  kind: K,
  fields: Omit<T.TypeMap[K], keyof T.Typebase | 'kind'>,
): T.Type<K> => ({ kind, parent: s.parent, sources: [], ...fields }) as unknown as T.Type<K>

const intrinsicName = (f: ts.TypeFlags): T.IntrinsicName | undefined => {
  if (f & ts.TypeFlags.String) return 'string'
  if (f & ts.TypeFlags.Number) return 'number'
  if (f & ts.TypeFlags.Boolean) return 'boolean'
  if (f & ts.TypeFlags.BigInt) return 'bigint'
  if (f & (ts.TypeFlags.ESSymbol | ts.TypeFlags.UniqueESSymbol)) return 'symbol'
  if (f & ts.TypeFlags.Void) return 'void'
  if (f & ts.TypeFlags.Undefined) return 'undefined'
  if (f & ts.TypeFlags.Null) return 'null'
  if (f & ts.TypeFlags.Never) return 'never'
  if (f & ts.TypeFlags.Any) return 'any'
  if (f & ts.TypeFlags.Unknown) return 'unknown'
  if (f & ts.TypeFlags.NonPrimitive) return 'object'
  return undefined
}

// ---------------- Type Components ----------------
const signature = (s: State, node: ts.SignatureDeclarationBase): T.Part<'signature'> =>
  part(s, node, 'signature', {
    ...(node.typeParameters ? { generics: node.typeParameters.map((tp) => scan.TypeParam(s, tp)) } : {}),
    params: node.parameters.map((p) => parameter(s, p)),
    return: node.type ? scan.Type(s, node.type) : inferReturn(s, node),
  })

const parameter = (b: State, node: ts.ParameterDeclaration): T.Part<'parameter'> =>
  part(b, node, 'parameter', {
    type: node.type ? scan.Type(b, node.type) : inferAt(b, node),
    optional: !!node.questionToken || !!node.initializer,
    ...(node.dotDotDotToken ? { rest: true } : {}),
    ...(node.initializer ? { default: node.initializer.getText() } : {}),
  })

const functionBody = (s: State, node: ts.SignatureDeclarationBase): T.DeclarationDefinitions['function'] => ({
  signatures: [signature(s, node)],
})

const statement = <K extends keyof T.DeclarationMap>(
  s: State,
  node: ts.Node,
  kind: K,
  fields: () => Omit<T.DeclarationMap[K], keyof T.Base | 'kind'> & Partial<T.Base>,
): T.Declaration<K> => {
  const b = base(s, node)
  s.currentStmt = b.id
  Object.assign(b, fields(), { kind })
  s.declarations.push(b as any)
  return b as any
}

const type = <K extends keyof T.TypeMap>(
  s: State,
  node: ts.Node,
  kind: K,
  fields: Omit<T.TypeMap[K], keyof T.Base | 'kind'> & Partial<T.Base>,
): T.Type<K> => {
  const nd = typeBase(s, node) as T.Type
  Object.assign(nd, { kind }, fields)
  return nd as any
}

const part = <K extends keyof T.PartMap>(
  s: State,
  node: ts.Node,
  kind: K,
  fields: Omit<T.PartMap[K], 'kind' | 'name' | keyof T.Typebase> & { name?: string },
): T.Part<K> => {
  const nd = typeBase(s, node) as T.Typebase & { kind?: string; name?: string }
  Object.assign(nd, { kind }, fields)
  if (nd.name === undefined) {
    const n = getName(node)
    if (n !== undefined) nd.name = n
  }
  return nd as any
}
const base = (s: State, node: ts.Node): T.Base => {
  const result: T.Base = typeBase(s, node) as any
  result.id = s.nextId()
  result.name = getName(node) ?? 'unknown'
  result.exported = isExported(node)

  const named = (node as { name?: ts.Node }).name
  const sym = s.checker.getSymbolAtLocation(named ?? node)
  if (sym) s.symbolsById.set(result.id, sym)

  return result
}

const typeBase = (s: State, node: ts.Node): T.Typebase => {
  const result: T.Typebase = { parent: s.parent, sources: [] } as T.Typebase

  const named = (node as { name?: ts.Node }).name
  const sym = s.checker.getSymbolAtLocation(named ?? node)
  if (sym?.declarations?.length) result.sources = sym.declarations!.map((d) => sourceOf(s, d))
  else result.sources = [sourceOf(s, node)]

  const comment = ts.isSourceFile(node) ? commentForModule(s, node) : commentForNode(s, node)
  if (comment) result.comment = comment

  return result
}

const sourceOf = (s: State, node: ts.Node): T.Source => {
  const sf = node.getSourceFile()
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart())
  return { file: s.getPath(sf), line: line + 1, column: character + 1 }
}

// ---------------- Utilities ----------------
export const isExported = (node: ts.Node): boolean => {
  if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) return true
  // `export const x` carries the modifier on the enclosing `VariableStatement`.
  if (ts.isVariableDeclaration(node)) {
    const stmt = node.parent?.parent
    return !!stmt && ts.isVariableStatement(stmt) && isExported(stmt)
  }
  const mods = (node as { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

export const getName = (node: ts.Node): string | undefined => {
  if (ts.isTypeReferenceNode(node)) return node.typeName.getText()
  if (ts.isExpressionWithTypeArguments(node)) return node.expression.getText()
  if (ts.isTypeQueryNode(node)) return node.exprName.getText()
  if (ts.isDeclarationStatement(node)) return ts.getNameOfDeclaration(node)?.getText()
  if (ts.isExpression(node)) return ts.getNameOfDeclaration(node)?.getText()
  if ((node as { name?: ts.Node }).name) return (node as { name?: ts.Node }).name!.getText()
  return undefined
}

const property = (s: State, node: ts.PropertyDeclaration | ts.PropertySignature): T.Part<'property'> =>
  part(s, node, 'property', {
    type: node.type ? scan.Type(s, node.type) : inferAt(s, node),
    ...(node.questionToken ? { optional: true } : {}),
    ...('initializer' in node && node.initializer ? { defaultValue: node.initializer.getText() } : {}),
  })

const method = (s: State, node: ts.MethodDeclaration | ts.MethodSignature): T.Part<'method'> =>
  part(s, node, 'method', { signatures: [signature(s, node)] })

const indexSignatureDecl = (s: State, node: ts.IndexSignatureDeclaration): T.Part<'index-signature'> =>
  part(s, node, 'index-signature', {
    parameter: parameter(s, node.parameters[0]!),
    type: node.type ? scan.Type(s, node.type) : scan.Intrinsic(s, node, 'unknown'),
  })

const enumMember = (s: State, node: ts.EnumMember): T.Part<'enum-member'> => {
  const value = s.checker.getConstantValue(node)
  return part(s, node, 'enum-member', { ...(value !== undefined ? { value } : {}) })
}

const generics = (s: State, node: { typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration> }) =>
  node.typeParameters?.length ? { generics: node.typeParameters.map((tp) => scan.TypeParam(s, tp)) } : {}

const heritage = (s: State, node: ts.ClassDeclaration): { extends?: T.Type[]; implements?: T.Type[] } => {
  const out: { extends?: T.Type[]; implements?: T.Type[] } = {}
  for (const h of node.heritageClauses ?? []) {
    const types = h.types.map((t) => scan.Type(s, t))
    if (h.token === ts.SyntaxKind.ExtendsKeyword) out.extends = types
    else out.implements = types
  }
  return out
}

const interfaceExtends = (s: State, node: ts.InterfaceDeclaration): { extends?: T.Type[] } => {
  const ext = node.heritageClauses?.flatMap((h) => h.types).map((t) => scan.Type(s, t))
  return ext?.length ? { extends: ext } : {}
}

const objectMembers = (s: State, members: ts.NodeArray<ts.TypeElement>) => {
  const properties: T.Part<'property'>[] = []
  const methods: T.Part<'method'>[] = []
  const callSignatures: T.Part<'signature'>[] = []
  const constructSignatures: T.Part<'signature'>[] = []
  let indexSignature: T.Part<'index-signature'> | undefined
  for (const m of members) {
    if (ts.isPropertySignature(m) && ts.isIdentifier(m.name)) properties.push(property(s, m))
    else if (ts.isMethodSignature(m) && ts.isIdentifier(m.name)) methods.push(method(s, m))
    else if (ts.isCallSignatureDeclaration(m)) callSignatures.push(signature(s, m))
    else if (ts.isConstructSignatureDeclaration(m)) constructSignatures.push(signature(s, m))
    else if (ts.isIndexSignatureDeclaration(m)) indexSignature = indexSignatureDecl(s, m)
  }
  return {
    properties,
    methods,
    ...(callSignatures.length ? { callSignatures } : {}),
    ...(constructSignatures.length ? { constructSignatures } : {}),
    ...(indexSignature ? { indexSignature } : {}),
  }
}

const literalValue = (lit: ts.Node): T.Type<'literal'>['value'] => {
  if (lit.kind === ts.SyntaxKind.NullKeyword) return null
  if (ts.isStringLiteral(lit)) return lit.text
  if (ts.isNumericLiteral(lit)) return Number(lit.text)
  if (lit.kind === ts.SyntaxKind.TrueKeyword) return true
  if (lit.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isBigIntLiteral(lit)) return BigInt(lit.text.replace(/n$/, ''))
  return lit.getText()
}

const tupleElement = (s: State, el: ts.TypeNode): T.Part<'tuple-element'> => {
  if (ts.isNamedTupleMember(el))
    return part(s, el, 'tuple-element', {
      type: scan.Type(s, el.type),
      ...(el.questionToken ? { optional: true } : {}),
      ...(el.dotDotDotToken ? { rest: true } : {}),
    })
  if (ts.isOptionalTypeNode(el)) return part(s, el, 'tuple-element', { type: scan.Type(s, el.type), optional: true })
  if (ts.isRestTypeNode(el)) return part(s, el, 'tuple-element', { type: scan.Type(s, el.type), rest: true })
  return part(s, el, 'tuple-element', { type: scan.Type(s, el) })
}

const INTRINSICS: Partial<Record<ts.SyntaxKind, T.IntrinsicName>> = {
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
  [ts.SyntaxKind.ThisType]: 'this',
}

const TYPE_OPERATORS: Partial<Record<ts.SyntaxKind, 'keyof' | 'readonly' | 'unique'>> = {
  [ts.SyntaxKind.KeyOfKeyword]: 'keyof',
  [ts.SyntaxKind.ReadonlyKeyword]: 'readonly',
  [ts.SyntaxKind.UniqueKeyword]: 'unique',
}

// @ts-ignore
const debugName = (node: ts.Node): string => {
  const kindName = ts.SyntaxKind[node.kind]
  if ('name' in node && node.name && ts.isIdentifier(node.name as ts.Node))
    return `${kindName} (${(node.name as ts.Identifier).text})`
  return `${kindName} (anonymous)`
}
