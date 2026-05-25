import type * as T from './types.js'
import ts from 'typescript'

// ============================================================================
// CONTEXT
// A single mutable id counter is enough for a single-pass walk.
// ============================================================================

export interface GenerateOptions {
  exclude?: { sources?: boolean; comments?: boolean; typeParameters?: boolean }
}

interface Context extends GenerateOptions {
  checker: ts.TypeChecker
  nextId: () => number
  /** Records the symbol behind each declaration id. Used by the second pass. */
  symbolsById: Map<number, ts.Symbol>
  /** Records the syntactic origin of each ReferenceType id. */
  referenceOrigins: Map<number, ts.Node>
  /** Records the syntactic origin of each ReExportReflection (the ExportDeclaration or ExportSpecifier). */
  reExportOrigins: Map<T.ReExportReflection, ts.Node>
}

const makeContext = (checker: ts.TypeChecker, options: Partial<GenerateOptions> = {}): Context => {
  let id = 0
  return {
    checker,
    exclude: options.exclude ?? {},
    nextId: () => ++id,
    symbolsById: new Map(),
    referenceOrigins: new Map(),
    reExportOrigins: new Map(),
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

export interface GenerateResult {
  project: T.ProjectReflection
  /** Pass this to `resolveReferences` to populate `targetId` / `resolvedIds` fields. */
  resolverContext: {
    checker: ts.TypeChecker
    symbolsById: Map<number, ts.Symbol>
    referenceOrigins: Map<number, ts.Node>
    reExportOrigins: Map<T.ReExportReflection, ts.Node>
  }
}

export const generateProject = (
  rootFiles: string[],
  projectName: string,
  compilerOptions: ts.CompilerOptions = {},
  options: Partial<GenerateOptions> = {},
): GenerateResult => {
  const program = ts.createProgram(rootFiles, compilerOptions)
  const ctx = makeContext(program.getTypeChecker(), options)

  const children = program
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile)
    .map((sf) => convertSourceFile(sf, ctx))

  return {
    project: { name: projectName, children },
    resolverContext: {
      checker: ctx.checker,
      symbolsById: ctx.symbolsById,
      referenceOrigins: ctx.referenceOrigins,
      reExportOrigins: ctx.reExportOrigins,
    },
  }
}

// ============================================================================
// MODULE
// ============================================================================

const convertSourceFile = (sf: ts.SourceFile, ctx: Context): T.ModuleReflection => {
  const children: T.DeclarationReflection[] = []
  const reExports: T.ReExportReflection[] = []

  sf.forEachChild((node) => {
    if (!isExported(node)) return
    children.push(...convertDeclaration(node, ctx))
    reExports.push(...convertReExport(node, ctx))
  })

  return {
    ...base(sf, sf.fileName, ctx),
    kind: 'module',
    children,
    ...(reExports.length ? { reExports } : {}),
  }
}

// ============================================================================
// DECLARATION DISPATCH
// One small converter per declaration kind, then a dispatch table.
// ============================================================================

const convertDeclaration = function* (node: ts.Node, ctx: Context): Iterable<T.DeclarationReflection> {
  if (ts.isVariableStatement(node)) yield* convertVariableStatement(node, ctx)
  if (ts.isFunctionDeclaration(node) && node.name) return yield convertFunction(node, ctx)
  if (ts.isClassDeclaration(node) && node.name) return yield convertClass(node, ctx)
  if (ts.isInterfaceDeclaration(node)) return yield convertInterface(node, ctx)
  if (ts.isTypeAliasDeclaration(node)) return yield convertTypeAlias(node, ctx)
  if (ts.isEnumDeclaration(node)) return yield convertEnum(node, ctx)
  if (ts.isModuleDeclaration(node)) {
    const ns = convertNamespace(node, ctx)
    if (ns) yield ns
  }
}

/**
 * Variable declarations whose initializer is an arrow function or function
 * expression are surfaced as functions — this matches how TypeDoc (and most
 * readers) think about `export const foo = (x) => ...`.
 */
const convertVariableStatement = function* (
  stmt: ts.VariableStatement,
  ctx: Context,
): Iterable<T.VariableReflection | T.FunctionReflection> {
  for (const d of stmt.declarationList.declarations) {
    if (!ts.isIdentifier(d.name)) continue
    yield isFunctionInitializer(d) ? convertVariableAsFunction(d, stmt, ctx) : convertVariable(d, stmt, ctx)
  }
}

const isFunctionInitializer = (d: ts.VariableDeclaration): boolean =>
  !!d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))

