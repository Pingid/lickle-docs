import { is } from '@lickle/is'

import type { t } from '../../_lib/index.ts'

export type Source = { module: number; line: number; column: number }
export type Typebase = { id: number; parent: number }

export type Module = {
  id: number
  path: string
  declarations: number[]
}

export interface DeclerationDefinitions {
  variable: { name: string; type: Type; defaultValue?: string }
  function: { name: string; signatures: Part<'signature'>[] }
  class: {
    name: string
    generics?: Part<'generic'>[]
    extends?: Type[]
    implements?: Type[]
    constructors: Part<'signature'>[]
    properties: Part<'property'>[]
    methods: Part<'method'>[]
    indexSignature?: Part<'index-signature'>
  }
  interface: {
    name: string
    generics?: Part<'generic'>[]
    extends?: Type[]
    properties: Part<'property'>[]
    methods: Part<'method'>[]
    callSignatures?: Part<'signature'>[]
    constructSignatures?: Part<'signature'>[]
    indexSignature?: Part<'index-signature'>
  }
  'type-alias': { name: string; generics?: Part<'generic'>[]; type: Type }
  export: { name?: string; names: { name: string; ref: number }[]; star: boolean }
  enum: { name: string; const?: boolean; members: Part<'enum-member'>[] }
  namespace: { name: string }
}

export type ReferenceTypeMap = t.MapKind<
  {
    internal: { targetId: number }
    external: { external: 'stdlib' | 'package' | 'anonymous' | 'type-parameter' }
  },
  'type'
>

export interface TypeDefinitions {
  intrinsic: { name: IntrinsicName }
  literal: { value: string | number | boolean | bigint | null }
  reference: { id: number; name: string; owner: number; args?: Type[] } & ReferenceTypeMap[keyof ReferenceTypeMap]
  union: { types: Type[] }
  intersection: { types: Type[] }
  array: { elementType: Type }
  tuple: { elements: Part<'tuple-element'>[] }
  'function-type': { signatures: Part<'signature'>[] }
  'type-operator': { operator: 'keyof' | 'readonly' | 'unique'; target: Type }
  /** Inline object type, e.g. `{ x: number; f(): void }`. */
  record: {
    properties: Part<'property'>[]
    methods: Part<'method'>[]
    callSignatures?: Part<'signature'>[]
    constructSignatures?: Part<'signature'>[]
    indexSignature?: Part<'index-signature'>
  }
  conditional: { check: Type; extends: Type; true: Type; false: Type }
  infer: { name: string; constraint?: Type }
  'indexed-access': { object: Type; index: Type }
  mapped: { typeParameter: Part<'generic'>; nameType?: Type; type?: Type; optional?: boolean; readonly?: boolean }
  query: { name: string; args?: Type[] }
  'template-literal': { head: string; spans: { type: Type; literal: string }[] }
  predicate: { parameter: string; asserts?: boolean; type?: Type }
  'import-type': { argument: string; qualifier?: string; isTypeOf?: boolean; args?: Type[] }
  unknown: { text: string; nodeType: string }
}

export interface TypeComponentDefinitions {
  signature: { generics?: Part<'generic'>[]; params: Part<'parameter'>[]; return: Type }
  parameter: { name: string; type: Type; rest?: boolean; default?: string; optional: boolean }
  generic: { name: string; constraint?: Type; default?: Type }
  property: { name: string; type: Type; defaultValue?: string; optional?: boolean }
  method: { name: string; signatures: Part<'signature'>[] }
  'index-signature': { parameter: Part<'parameter'>; type: Type }
  'enum-member': { name: string; value?: string | number }
  'tuple-element': { name?: string; type: Type; optional?: boolean; rest?: boolean }
}

export type IntrinsicName =
  | 'string'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'symbol'
  | 'void'
  | 'undefined'
  | 'null'
  | 'never'
  | 'any'
  | 'unknown'
  | 'object'
  | 'this'

// export type Reference = TypeMap['reference']

export type Declaration<K extends keyof DeclarationMap = keyof DeclarationMap> = DeclarationMap[K]
export type Type<K extends keyof TypeMap = keyof TypeMap> = TypeMap[K]
export type Part<K extends keyof PartMap = keyof PartMap> = PartMap[K]
export type Any<K extends keyof KindsMap = keyof KindsMap> = KindsMap[K]

// ---------------- Guards ----------------
// prettier-ignore
const ISD = is.struct({ kind: is.oneOf('variable', 'function', 'class', 'interface', 'type-alias', 'export', 'enum', 'namespace', 'module') }, false)
export const isDeclaration = (x: any): x is Declaration => ISD(x)

// prettier-ignore
const IST = is.struct({ kind: is.oneOf('intrinsic', 'literal', 'reference', 'union', 'intersection', 'array', 'tuple', 'function-type', 'type-operator', 'record', 'conditional', 'infer', 'indexed-access', 'mapped', 'query', 'template-literal', 'predicate', 'import-type') }, false)
export const isType = (x: any): x is Type => IST(x)

// prettier-ignore
const ISP = is.struct({ kind: is.oneOf('signature', 'parameter', 'generic', 'property', 'method', 'index-signature', 'enum-member', 'tuple-element') }, false)
export const isPart = (x: any): x is Part => ISP(x)

// prettier-ignore
const ISK = is.or(ISD, IST, ISP)
export const isKind = (x: any): x is Any => ISK(x)

// ---------------- Remapped with kind and base ----------------
export type DeclarationMap = t.MapKind<DeclerationDefinitions, 'kind', Typebase>
export type TypeMap = t.MapKind<TypeDefinitions, 'kind', Typebase>
export type PartMap = t.MapKind<TypeComponentDefinitions, 'kind', Typebase>
export type KindsMap = DeclarationMap & TypeMap & PartMap

// ---------------- COMMENTS ----------------
export type CommentPart = t.MapKindUnion<
  {
    text: { text: string }
    link: { target: string; text?: string; style?: 'code' | 'plain' }
  },
  'kind'
>

export interface CommentTagDefinitions {
  '@param': { name: string; type?: Type; optional?: boolean; default?: string; text: string }
  '@property': { name: string; type?: NoInfer<Type>; optional?: boolean; default?: string; text: string }
  '@returns': { type?: Type; text: string }
  '@throws': { type?: Type; text: string }
  '@type': { type: Type; text: string }
  '@satisfies': { type: Type; text: string }
  '@template': { generics: Part<'generic'>[]; text: string }
  '@see': { target?: string; text: string }
  '@example': { caption?: string; code: string; text?: string }
  '@augments': { class: Type; text: string }
  '@implements': { class: Type; text: string }
}

export interface Comment {
  parts: CommentPart[]
  /** Block tags. Omitted when empty so the common case stays small. */
  tags?: CommentTag[]
}

export type CommentTagMap = t.MapKind<CommentTagDefinitions, 'tag'>
export type CommentTag<K extends keyof CommentTagMap = keyof CommentTagMap> =
  | CommentTagMap[K]
  | { tag: string; name?: string; text: string }

// ---------------- Utilities ----------------
