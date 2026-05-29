export type Source = { file: string; line: number; column: number }
export type Base = { id: number; name: string; parent: number; sources: Source[]; comment?: Comment }
export type DeclarationBase = Base & { exported: boolean }

export interface DeclerationDefinitions {
  variable: { type: Type; defaultValue?: string }
  function: { signatures: Part<'signature'>[] }
  class: {
    generics?: Part<'generic'>[]
    extends?: Type[]
    implements?: Type[]
    constructors: Part<'signature'>[]
    properties: Part<'property'>[]
    methods: Part<'method'>[]
    indexSignature?: Part<'index-signature'>
  }
  interface: {
    generics?: Part<'generic'>[]
    extends?: Type[]
    properties: Part<'property'>[]
    methods: Part<'method'>[]
    callSignatures?: Part<'signature'>[]
    constructSignatures?: Part<'signature'>[]
    indexSignature?: Part<'index-signature'>
  }
  'type-alias': { generics?: Part<'generic'>[]; type: Type }
  export: { name: string; ref: number; star: boolean }
  enum: { const?: boolean; members: Part<'enum-member'>[] }
  namespace: {}
  module: { path: string }
}

export interface TypeDefinitions {
  intrinsic: { name: IntrinsicName }
  literal: { value: string | number | boolean | bigint | null }
  reference: { typeArguments?: Type[]; external?: 'stdlib' | 'package' | 'anonymous' }
  union: { types: Type[] }
  intersection: { types: Type[] }
  array: { elementType: Type }
  tuple: { elements: Part<'tuple-element'>[] }
  'function-type': { signatures: Part<'signature'>[] }
  'type-operator': { operator: 'keyof' | 'readonly' | 'unique'; target: Type }
}

export interface TypeComponentDefinitions {
  signature: { generics?: Part<'generic'>[]; params: Part<'parameter'>[]; return: Type }
  parameter: { type: Type; rest?: boolean; default?: string; optional: boolean }
  generic: { constraint?: Type; default?: Type }
  property: { type: Type; defaultValue?: string; optional?: boolean }
  method: { signatures: Part<'signature'>[] }
  'index-signature': { parameter: Part<'parameter'>; type: Type }
  'enum-member': { value?: string | number }
  'tuple-element': { type: Type; optional?: boolean; rest?: boolean }
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

export type Declaration<K extends keyof DeclarationMap = keyof DeclarationMap> = DeclarationMap[K]
export type Type<K extends keyof TypeMap = keyof TypeMap> = TypeMap[K]
export type Part<K extends keyof PartMap = keyof PartMap> = PartMap[K]
export type Any<K extends keyof KindsMap = keyof KindsMap> = KindsMap[K]

// ---------------- Remapped with kind and base ----------------
export type DeclarationMap = WithKind<DeclerationDefinitions, DeclarationBase>
export type TypeMap = WithKind<TypeDefinitions, Base>
export type PartMap = WithKind<TypeComponentDefinitions, Base>
export type KindsMap = DeclarationMap & TypeMap & PartMap

// ---------------- COMMENTS ----------------
export type CommentPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; target: string; text?: string; style?: 'code' | 'plain' }

interface CommentTagDefinitions {
  '@param': { name: string; type?: Type; optional?: boolean; default?: string; text: string }
  '@property': { name: string; type?: Type; optional?: boolean; default?: string; text: string }
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

export type CommentTagMap = { [K in keyof CommentTagDefinitions]: Compute<CommentTagDefinitions[K] & { tag: K }> }
export type CommentTag<K extends keyof CommentTagMap = keyof CommentTagMap> =
  | CommentTagMap[K]
  | { tag: string; name?: string; text: string }

// ---------------- Utilities ----------------
type WithKind<T extends Record<string, any>, E extends Record<string, any>> = {
  [K in keyof T]: Compute<T[K] & E & { kind: K }>
}
type Compute<T> = { [K in keyof T]: T[K] } & {}