const convertVariable = (
  d: ts.VariableDeclaration,
  stmt: ts.VariableStatement,
  ctx: Context,
): T.VariableReflection => ({
  ...base(d, (d.name as ts.Identifier).text, ctx),
  kind: 'variable',
  type: d.type ? convertTypeNode(d.type, ctx) : convertType(ctx.checker.getTypeAtLocation(d), ctx),
  ...(d.initializer ? { defaultValue: d.initializer.getText() } : {}),
  flags: flagsFromModifiers(stmt.modifiers),
})

const convertVariableAsFunction = (
  d: ts.VariableDeclaration,
  stmt: ts.VariableStatement,
  ctx: Context,
): T.FunctionReflection => ({
  ...base(d, (d.name as ts.Identifier).text, ctx),
  kind: 'function',
  signatures: collectSignatures(d.initializer as ts.ArrowFunction | ts.FunctionExpression, ctx),
  flags: flagsFromModifiers(stmt.modifiers),
})

const convertFunction = (node: ts.FunctionDeclaration, ctx: Context): T.FunctionReflection => ({
  ...base(node, node.name!.text, ctx),
  kind: 'function',
  signatures: collectSignatures(node, ctx),
  flags: flagsFromModifiers(node.modifiers),
})

const convertClass = (node: ts.ClassDeclaration, ctx: Context): T.ClassReflection => {
  const members = partitionClassMembers(node.members, ctx)
  return {
    ...base(node, node.name!.text, ctx),
    kind: 'class',
    ...(node.typeParameters ? { typeParameters: node.typeParameters.map((tp) => convertTypeParameter(tp, ctx)) } : {}),
    ...heritage(node, ctx),
    constructors: members.constructors,
    properties: members.properties,
    methods: members.methods,
    ...(members.indexSignature ? { indexSignature: members.indexSignature } : {}),
    flags: flagsFromModifiers(node.modifiers),
  }
}

