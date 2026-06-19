import ts from 'typescript'

import { t } from '../../../_lib/index.ts'

import { type ScanState as State } from '../state.ts'
import type * as T from '../types.ts'

/** Structured type of a node with no annotation, recovered from the checker. */
export const inferAt = (s: State, node: ts.Node): T.Type =>
  fromType(s, node, s.checker.getTypeAtLocation(node), new Set())

/** Structured return type of a signature with no return annotation. */
export const inferReturn = (s: State, node: ts.SignatureDeclarationBase): T.Type => {
  const sig = s.checker.getSignatureFromDeclaration(node as ts.SignatureDeclaration)
  return sig ? fromType(s, node, sig.getReturnType(), new Set()) : inode(s, 'intrinsic', { name: 'unknown' })
}

const fromType = (s: State, ctx: ts.Node, type: ts.Type, seen: Set<ts.Type>): T.Type =>
  structured(s, ctx, type, seen) ?? inferredText(s, ctx, type)

const structured = (s: State, ctx: ts.Node, type: ts.Type, seen: Set<ts.Type>): T.Type | undefined => {
  const f = type.flags
  // Enum members carry literal flags too — must precede the literal branches.
  if (f & ts.TypeFlags.EnumLike) {
    const e = enumReference(s, type)
    if (e) return e
  }
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
  if (f & ts.TypeFlags.TypeParameter) {
    const r = typeParameterType(s, type)
    if (r) return r
  }
  if (type.isUnion()) return unionType(s, ctx, type, seen)
  if (type.isIntersection())
    return inode(s, 'intersection', { types: type.types.map((u) => fromType(s, ctx, u, seen)) })
  return objectType(s, ctx, type, seen)
}

/**
 * `Color.Red` and widened `Color` become references to the enum declaration,
 * which is in `idByNode`, so resolve links them internally.
 */
const enumReference = (s: State, type: ts.Type): T.Type<'reference'> | undefined => {
  const sym = type.getSymbol()
  const decl = sym?.valueDeclaration ?? sym?.declarations?.[0]
  if (!sym || !decl) return undefined
  if (ts.isEnumMember(decl)) {
    const enumSym = s.checker.getSymbolAtLocation(decl.parent.name)
    return enumSym ? inferRef(s, `${enumSym.getName()}.${sym.getName()}`, enumSym) : undefined
  }
  if (ts.isEnumDeclaration(decl)) return inferRef(s, sym.getName(), sym)
  return undefined
}

/**
 * Inferred occurrences of a type parameter `T`. The `this` type is also
 * TypeParameter-flagged, but its symbol is the owning class.
 */
const typeParameterType = (s: State, type: ts.Type): T.Type | undefined => {
  const sym = type.getSymbol()
  if (!sym) return undefined
  if (!(sym.flags & ts.SymbolFlags.TypeParameter)) return inode(s, 'intrinsic', { name: 'this' })
  return inferRef(s, sym.getName(), sym)
}

/** The checker normalizes `boolean | X` to `false | true | X`; re-merge the pair. */
const unionType = (s: State, ctx: ts.Node, union: ts.UnionType, seen: Set<ts.Type>): T.Type => {
  const collapse = union.types.filter((u) => u.flags & ts.TypeFlags.BooleanLiteral).length === 2
  let collapsed = false
  const types: T.Type[] = []
  for (const u of union.types) {
    if (collapse && u.flags & ts.TypeFlags.BooleanLiteral) {
      if (!collapsed) types.push(inode(s, 'intrinsic', { name: 'boolean' }))
      collapsed = true
      continue
    }
    types.push(fromType(s, ctx, u, seen))
  }
  return types.length === 1 ? types[0]! : inode(s, 'union', { types })
}

