import { is } from '@lickle/is'

import type { t } from '../../_lib/index.ts'

/** A location in the scanned source, with `file` relative to the project root. */
export type Source = { file: string; line: number; column: number }
/** Fields every scanned node carries: its parent declaration id, doc comment and source locations. */
export type Typebase = { parent: number; comment?: Comment; sources: Source[] }
/** {@link Typebase} plus identity — what makes a node a declaration rather than an anonymous part. */
export type Base = Typebase & { id: number; name: string; exported: boolean }

/**
 * Per-kind payloads of a {@link Declaration} — what each kind of statement
 * carries beyond {@link Base}. The rendered union is {@link DeclarationMap}.
 */
export interface DeclarationDefinitions {
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
  export: { names: { name: string; ref: number }[]; star: boolean }
  enum: { const?: boolean; members: Part<'enum-member'>[] }
  namespace: {}
  module: { path: string }
}

/** The two flavours of a `reference` type: `internal` points at a documented declaration by id; `external` classifies everything else. */
export type ReferenceTypeMap = t.MapKind<
  {
    internal: { targetId: number }
    external: { external: 'stdlib' | 'package' | 'anonymous' | 'type-parameter' }
  },
  'type'
>

/**
 * Per-kind payloads of a {@link Type} — one entry for each type-expression
 * shape the scanner emits, from `intrinsic` to `template-literal`. The
 * rendered union is {@link TypeMap}.
 */
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

/**
 * Per-kind payloads of a {@link Part} — the named pieces inside declarations
 * and types: signatures, parameters, properties, methods, enum members. The
 * rendered union is {@link PartMap}.
 */
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

/** Built-in type names rendered as keywords. */
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

/**
 * A documented statement — module, function, class, interface, type alias,
 * variable, enum or namespace. Discriminated on `kind`; narrow with the type
 * argument: `Declaration<'function'>`.
 */
export type Declaration<K extends keyof DeclarationMap = keyof DeclarationMap> = DeclarationMap[K]
/** A type expression as the scanner models it. Discriminated on `kind`; narrow with the type argument: `Type<'union'>`. */
export type Type<K extends keyof TypeMap = keyof TypeMap> = TypeMap[K]
/** A named piece inside a declaration or type — signature, parameter, property, method, …. Narrow with the type argument: `Part<'property'>`. */
export type Part<K extends keyof PartMap = keyof PartMap> = PartMap[K]
/** Any scanned node: {@link Declaration}, {@link Type} or {@link Part}. */
export type Any<K extends keyof KindsMap = keyof KindsMap> = KindsMap[K]

// ---------------- Guards ----------------
// prettier-ignore
const ISD = is.struct({ kind: is.oneOf('variable', 'function', 'class', 'interface', 'type-alias', 'export', 'enum', 'namespace', 'module') }, false)
/** Whether a scanned node is a {@link Declaration}. */
export const isDeclaration = (x: any): x is Declaration => ISD(x)

// prettier-ignore
const IST = is.struct({ kind: is.oneOf('intrinsic', 'literal', 'reference', 'union', 'intersection', 'array', 'tuple', 'function-type', 'type-operator', 'record', 'conditional', 'infer', 'indexed-access', 'mapped', 'query', 'template-literal', 'predicate', 'import-type') }, false)
/** Whether a scanned node is a {@link Type}. */
export const isType = (x: any): x is Type => IST(x)

// prettier-ignore
const ISP = is.struct({ kind: is.oneOf('signature', 'parameter', 'generic', 'property', 'method', 'index-signature', 'enum-member', 'tuple-element') }, false)
/** Whether a scanned node is a {@link Part}. */
export const isPart = (x: any): x is Part => ISP(x)

// prettier-ignore
const ISK = is.or(ISD, IST, ISP)
/** Whether a value is any scanned node — declaration, type or part. */
export const isKind = (x: any): x is Any => ISK(x)

// ---------------- Remapped with kind and base ----------------
/** {@link DeclarationDefinitions} with `kind` discriminants and {@link Base} merged in — the concrete declaration shapes. */
export type DeclarationMap = t.MapKind<DeclarationDefinitions, 'kind', Base>
/** {@link TypeDefinitions} with `kind` discriminants and {@link Typebase} merged in — the concrete type shapes. */
export type TypeMap = t.MapKind<TypeDefinitions, 'kind', Typebase>
/** {@link TypeComponentDefinitions} with `kind` discriminants and {@link Typebase} merged in — the concrete part shapes. */
export type PartMap = t.MapKind<TypeComponentDefinitions, 'kind', Typebase>
/** Every scanned node shape, keyed by `kind`. */
export type KindsMap = DeclarationMap & TypeMap & PartMap

// ---------------- COMMENTS ----------------
/** A piece of a comment's summary: markdown `text`, or an inline `{@link target}` reference. */
export type CommentPart = t.MapKindUnion<
  {
    text: { text: string }
    link: { target: string; text?: string; style?: 'code' | 'plain' }
  },
  'kind'
>

/**
 * Payloads of the block tags the scanner parses structurally. Tags outside
 * this set are preserved as the catch-all `'*'` entry of
 * {@link CommentTagMap}: name, optional caption and raw markdown body.
 */
export interface CommentTagDefinitions {
  '@param': { name: string; type?: Type; optional?: boolean; default?: string; text: string }
  '@property': { name: string; type?: NoInfer<Type>; optional?: boolean; default?: string; text: string }
  '@returns': { type?: Type; text: string }
  '@throws': { type?: Type; text: string }
  '@type': { type: Type; text: string }
  '@satisfies': { type: Type; text: string }
  '@template': { generics: Part<'generic'>[]; text: string }
  '@see': { target?: string; text: string }
  '@example': { caption?: string; lang?: string; code: string; text?: string }
  '@augments': { class: Type; text: string }
  '@implements': { class: Type; text: string }
}

/** A parsed JSDoc block: the summary as {@link CommentPart}s, plus its block tags. */
export interface Comment {
  parts: CommentPart[]
  /** Block tags. Omitted when empty so the common case stays small. */
  tags?: CommentTag[]
}

/** Concrete tag shapes keyed by tag name: {@link CommentTagDefinitions} plus the `'*'` catch-all for custom tags. */
export type CommentTagMap = t.Compute<
  { [K in keyof CommentTagDefinitions]: t.Compute<CommentTagDefinitions[K] & { tag: K; kind: K }> } & {
    '*': { tag: string; kind: '*'; name?: string; caption?: string; text: string }
  }
>
/** A block tag of a comment. Discriminated on `tag`; narrow with the type argument: `CommentTag<'@example'>`. */
export type CommentTag<K extends keyof CommentTagMap = keyof CommentTagMap> = CommentTagMap[K]

// ---------------- Utilities ----------------
