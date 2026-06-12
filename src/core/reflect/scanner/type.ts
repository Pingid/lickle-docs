import ts from 'typescript'

import { t } from '../../../_lib/index.ts'

import { type ScanState as State } from '../state.ts'
import type * as T from '../types.ts'
import * as Make from './make.ts'
import * as Ast from './ast.ts'

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

export const Type = (s: State, node: ts.TypeNode): T.Type => {
  if (ts.isLiteralTypeNode(node)) return Literal(s, node)
  if (ts.isArrayTypeNode(node)) return Array(s, node)
  if (ts.isTupleTypeNode(node)) return Tuple(s, node)
  if (ts.isUnionTypeNode(node)) return Union(s, node)
  if (ts.isIntersectionTypeNode(node)) return Intersection(s, node)
  if (ts.isTypeOperatorNode(node)) return TypeOperator(s, node)
  if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) return FunctionType(s, node)
  if (ts.isTypeLiteralNode(node)) return Record(s, node)
  if (ts.isParenthesizedTypeNode(node)) return Type(s, node.type)
  if (ts.isConditionalTypeNode(node)) return Conditional(s, node)
  if (ts.isInferTypeNode(node)) return Infer(s, node)
  if (ts.isIndexedAccessTypeNode(node)) return IndexedAccess(s, node)
  if (ts.isMappedTypeNode(node)) return Mapped(s, node)
  if (ts.isTypeQueryNode(node)) return Query(s, node)
  if (ts.isTemplateLiteralTypeNode(node)) return TemplateLiteral(s, node)
  if (ts.isTypePredicateNode(node)) return Predicate(s, node)
  if (ts.isImportTypeNode(node)) return ImportType(s, node)
  const name = INTRINSICS[node.kind]
  if (name) return Intrinsic(s, node, name)
  if (ts.isTypeReferenceNode(node)) return TypeReference(s, node)
  if (ts.isExpressionWithTypeArguments(node)) return ExpressionWithTypeArguments(s, node)
  return Unknown(s, node)
}

export const Literal = (s: State, node: ts.LiteralTypeNode): T.Type<'literal'> =>
  Make.type(s, node, 'literal', { value: literalValue(node.literal) })

export const Array = (s: State, node: ts.ArrayTypeNode): T.Type<'array'> =>
  Make.type(s, node, 'array', { elementType: Type(s, node.elementType) })

export const Union = (s: State, node: ts.UnionTypeNode): T.Type<'union'> =>
  Make.type(s, node, 'union', { types: node.types.map((t) => Type(s, t)) })

export const Intersection = (s: State, node: ts.IntersectionTypeNode): T.Type<'intersection'> =>
  Make.type(s, node, 'intersection', { types: node.types.map((t) => Type(s, t)) })

export const Tuple = (s: State, node: ts.TupleTypeNode): T.Type<'tuple'> =>
  Make.type(s, node, 'tuple', { elements: node.elements.map((el) => tupleElement(s, el)) })

export const TypeOperator = (s: State, node: ts.TypeOperatorNode): T.Type<'type-operator'> =>
  Make.type(s, node, 'type-operator', { operator: TYPE_OPERATORS[node.operator]!, target: Type(s, node.type) })

export const FunctionType = (s: State, node: ts.FunctionTypeNode | ts.ConstructorTypeNode): T.Type<'function-type'> =>
  Make.type(s, node, 'function-type', { signatures: [signature(s, node)] })

export const Record = (s: State, node: ts.TypeLiteralNode): T.Type<'record'> =>
  Make.type(s, node, 'record', objectMembers(s, node.members))

export const Conditional = (s: State, node: ts.ConditionalTypeNode): T.Type<'conditional'> =>
  Make.type(s, node, 'conditional', {
    check: Type(s, node.checkType),
    extends: Type(s, node.extendsType),
    true: Type(s, node.trueType),
    false: Type(s, node.falseType),
  })

export const Infer = (s: State, node: ts.InferTypeNode): T.Type<'infer'> =>
  Make.type(s, node, 'infer', {
    name: node.typeParameter.name.text,
    ...(node.typeParameter.constraint ? { constraint: Type(s, node.typeParameter.constraint) } : {}),
  })

export const IndexedAccess = (s: State, node: ts.IndexedAccessTypeNode): T.Type<'indexed-access'> =>
  Make.type(s, node, 'indexed-access', { object: Type(s, node.objectType), index: Type(s, node.indexType) })