const convertInterface = (node: ts.InterfaceDeclaration, ctx: Context): T.InterfaceReflection => {
  const members = partitionInterfaceMembers(node.members, ctx)
  const extendsTypes = node.heritageClauses
    ?.filter((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
    .flatMap((h) => h.types.map((t) => convertTypeNode(t, ctx)))

  return {
    ...base(node, node.name.text, ctx),
    kind: 'interface',
    ...(node.typeParameters ? { typeParameters: node.typeParameters.map((tp) => convertTypeParameter(tp, ctx)) } : {}),
    ...(extendsTypes?.length ? { extends: extendsTypes } : {}),
    properties: members.properties,
    methods: members.methods,
    ...(members.callSignatures.length ? { callSignatures: members.callSignatures } : {}),
    ...(members.constructSignatures.length ? { constructSignatures: members.constructSignatures } : {}),
    ...(members.indexSignature ? { indexSignature: members.indexSignature } : {}),
  }
}

const convertTypeAlias = (node: ts.TypeAliasDeclaration, ctx: Context): T.TypeAliasReflection => ({
  ...base(node, node.name.text, ctx),
  kind: 'type-alias',
  ...(node.typeParameters ? { typeParameters: node.typeParameters.map((tp) => convertTypeParameter(tp, ctx)) } : {}),
  type: convertTypeNode(node.type, ctx),
})

const convertEnum = (node: ts.EnumDeclaration, ctx: Context): T.EnumReflection => ({
  ...base(node, node.name.text, ctx),
  kind: 'enum',
  isConst: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ConstKeyword),
  members: node.members.map((m): T.EnumMemberReflection => {
    const value = ctx.checker.getConstantValue(m)
    return {
      ...base(m, m.name.getText(), ctx),
      kind: 'enum-member',
      ...(value !== undefined ? { value } : {}),
    }
  }),
})

const convertNamespace = (node: ts.ModuleDeclaration, ctx: Context): T.ModuleReflection | undefined => {
  if (!node.body || !ts.isModuleBlock(node.body)) return undefined
  const children: T.DeclarationReflection[] = []
  node.body.statements.forEach((stmt) => {
    if (!isExported(stmt)) return
    children.push(...convertDeclaration(stmt, ctx))
  })
  return {
    ...base(node, node.name.getText(), ctx),
    kind: 'module',
    children,
  }
}

// ============================================================================
// CLASS / INTERFACE MEMBERS
// ============================================================================

interface ClassMemberBuckets {
  constructors: T.SignatureReflection[]
  properties: T.PropertyReflection[]
  methods: T.MethodReflection[]
  indexSignature?: T.IndexSignatureReflection
}

const partitionClassMembers = (members: ts.NodeArray<ts.ClassElement>, ctx: Context): ClassMemberBuckets => {
  const buckets: ClassMemberBuckets = { constructors: [], properties: [], methods: [] }

  for (const m of members) {
    if (ts.isConstructorDeclaration(m)) {
      buckets.constructors.push(convertSignature(m, ctx))
    } else if (ts.isPropertyDeclaration(m) && ts.isIdentifier(m.name)) {
      buckets.properties.push(convertProperty(m, ctx))
    } else if (ts.isMethodDeclaration(m) && ts.isIdentifier(m.name)) {
      buckets.methods.push(convertMethod(m, ctx))
    } else if (ts.isIndexSignatureDeclaration(m)) {
      buckets.indexSignature = convertIndexSignature(m, ctx)
    }
  }
  return buckets
}

interface InterfaceMemberBuckets {
  properties: T.PropertyReflection[]
  methods: T.MethodReflection[]
  callSignatures: T.SignatureReflection[]
  constructSignatures: T.SignatureReflection[]
  indexSignature?: T.IndexSignatureReflection
}

const partitionInterfaceMembers = (members: ts.NodeArray<ts.TypeElement>, ctx: Context): InterfaceMemberBuckets => {
  const buckets: InterfaceMemberBuckets = {
    properties: [],
    methods: [],
    callSignatures: [],
    constructSignatures: [],
  }

  for (const m of members) {
    if (ts.isPropertySignature(m) && ts.isIdentifier(m.name)) {
      buckets.properties.push(convertPropertySignature(m, ctx))
    } else if (ts.isMethodSignature(m) && ts.isIdentifier(m.name)) {
      buckets.methods.push({
        ...base(m, m.name.text, ctx),
        kind: 'method',
        signatures: [convertSignature(m, ctx)],
      })
    } else if (ts.isCallSignatureDeclaration(m)) {
      buckets.callSignatures.push(convertSignature(m, ctx))
    } else if (ts.isConstructSignatureDeclaration(m)) {
      buckets.constructSignatures.push(convertSignature(m, ctx))
    } else if (ts.isIndexSignatureDeclaration(m)) {
      buckets.indexSignature = convertIndexSignature(m, ctx)
    }
  }
  return buckets
}

const convertProperty = (node: ts.PropertyDeclaration, ctx: Context): T.PropertyReflection => ({
  ...base(node, (node.name as ts.Identifier).text, ctx),
  kind: 'property',
  type: node.type ? convertTypeNode(node.type, ctx) : convertType(ctx.checker.getTypeAtLocation(node), ctx),
  ...(node.initializer ? { defaultValue: node.initializer.getText() } : {}),
  flags: flagsFromModifiers(node.modifiers, { isOptional: !!node.questionToken }),
})

const convertPropertySignature = (node: ts.PropertySignature, ctx: Context): T.PropertyReflection => ({
  ...base(node, (node.name as ts.Identifier).text, ctx),
  kind: 'property',
  type: node.type ? convertTypeNode(node.type, ctx) : intrinsic('unknown'),
  flags: flagsFromModifiers(node.modifiers, { isOptional: !!node.questionToken }),
})

const convertMethod = (node: ts.MethodDeclaration, ctx: Context): T.MethodReflection => ({
  ...base(node, (node.name as ts.Identifier).text, ctx),
  kind: 'method',
  signatures: collectSignatures(node, ctx),
  flags: flagsFromModifiers(node.modifiers),
})

const convertIndexSignature = (node: ts.IndexSignatureDeclaration, ctx: Context): T.IndexSignatureReflection => ({
  ...base(node, '__index', ctx),
  kind: 'index-signature',
  parameter: convertParameter(node.parameters[0]!, ctx),
  type: node.type ? convertTypeNode(node.type, ctx) : intrinsic('unknown'),
})

// ============================================================================
// SIGNATURES, PARAMETERS, TYPE PARAMETERS
// ============================================================================

/** Pull all overload + implementation signatures from a function-like declaration. */
const collectSignatures = (node: ts.SignatureDeclaration, ctx: Context): T.SignatureReflection[] => {
  const type = ctx.checker.getTypeAtLocation(node)
  const sigs = type.getCallSignatures()
  return sigs.length ? sigs.map((s) => convertCheckerSignature(s, node, ctx)) : [convertSignature(node, ctx)]
}

/** Convert a syntactic signature (params + return type node) directly. */
const convertSignature = (node: ts.SignatureDeclaration, ctx: Context): T.SignatureReflection => ({
  ...base(node, node.name?.getText() ?? '__signature', ctx),
  kind: 'signature',
  ...(node.typeParameters ? { typeParameters: node.typeParameters.map((tp) => convertTypeParameter(tp, ctx)) } : {}),
  parameters: node.parameters.map((p) => convertParameter(p, ctx)),
  type: node.type
    ? convertTypeNode(node.type, ctx)
    : convertType(ctx.checker.getReturnTypeOfSignature(ctx.checker.getSignatureFromDeclaration(node)!), ctx),
})

/** Convert a checker Signature when we want resolved overload types. */
const convertCheckerSignature = (sig: ts.Signature, enclosing: ts.Node, ctx: Context): T.SignatureReflection => {
  const decl = sig.getDeclaration()
  // Prefer the syntactic conversion when we have a declaration — it preserves
  // origin nodes for ReferenceTypes, which the resolver needs.
  if (decl) return convertSignature(decl, ctx)
  return {
    ...base(enclosing, '__signature', ctx),
    kind: 'signature',
    ...(sig.typeParameters?.length
      ? { typeParameters: sig.typeParameters.map((tp) => convertTypeParameterFromType(tp, ctx)) }
      : {}),
    parameters: sig.parameters.map((p) => convertSymbolAsParameter(p, ctx)),
    type: convertType(ctx.checker.getReturnTypeOfSignature(sig), ctx),
  }
}

const convertParameter = (node: ts.ParameterDeclaration, ctx: Context): T.ParameterReflection => ({
  ...base(node, node.name.getText(), ctx),
  kind: 'parameter',
  type: node.type ? convertTypeNode(node.type, ctx) : convertType(ctx.checker.getTypeAtLocation(node), ctx),
  isOptional: !!node.questionToken || !!node.initializer,
  ...(node.dotDotDotToken ? { isRest: true } : {}),
  ...(node.initializer ? { defaultValue: node.initializer.getText() } : {}),
})

const convertSymbolAsParameter = (sym: ts.Symbol, ctx: Context): T.ParameterReflection => {
  const decl = sym.valueDeclaration as ts.ParameterDeclaration | undefined
  if (decl && ts.isParameter(decl)) return convertParameter(decl, ctx)
  return {
    ...base(decl ?? sym.declarations?.[0] ?? ({} as ts.Node), sym.getName(), ctx),
    kind: 'parameter',
    type: convertType(ctx.checker.getTypeOfSymbolAtLocation(sym, decl!), ctx),
    isOptional: !!(sym.flags & ts.SymbolFlags.Optional),
  }
}

const convertTypeParameter = (node: ts.TypeParameterDeclaration, ctx: Context): T.TypeParameterReflection => ({
  name: node.name.text,
  ...(node.constraint ? { constraint: convertTypeNode(node.constraint, ctx) } : {}),
  ...(node.default ? { default: convertTypeNode(node.default, ctx) } : {}),
})

const convertTypeParameterFromType = (tp: ts.TypeParameter, ctx: Context): T.TypeParameterReflection => ({
  name: tp.symbol?.getName() ?? 'T',
  ...(tp.getConstraint() ? { constraint: convertType(tp.getConstraint()!, ctx) } : {}),
  ...(tp.getDefault() ? { default: convertType(tp.getDefault()!, ctx) } : {}),
})

// ============================================================================
// TYPES
// Two entry points: a syntactic one (TypeNode → TypeReflection) and a semantic
// one (Type → TypeReflection). Syntactic preserves what the author wrote;
// semantic is the fallback for inferred types.
// ============================================================================

const convertTypeNode = (node: ts.TypeNode, ctx: Context): T.TypeReflection => {
  // Literal types in node form
  if (ts.isLiteralTypeNode(node)) {
    const lit = node.literal
    if (lit.kind === ts.SyntaxKind.NullKeyword) return { kind: 'literal', value: null }
    if (ts.isStringLiteral(lit)) return { kind: 'literal', value: lit.text }
    if (ts.isNumericLiteral(lit)) return { kind: 'literal', value: Number(lit.text) }
    if (lit.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'literal', value: true }
    if (lit.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'literal', value: false }
  }

  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return intrinsic('string')
    case ts.SyntaxKind.NumberKeyword:
      return intrinsic('number')
    case ts.SyntaxKind.BooleanKeyword:
      return intrinsic('boolean')
    case ts.SyntaxKind.BigIntKeyword:
      return intrinsic('bigint')
    case ts.SyntaxKind.SymbolKeyword:
      return intrinsic('symbol')
    case ts.SyntaxKind.VoidKeyword:
      return intrinsic('void')
    case ts.SyntaxKind.UndefinedKeyword:
      return intrinsic('undefined')
    case ts.SyntaxKind.NeverKeyword:
      return intrinsic('never')
    case ts.SyntaxKind.AnyKeyword:
      return intrinsic('any')
    case ts.SyntaxKind.UnknownKeyword:
      return intrinsic('unknown')
    case ts.SyntaxKind.ObjectKeyword:
      return intrinsic('object')
  }

  if (ts.isArrayTypeNode(node)) {
    return { kind: 'array', elementType: convertTypeNode(node.elementType, ctx) }
  }

  if (ts.isTupleTypeNode(node)) {
    return {
      kind: 'tuple',
      elements: node.elements.map((el): T.TupleElement => {
        if (ts.isNamedTupleMember(el)) {
          return {
            type: convertTypeNode(el.type, ctx),
            name: el.name.text,
            ...(el.questionToken ? { isOptional: true } : {}),
            ...(el.dotDotDotToken ? { isRest: true } : {}),
          }
        }
        if (ts.isOptionalTypeNode(el)) {
          return { type: convertTypeNode(el.type, ctx), isOptional: true }
        }
        if (ts.isRestTypeNode(el)) {
          return { type: convertTypeNode(el.type, ctx), isRest: true }
        }
        return { type: convertTypeNode(el, ctx) }
      }),
    }
  }

  if (ts.isUnionTypeNode(node)) {
    return { kind: 'union', types: node.types.map((t) => convertTypeNode(t, ctx)) }
  }

  if (ts.isIntersectionTypeNode(node)) {
    return { kind: 'intersection', types: node.types.map((t) => convertTypeNode(t, ctx)) }
  }

  if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) {
    return { kind: 'function-type', signatures: [convertSignature(node, ctx)] }
  }

  if (ts.isTypeOperatorNode(node)) {
    const opMap: Record<number, 'keyof' | 'readonly' | 'unique'> = {
      [ts.SyntaxKind.KeyOfKeyword]: 'keyof',
      [ts.SyntaxKind.ReadonlyKeyword]: 'readonly',
      [ts.SyntaxKind.UniqueKeyword]: 'unique',
    }
    return { kind: 'type-operator', operator: opMap[node.operator]!, target: convertTypeNode(node.type, ctx) }
  }

  if (ts.isTypeQueryNode(node)) {
    return {
      kind: 'query',
      queryType: reference(ctx, node.exprName, node.exprName.getText()),
    }
  }

  if (ts.isTypeReferenceNode(node)) {
    return reference(
      ctx,
      node,
      node.typeName.getText(),
      node.typeArguments?.map((a) => convertTypeNode(a, ctx)),
    )
  }

  if (ts.isTypeLiteralNode(node)) {
    return { kind: 'reflection', declaration: convertTypeLiteral(node, ctx) }
  }

  // Fallback: hand off to the semantic converter.
  return convertType(ctx.checker.getTypeFromTypeNode(node), ctx)
}

