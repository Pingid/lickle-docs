import type * as T from './types.ts'

export interface Visitor {
  onReference: (ref: T.Type<'reference'>) => void
}

/**
 * Walk a single declaration's substructure. Modules and namespaces are no-ops
 * because their children are just ids — every child is reachable through the
 * flat declaration list separately, so recursing here would double-count.
 *
 * Only the per-decl substructure (signatures, types, parameters, …) is walked.
 */
export const Declaration = (d: T.Declaration, v: Visitor): void => {
  switch (d.kind) {
    case 'module':
    case 'namespace':
      return
    case 'variable':
      return Variable(d, v)
    case 'function':
      return Function(d, v)
    case 'class':
      return Class(d, v)
    case 'interface':
      return Interface(d, v)
    case 'type-alias':
      return TypeAlias(d, v)
    case 'enum':
      return Enum(d, v)
  }
}

export const Variable = (n: T.Declaration<'variable'>, v: Visitor): void => Type(n.type, v)

export const Function = (n: T.Declaration<'function'>, v: Visitor): void => n.signatures.forEach((s) => Signature(s, v))

export const Class = (n: T.Declaration<'class'>, v: Visitor): void => {
  n.generics?.forEach((tp) => TypeParameter(tp, v))
  n.extends?.forEach((t) => Type(t, v))
  n.implements?.forEach((t) => Type(t, v))
  n.constructors.forEach((s) => Signature(s, v))
  n.properties.forEach((p) => Property(p, v))
  n.methods.forEach((m) => Method(m, v))
  if (n.indexSignature) IndexSignature(n.indexSignature, v)
}

export const Interface = (n: T.Declaration<'interface'>, v: Visitor): void => {
  n.generics?.forEach((tp) => TypeParameter(tp, v))
  n.extends?.forEach((t) => Type(t, v))
  n.properties.forEach((p) => Property(p, v))
  n.methods.forEach((m) => Method(m, v))
  n.callSignatures?.forEach((s) => Signature(s, v))
  n.constructSignatures?.forEach((s) => Signature(s, v))
  if (n.indexSignature) IndexSignature(n.indexSignature, v)
}

export const TypeAlias = (n: T.Declaration<'type-alias'>, v: Visitor): void => {
  n.generics?.forEach((tp) => TypeParameter(tp, v))
  Type(n.type, v)
}

export const Enum = (n: T.Declaration<'enum'>, _: Visitor): void => {
  n.members.forEach((_) => {
    // v.onEnumMember(m)
  })
}

export const Property = (n: T.Part<'property'>, v: Visitor): void => Type(n.type, v)

export const Method = (n: T.Part<'method'>, v: Visitor): void => n.signatures.forEach((s) => Signature(s, v))

export const IndexSignature = (n: T.Part<'index-signature'>, v: Visitor): void => {
  Parameter(n.parameter, v)
  Type(n.type, v)
}

export const Signature = (n: T.Part<'signature'>, v: Visitor): void => {
  n.generics?.forEach((tp) => TypeParameter(tp, v))
  n.params.forEach((p) => Parameter(p, v))
  Type(n.return, v)
}

export const Parameter = (n: T.Part<'parameter'>, v: Visitor): void => Type(n.type, v)

export const TypeParameter = (n: T.Part<'generic'>, v: Visitor): void => {
  if (n.constraint) Type(n.constraint, v)
  if (n.default) Type(n.default, v)
}

export const ObjectLiteral = (n: T.Type<'record'>, v: Visitor): void => {
  n.properties.forEach((p) => Property(p, v))
  n.methods.forEach((m) => Method(m, v))
  n.callSignatures?.forEach((s) => Signature(s, v))
  n.constructSignatures?.forEach((s) => Signature(s, v))
  if (n.indexSignature) IndexSignature(n.indexSignature, v)
}

export const Type = (t: T.Type, v: Visitor): void => {
  switch (t.kind) {
    case 'reference':
      v.onReference(t)
      t.args?.forEach((a) => Type(a, v))
      return
    case 'union':
    case 'intersection':
      return t.types.forEach((x) => Type(x, v))
    case 'array':
      return Type(t.elementType, v)
    case 'tuple':
      return t.elements.forEach((el) => Type(el.type, v))
    case 'function-type':
      return t.signatures.forEach((s) => Signature(s, v))
    case 'type-operator':
      return Type(t.target, v)
    case 'record':
      return ObjectLiteral(t, v)
    // intrinsic, literal: nothing to do
  }
}