export const Mapped = (s: State, node: ts.MappedTypeNode): T.Type<'mapped'> =>
  Make.type(s, node, 'mapped', {
    typeParameter: TypeParam(s, node.typeParameter),
    ...(node.nameType ? { nameType: Type(s, node.nameType) } : {}),
    ...(node.type ? { type: Type(s, node.type) } : {}),
    ...(node.questionToken ? { optional: true } : {}),
    ...(node.readonlyToken ? { readonly: true } : {}),
  })

export const Query = (s: State, node: ts.TypeQueryNode): T.Type<'query'> =>
  Make.type(s, node, 'query', {
    name: node.exprName.getText(),
    ...(node.typeArguments?.length ? { args: node.typeArguments.map((a) => Type(s, a)) } : {}),
  })

export const TemplateLiteral = (s: State, node: ts.TemplateLiteralTypeNode): T.Type<'template-literal'> =>
  Make.type(s, node, 'template-literal', {
    head: node.head.text,
    spans: node.templateSpans.map((sp) => ({ type: Type(s, sp.type), literal: sp.literal.text })),
  })

export const Predicate = (s: State, node: ts.TypePredicateNode): T.Type<'predicate'> =>
  Make.type(s, node, 'predicate', {
    parameter: node.parameterName.getText(),
    ...(node.assertsModifier ? { asserts: true } : {}),
    ...(node.type ? { type: Type(s, node.type) } : {}),
  })

export const ImportType = (s: State, node: ts.ImportTypeNode): T.Type<'import-type'> => {
  const arg =
    ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)
      ? node.argument.literal.text
      : node.argument.getText()
  return Make.type(s, node, 'import-type', {
    argument: arg,
    ...(node.qualifier ? { qualifier: node.qualifier.getText() } : {}),
    ...(node.isTypeOf ? { isTypeOf: true } : {}),
    ...(node.typeArguments?.length ? { args: node.typeArguments.map((a) => Type(s, a)) } : {}),
  })
}

export const TypeReference = (s: State, node: ts.TypeReferenceNode): T.Type<'reference'> =>
  reference(s, node, node.typeArguments)

export const ExpressionWithTypeArguments = (s: State, node: ts.ExpressionWithTypeArguments): T.Type<'reference'> =>
  reference(s, node, node.typeArguments)

export const Unknown = (s: State, node: ts.Node): T.Type<'unknown'> =>
  Make.type(s, node, 'unknown', { text: node.getText(), nodeType: ts.SyntaxKind[node.kind] })

export const Intrinsic = (s: State, node: ts.Node, name: T.IntrinsicName): T.Type =>
  Make.type(s, node, 'intrinsic', { name })

export const TypeParam = (s: State, node: ts.TypeParameterDeclaration): T.Part<'generic'> =>
  Make.part(s, node, 'generic', {
    constraint: node.constraint ? Type(s, node.constraint) : undefined,
    default: node.default ? Type(s, node.default) : undefined,
  })

export const signature = (s: State, node: ts.SignatureDeclarationBase): T.Part<'signature'> =>
  Make.part(s, node, 'signature', {
    ...(node.typeParameters ? { generics: node.typeParameters.map((tp) => TypeParam(s, tp)) } : {}),
    params: node.parameters.map((p) => parameter(s, p)),
    return: node.type ? Type(s, node.type) : inferReturn(s, node),
  })

export const parameter = (s: State, node: ts.ParameterDeclaration): T.Part<'parameter'> =>
  Make.part(s, node, 'parameter', {
    type: node.type ? Type(s, node.type) : inferAt(s, node),
    optional: !!node.questionToken || !!node.initializer,
    ...(node.dotDotDotToken ? { rest: true } : {}),
    ...(node.initializer ? { default: node.initializer.getText() } : {}),
  })

export const inferAt = (s: State, node: ts.Node): T.Type =>
  fromType(s, node, s.checker.getTypeAtLocation(node), new Set())

export const inferReturn = (s: State, node: ts.SignatureDeclarationBase): T.Type => {
  const sig = s.checker.getSignatureFromDeclaration(node as ts.SignatureDeclaration)
  return sig ? fromType(s, node, sig.getReturnType(), new Set()) : Intrinsic(s, node, 'unknown')
}