const convertType = (type: ts.Type, ctx: Context): T.TypeReflection => {
  const flags = type.flags
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

  if (type.isStringLiteral()) return { kind: 'literal', value: type.value }
  if (type.isNumberLiteral()) return { kind: 'literal', value: type.value }

  if (type.isUnion()) return { kind: 'union', types: type.types.map((t) => convertType(t, ctx)) }
  if (type.isIntersection()) return { kind: 'intersection', types: type.types.map((t) => convertType(t, ctx)) }

  const sym = type.getSymbol() ?? type.aliasSymbol
  const origin = sym?.declarations?.[0]
  const name = sym?.getName() ?? ctx.checker.typeToString(type)
  const args = type.aliasTypeArguments?.map((a) => convertType(a, ctx))
  // Without an origin we can still emit a reference; it just won't resolve.
  return origin
    ? reference(ctx, origin, name, args)
    : { kind: 'reference', id: ctx.nextId(), name, ...(args?.length ? { typeArguments: args } : {}) }
}

const convertTypeLiteral = (node: ts.TypeLiteralNode, ctx: Context): T.ObjectLiteralReflection => {
  const buckets = partitionInterfaceMembers(node.members, ctx)
  return {
    ...base(node, '__type', ctx),
    kind: 'object-literal',
    properties: buckets.properties,
    ...(buckets.methods.length ? { methods: buckets.methods } : {}),
    ...(buckets.callSignatures.length ? { callSignatures: buckets.callSignatures } : {}),
    ...(buckets.constructSignatures.length ? { constructSignatures: buckets.constructSignatures } : {}),
    ...(buckets.indexSignature ? { indexSignature: buckets.indexSignature } : {}),
  }
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

/**
 * One ExportDeclaration may yield multiple reflections (one per specifier in
 * `export { a, b, c } from './x'`). Each reflection is paired with the origin
 * node (the declaration itself for `*`/namespace forms, the specifier for named
 * forms) so the resolver can map it back to symbols via the checker.
 */
const convertReExport = function* (node: ts.Node, ctx: Context): Iterable<T.ReExportReflection> {
  if (!ts.isExportDeclaration(node) || !node.moduleSpecifier) return
  const sourceModule = (node.moduleSpecifier as ts.StringLiteral).text
  const register = <R extends T.ReExportReflection>(re: R, origin: ts.Node): R => {
    ctx.reExportOrigins.set(re, origin)
    return re
  }

  if (!node.exportClause) {
    yield register({ kind: 're-export-all', sourceModule }, node)
    return
  }
  if (ts.isNamespaceExport(node.exportClause)) {
    yield register({ kind: 're-export-namespace', sourceModule, as: node.exportClause.name.text }, node)
    return
  }
  for (const el of node.exportClause.elements) {
    yield register(
      {
        kind: 're-export-named',
        sourceModule,
        name: (el.propertyName ?? el.name).text,
        ...(el.propertyName ? { as: el.name.text } : {}),
      },
      el,
    )
  }
}

// ============================================================================
// HELPERS
// ============================================================================

const intrinsic = (name: T.IntrinsicType['name']): T.IntrinsicType => ({ kind: 'intrinsic', name })

/** Build a ReferenceType, registering its origin node so the resolver can find it. */
const reference = (
  ctx: Context,
  origin: ts.Node,
  name: string,
  typeArguments?: T.TypeReflection[],
): T.ReferenceType => {
  const id = ctx.nextId()
  ctx.referenceOrigins.set(id, origin)
  return {
    kind: 'reference',
    id,
    name,
    ...(typeArguments?.length ? { typeArguments } : {}),
  }
}

const base = (node: ts.Node, name: string, ctx: Context): T.BaseReflection => {
  const id = ctx.nextId()
  const sym = ctx.checker.getSymbolAtLocation((node as { name?: ts.Node }).name ?? node)
  if (sym) ctx.symbolsById.set(id, sym)
  const nd: T.BaseReflection = { id, name, ...(commentFor(node) ? { comment: commentFor(node)! } : {}) }
  if (!ctx.exclude?.sources) nd.sources = (sym?.declarations?.length ? sym.declarations : [node]).map(sourceOf)
  return nd
}

const sourceOf = (node: ts.Node): T.SourceLocation => {
  const sf = node.getSourceFile()
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart())
  return { file: sf.fileName, line: line + 1, column: character + 1 }
}