const objectType = (s: State, ctx: ts.Node, type: ts.Type, seen: Set<ts.Type>): T.Type | undefined => {
  if (!(type.flags & ts.TypeFlags.Object)) return undefined
  const obj = type as ts.ObjectType
  if (obj.objectFlags & ts.ObjectFlags.Reference) {
    const ref = type as ts.TypeReference
    if (ref.target.objectFlags & ts.ObjectFlags.Tuple) return tupleType(s, ctx, ref, seen)
    const args = s.checker.getTypeArguments(ref)
    const tname = ref.target.symbol?.getName()
    if ((tname === 'Array' || tname === 'ReadonlyArray') && args.length === 1) {
      const arr = inode(s, 'array', { elementType: fromType(s, ctx, args[0]!, seen) })
      return tname === 'ReadonlyArray' ? inode(s, 'type-operator', { operator: 'readonly', target: arr }) : arr
    }
    const sym = type.getSymbol()
    if (sym && isNamed(sym)) return inferRef(s, sym.getName(), sym, mapArgs(s, ctx, args, seen))
  }
  const sym = type.getSymbol()
  if (sym && isNamed(sym)) return inferRef(s, sym.getName(), sym, undefined)
  return anonymousType(s, ctx, type, seen)
}

const tupleType = (s: State, ctx: ts.Node, ref: ts.TypeReference, seen: Set<ts.Type>): T.Type | undefined =>
  withSeen(ref, seen, () => {
    const target = ref.target as ts.TupleType
    const elements = s.checker.getTypeArguments(ref).map((arg, i) => {
      const flags = target.elementFlags[i] ?? ts.ElementFlags.Required
      const label = target.labeledElementDeclarations?.[i]
      const el = fromType(s, ctx, arg, seen)
      return ipart(s, 'tuple-element', {
        ...(label && ts.isIdentifier(label.name) ? { name: label.name.text } : {}),
        // Rest args carry the element type (`string` for `...string[]`); re-wrap
        // as array for parity with the AST path. Variadic (`...T`) is the type itself.
        type: flags & ts.ElementFlags.Rest ? inode(s, 'array', { elementType: el }) : el,
        ...(flags & ts.ElementFlags.Optional ? { optional: true } : {}),
        ...(flags & ts.ElementFlags.Variable ? { rest: true } : {}),
      })
    })
    const tuple = inode(s, 'tuple', { elements })
    // Parity with the AST path: readonly tuples are a type-operator wrapper.
    return target.readonly ? inode(s, 'type-operator', { operator: 'readonly', target: tuple }) : tuple
  })

const anonymousType = (s: State, ctx: ts.Node, type: ts.Type, seen: Set<ts.Type>): T.Type | undefined =>
  withSeen(type, seen, () => {
    const sigs: T.Part<'signature'>[] = [
      ...type.getCallSignatures().map((sig) => checkerSignature(s, ctx, sig, seen)),
      ...type.getConstructSignatures().map((sig) => ({ ...checkerSignature(s, ctx, sig, seen), construct: true })),
    ]
    // Without the Prototype filter every class-expression type grows a `prototype` member.
    const props = type.getProperties().filter((p) => !(p.flags & ts.SymbolFlags.Prototype))
    const indexes = s.checker.getIndexInfosOfType(type)
    if (sigs.length && !props.length && !indexes.length) return inode(s, 'function-type', { signatures: sigs })
    if (!sigs.length && !props.length && !indexes.length) return undefined
    return inode(s, 'record', {
      members: [
        ...sigs,
        ...props.map((p) => inferMember(s, ctx, p, seen)),
        ...indexes.map((i) => indexMember(s, ctx, i, seen)),
      ],
    })
  })

/**
 * Signature built from the checker rather than its declaration AST, so
 * instantiated generics surface their type arguments (`() => number`, not
 * `() => T`). Names, optionality, rest and defaults come from the parameter's
 * declaration when present.
 */
const checkerSignature = (s: State, ctx: ts.Node, sig: ts.Signature, seen: Set<ts.Type>): T.Part<'signature'> => {
  const generics = (sig.getTypeParameters() ?? []).map((tp) => checkerGeneric(s, ctx, tp, seen))
  return ipart(s, 'signature', {
    ...(generics.length ? { generics } : {}),
    params: sig.getParameters().map((p) => checkerParam(s, ctx, p, seen)),
    return: fromType(s, ctx, sig.getReturnType(), seen),
  })
}

