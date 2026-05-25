import type * as T from './types.ts'

export interface Visitor {
  onReference: (ref: T.ReferenceType) => void
  onReExport: (re: T.ReExportReflection) => void
}

export const Project = (p: T.ProjectReflection, v: Visitor): void => p.children.forEach((m) => Module(m, v))

export const Module = (m: T.ModuleReflection, v: Visitor): void => {
  m.reExports?.forEach((re) => v.onReExport(re))
  m.children.forEach((c) => Declaration(c, v))
}

export const Declaration = (d: T.DeclarationReflection, v: Visitor): void => {
  switch (d.kind) {
    case 'module':
      return Module(d, v)
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

export const Variable = (n: T.VariableReflection, v: Visitor): void => Type(n.type, v)

export const Function = (n: T.FunctionReflection, v: Visitor): void => n.signatures.forEach((s) => Signature(s, v))

export const Class = (n: T.ClassReflection, v: Visitor): void => {
  n.typeParameters?.forEach((tp) => TypeParameter(tp, v))
  if (n.extends) Type(n.extends, v)
  n.implements?.forEach((t) => Type(t, v))
  n.constructors.forEach((s) => Signature(s, v))
  n.properties.forEach((p) => Property(p, v))
  n.methods.forEach((m) => Method(m, v))
  if (n.indexSignature) IndexSignature(n.indexSignature, v)
}

export const Interface = (n: T.InterfaceReflection, v: Visitor): void => {
  n.typeParameters?.forEach((tp) => TypeParameter(tp, v))
  n.extends?.forEach((t) => Type(t, v))
  n.properties.forEach((p) => Property(p, v))
  n.methods.forEach((m) => Method(m, v))
  n.callSignatures?.forEach((s) => Signature(s, v))
  n.constructSignatures?.forEach((s) => Signature(s, v))
  if (n.indexSignature) IndexSignature(n.indexSignature, v)
}

export const TypeAlias = (n: T.TypeAliasReflection, v: Visitor): void => {
  n.typeParameters?.forEach((tp) => TypeParameter(tp, v))
  Type(n.type, v)
}

export const Enum = (_: T.EnumReflection, _v: Visitor): void => {
  // Enum members carry no TypeReflections in our schema.
}

export const Property = (n: T.PropertyReflection, v: Visitor): void => Type(n.type, v)

export const Method = (n: T.MethodReflection, v: Visitor): void => n.signatures.forEach((s) => Signature(s, v))

export const IndexSignature = (n: T.IndexSignatureReflection, v: Visitor): void => {
  Parameter(n.parameter, v)
  Type(n.type, v)
}

export const Signature = (n: T.SignatureReflection, v: Visitor): void => {
  n.typeParameters?.forEach((tp) => TypeParameter(tp, v))
  n.parameters.forEach((p) => Parameter(p, v))
  Type(n.type, v)
}

export const Parameter = (n: T.ParameterReflection, v: Visitor): void => Type(n.type, v)

export const TypeParameter = (n: T.TypeParameterReflection, v: Visitor): void => {
  if (n.constraint) Type(n.constraint, v)
  if (n.default) Type(n.default, v)
}

export const ObjectLiteral = (n: T.ObjectLiteralReflection, v: Visitor): void => {
  n.properties.forEach((p) => Property(p, v))
  n.methods?.forEach((m) => Method(m, v))
  n.callSignatures?.forEach((s) => Signature(s, v))
  n.constructSignatures?.forEach((s) => Signature(s, v))
  if (n.indexSignature) IndexSignature(n.indexSignature, v)
}

export const Type = (t: T.TypeReflection, v: Visitor): void => {
  switch (t.kind) {
    case 'reference':
      v.onReference(t)
      t.typeArguments?.forEach((a) => Type(a, v))
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
    case 'query':
      v.onReference(t.queryType)
      return
    case 'reflection':
      return ObjectLiteral(t.declaration, v)
    // intrinsic, literal: nothing to do
  }
}