const isExported = (node: ts.Node): boolean => {
  if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) return true
  const mods = (node as { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

const heritage = (node: ts.ClassDeclaration, ctx: Context): Pick<T.ClassReflection, 'extends' | 'implements'> => {
  const result: Pick<T.ClassReflection, 'extends' | 'implements'> = {}
  node.heritageClauses?.forEach((h) => {
    if (h.token === ts.SyntaxKind.ExtendsKeyword && h.types[0]) {
      result.extends = convertTypeNode(h.types[0], ctx)
    } else if (h.token === ts.SyntaxKind.ImplementsKeyword) {
      result.implements = h.types.map((t) => convertTypeNode(t, ctx))
    }
  })
  return result
}

const flagsFromModifiers = (
  modifiers: ts.NodeArray<ts.ModifierLike> | undefined,
  extra: T.ReflectionFlags = {},
): T.ReflectionFlags | undefined => {
  const flags: T.ReflectionFlags = { ...extra }
  modifiers?.forEach((m) => {
    switch (m.kind) {
      case ts.SyntaxKind.ReadonlyKeyword:
        flags.isReadonly = true
        break
      case ts.SyntaxKind.StaticKeyword:
        flags.isStatic = true
        break
      case ts.SyntaxKind.AbstractKeyword:
        flags.isAbstract = true
        break
      case ts.SyntaxKind.AsyncKeyword:
        flags.isAsync = true
        break
      case ts.SyntaxKind.PublicKeyword:
        flags.visibility = 'public'
        break
      case ts.SyntaxKind.ProtectedKeyword:
        flags.visibility = 'protected'
        break
      case ts.SyntaxKind.PrivateKeyword:
        flags.visibility = 'private'
        break
    }
  })
  return Object.keys(flags).length ? flags : undefined
}

// ---------------- COMMENTS ----------------

const commentFor = (node: ts.Node): T.Comment | undefined => {
  const ranges = ts.getLeadingCommentRanges(node.getSourceFile().getFullText(), node.getFullStart())
  const jsdoc = ranges
    ?.slice()
    .reverse()
    .find((r) => r.kind === ts.SyntaxKind.MultiLineCommentTrivia)
  if (!jsdoc) return undefined

  const raw = node.getSourceFile().getFullText().slice(jsdoc.pos, jsdoc.end)
  if (!raw.startsWith('/**')) return undefined
  return parseJsDoc(raw)
}

const parseJsDoc = (raw: string): T.Comment => {
  const stripped = raw
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim()

  const lines = stripped.split('\n')
  const textLines: string[] = []
  const tags: T.CommentTag[] = []
  let current: { tag: string; lines: string[] } | undefined

  for (const line of lines) {
    const tagMatch = line.match(/^@(\w+)\s*(.*)$/)
    if (tagMatch) {
      if (current) tags.push(buildTag(current))
      current = { tag: '@' + tagMatch[1], lines: [tagMatch[2]!] }
    } else if (current) {
      current.lines.push(line)
    } else {
      textLines.push(line)
    }
  }
  if (current) tags.push(buildTag(current))

  return { text: textLines.join('\n').trim(), tags }
}

const buildTag = ({ tag, lines }: { tag: string; lines: string[] }): T.CommentTag => {
  const text = lines.join('\n').trim()
  if (tag === '@param') {
    const [name, ...rest] = text.split(/\s+/)
    return { tag: '@param', name, text: rest.join(' ') }
  }
  if (tag === '@example') return { tag: '@example', code: text }
  return { tag, text }
}