const checkerParam = (s: State, ctx: ts.Node, sym: ts.Symbol, seen: Set<ts.Type>): T.Part<'parameter'> => {
  const decl = sym.valueDeclaration
  const p = decl && ts.isParameter(decl) ? decl : undefined
  return ipart(s, 'parameter', {
    name: p ? (ts.isIdentifier(p.name) ? p.name.text : p.name.getText()) : sym.getName(),
    type: fromType(s, ctx, s.checker.getTypeOfSymbolAtLocation(sym, decl ?? ctx), seen),
    optional: !!(p?.questionToken || p?.initializer || sym.flags & ts.SymbolFlags.Optional),
    ...(p?.dotDotDotToken ? { rest: true } : {}),
    ...(p?.initializer ? { default: p.initializer.getText() } : {}),
  })
}

const checkerGeneric = (s: State, ctx: ts.Node, tp: ts.TypeParameter, seen: Set<ts.Type>): T.Part<'generic'> => {
  const constraint = tp.getConstraint()
  const dflt = tp.getDefault()
  return ipart(s, 'generic', {
    name: tp.symbol.getName(),
    ...(constraint ? { constraint: fromType(s, ctx, constraint, seen) } : {}),
    ...(dflt ? { default: fromType(s, ctx, dflt, seen) } : {}),
  })
}

/** Shorthand methods keep method syntax, mirroring the AST path's `objectMembers`. */
const inferMember = (s: State, ctx: ts.Node, sym: ts.Symbol, seen: Set<ts.Type>): T.Member => {
  const decl = sym.valueDeclaration ?? sym.declarations?.[0] ?? ctx
  const type = fromType(s, ctx, s.checker.getTypeOfSymbolAtLocation(sym, decl), seen)
  if (sym.flags & ts.SymbolFlags.Method && type.kind === 'function-type')
    return ipart(s, 'method', { name: sym.getName(), signatures: type.signatures })
  return ipart(s, 'property', {
    name: sym.getName(),
    type,
    ...(sym.flags & ts.SymbolFlags.Optional ? { optional: true } : {}),
  })
}

const indexMember = (s: State, ctx: ts.Node, info: ts.IndexInfo, seen: Set<ts.Type>): T.Part<'index-signature'> =>
  ipart(s, 'index-signature', {
    parameter: ipart(s, 'parameter', {
      name: info.declaration?.parameters[0]?.name.getText() ?? 'key',
      type: fromType(s, ctx, info.keyType, seen),
      optional: false,
    }),
    type: fromType(s, ctx, info.type, seen),
  })

const inferRef = (s: State, name: string, symbol: ts.Symbol, args?: T.Type[]): T.Type<'reference'> => {
  const r = {
    kind: 'reference',
    parent: s.parent,
    sources: [],
    id: s.nextId(),
    name,
    owner: s.currentStmt,
    ...(args?.length ? { args } : {}),
    target: { type: 'internal', id: t.brand<T.Id>(0) },
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
  // Methods are parts, never standalone declarations — a reference to one
  // could never resolve; structure their function type instead.
  if (sym.flags & (ts.SymbolFlags.TypeParameter | ts.SymbolFlags.Method)) return false
  const n = sym.getName()
  return !!n && !n.startsWith('__')
}

const inferredText = (s: State, ctx: ts.Node, type: ts.Type): T.Type =>
  inode(s, 'unknown', {
    text: s.checker.typeToString(type, ctx, ts.TypeFormatFlags.NoTruncation),
    nodeType: 'inferred',
  })

const inode = <K extends keyof T.TypeMap>(
  s: State,
  kind: K,
  fields: Omit<T.TypeMap[K], keyof T.NodeBase | 'kind'>,
): T.Type<K> => ({ kind, parent: s.parent, sources: [], ...fields }) as unknown as T.Type<K>

const ipart = <K extends keyof T.PartMap>(
  s: State,
  kind: K,
  fields: Omit<T.PartMap[K], keyof T.NodeBase | 'kind'>,
): T.Part<K> => ({ kind, parent: s.parent, sources: [], ...fields }) as unknown as T.Part<K>

/**
 * Path-scoped cycle guard: a type already on the current expansion path yields
 * undefined, which `fromType` turns into the text fallback. Removing on exit
 * lets DAG-shared types structure at every occurrence.
 */
const withSeen = (type: ts.Type, seen: Set<ts.Type>, build: () => T.Type | undefined): T.Type | undefined => {
  if (seen.has(type)) return undefined
  seen.add(type)
  try {
    return build()
  } finally {
    seen.delete(type)
  }
}

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