export const objectMembers = (s: State, members: ts.NodeArray<ts.TypeElement>) => {
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

const reference = (s: State, node: ts.Node, typeArguments?: ts.NodeArray<ts.TypeNode>): T.Type<'reference'> => {
  const r = Make.type(s, node, 'reference', { type: 'internal', targetId: 0 } as any)
  r.id = s.nextId()
  r.owner = s.currentStmt
  r.name = Ast.getName(node) ?? 'unknown'
  if (typeArguments?.length) r.args = typeArguments.map((a) => Type(s, a))
  s.references.push(r)
  s.referenceOrigins.set(r.id, node)
  return r
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
  if (f & ts.TypeFlags.StringLiteral) return inode(s, 'literal', { value: (type as ts.StringLiteralType).value })
  if (f & ts.TypeFlags.NumberLiteral) return inode(s, 'literal', { value: (type as ts.NumberLiteralType).value })
  if (f & ts.TypeFlags.BigIntLiteral) {
    const v = (type as ts.BigIntLiteralType).value
    return inode(s, 'literal', { value: BigInt((v.negative ? '-' : '') + v.base10Value) })
  }
  if (f & ts.TypeFlags.BooleanLiteral) return inode(s, 'literal', { value: (type as any).intrinsicName === 'true' })
  const intr = intrinsicName(f)
  if (intr) return inode(s, 'intrinsic', { name: intr })
  const alias = type.aliasSymbol
  if (alias && isNamed(alias))
    return inferRef(s, alias.getName(), alias, mapArgs(s, ctx, type.aliasTypeArguments, seen))
  if (type.isUnion()) return inode(s, 'union', { types: type.types.map((t) => fromType(s, ctx, t, seen)) })
  if (type.isIntersection())
    return inode(s, 'intersection', { types: type.types.map((t) => fromType(s, ctx, t, seen)) })
  return objectType(s, ctx, type, seen)
}

const objectType = (s: State, ctx: ts.Node, type: ts.Type, seen: Set<ts.Type>): T.Type | undefined => {
  if (!(type.flags & ts.TypeFlags.Object)) return undefined
  const obj = type as ts.ObjectType
  if (obj.objectFlags & ts.ObjectFlags.Reference) {
    const ref = type as ts.TypeReference
    if (ref.target.objectFlags & ts.ObjectFlags.Tuple) return undefined
    const args = s.checker.getTypeArguments(ref)
    const tname = ref.target.symbol?.getName()
    if ((tname === 'Array' || tname === 'ReadonlyArray') && args.length === 1)
      return inode(s, 'array', { elementType: fromType(s, ctx, args[0]!, seen) })
    const sym = type.getSymbol()
    if (sym && isNamed(sym)) return inferRef(s, sym.getName(), sym, mapArgs(s, ctx, args, seen))
  }
  const sym = type.getSymbol()
  if (sym && isNamed(sym)) return inferRef(s, sym.getName(), sym, undefined)
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
    targetId: t.brand<T.Id>(0),
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

const property = (s: State, node: ts.PropertyDeclaration | ts.PropertySignature): T.Part<'property'> =>
  Make.part(s, node, 'property', {
    type: node.type ? Type(s, node.type) : inferAt(s, node),
    ...(node.questionToken ? { optional: true } : {}),
    ...('initializer' in node && node.initializer
      ? { defaultValue: defaultValueOf(node.initializer as ts.Expression) }
      : {}),
  })

const method = (s: State, node: ts.MethodDeclaration | ts.MethodSignature): T.Part<'method'> =>
  Make.part(s, node, 'method', { signatures: [signature(s, node)] })

const indexSignatureDecl = (s: State, node: ts.IndexSignatureDeclaration): T.Part<'index-signature'> =>
  Make.part(s, node, 'index-signature', {
    parameter: parameter(s, node.parameters[0]!),
    type: node.type ? Type(s, node.type) : Intrinsic(s, node, 'unknown'),
  })

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
    return Make.part(s, el, 'tuple-element', {
      type: Type(s, el.type),
      ...(el.questionToken ? { optional: true } : {}),
      ...(el.dotDotDotToken ? { rest: true } : {}),
    })
  if (ts.isOptionalTypeNode(el)) return Make.part(s, el, 'tuple-element', { type: Type(s, el.type), optional: true })
  if (ts.isRestTypeNode(el)) return Make.part(s, el, 'tuple-element', { type: Type(s, el.type), rest: true })
  return Make.part(s, el, 'tuple-element', { type: Type(s, el) })
}

const defaultValueOf = (init?: ts.Expression): string | undefined => {
  const text = init?.getText()
  if (!text || text.length > 80 || text.includes('\n')) return undefined
  return text
}
