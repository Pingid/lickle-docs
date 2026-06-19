import { is } from '@lickle/is'

import type { t } from '../../_lib/index.ts'

export type Id = t.Brand<'reflect-id', number>

/** A location in the scanned source, with `file` relative to the project root. */
export interface Source {
  file: string
  line: number
  column: number
}

/**
 * Fields every scanned node carries: its parent declaration id, doc comment and source locations.
 */
export interface NodeBase {
  parent: Id
  comment?: Comment
  sources: Source[]
}

/**
 * {@link NodeBase} plus identity — what makes a node a declaration rather than an anonymous part.
 */
export interface DeclarationBase extends NodeBase {
  id: Id
  name: string
  exported: boolean
}

// ---------------- DECLARATIONS ----------------
export interface Module extends DeclarationBase {
  kind: 'module'
  path: string
}

export interface Variable extends DeclarationBase {
  kind: 'variable'
  type: Type
  defaultValue?: string
}

export interface Function extends DeclarationBase {
  kind: 'function'
  signatures: Part<'signature'>[]
}

export interface Class extends DeclarationBase {
  kind: 'class'
  generics?: Part<'generic'>[]
  extends?: Type[]
  implements?: Type[]
  members: Member[]
}

export interface Interface extends DeclarationBase {
  kind: 'interface'
  generics?: Part<'generic'>[]
  extends?: Type[]
  members: Member[]
}

export interface TypeAlias extends DeclarationBase {
  kind: 'type-alias'
  generics?: Part<'generic'>[]
  type: Type
}

export interface Export extends DeclarationBase {
  kind: 'export'
  names: { name: string; ref: Id; type: boolean }[]
  star: boolean
}

export interface Enum extends DeclarationBase {
  kind: 'enum'
  const?: boolean
  members: Part<'enum-member'>[]
}

export interface Namespace extends DeclarationBase {
  kind: 'namespace'
}

export interface DeclarationMap {
  module: Module
  variable: Variable
  function: Function
  class: Class
  interface: Interface
  'type-alias': TypeAlias
  export: Export
  enum: Enum
  namespace: Namespace
}

/**
 * A documented statement — module, function, class, interface, type alias,
 * variable, enum or namespace. Discriminated on `kind`; narrow with the type
 * argument: `Declaration<'function'>`.
 */
export type Declaration<K extends keyof DeclarationMap = keyof DeclarationMap> = DeclarationMap[K]

// ---------------- TYPES ----------------
export interface TypeIntrinsic {
  kind: 'intrinsic'
  name: IntrinsicName
}

export interface TypeLiteral {
  kind: 'literal'
  value: string | number | boolean | bigint | null
}

export interface TypeReference {
  kind: 'reference'
  id: Id
  name: string
  owner: Id
  target: TypeReferenceTarget
  args?: Type[]
}

export type TypeReferenceTarget =
  | { type: 'internal'; id: Id }
  | { type: 'external'; external: 'stdlib' | 'package' | 'anonymous' | 'type-parameter' }

export interface TypeUnion {
  kind: 'union'
  types: Type[]
}

export interface TypeIntersection {
  kind: 'intersection'
  types: Type[]
}

export interface TypeArray {
  kind: 'array'
  elementType: Type
}

export interface TypeTuple {
  kind: 'tuple'
  elements: Part<'tuple-element'>[]
}

export interface TypeFunctionType {
  kind: 'function-type'
  signatures: Part<'signature'>[]
}

export interface TypeTypeOperator {
  kind: 'type-operator'
  operator: 'keyof' | 'readonly' | 'unique'
  target: Type
}

export interface TypeRecord {
  kind: 'record'
  members: Member[]
}

export interface TypeConditional {
  kind: 'conditional'
  check: Type
  extends: Type
  true: Type
  false: Type
}

export interface TypeInfer {
  kind: 'infer'
  name: string
  constraint?: Type
}

export interface TypeIndexedAccess {
  kind: 'indexed-access'
  object: Type
  index: Type
}

export interface TypeMapped {
  kind: 'mapped'
  typeParameter: Part<'generic'>
  nameType?: Type
  type?: Type
  optional?: boolean
  readonly?: boolean
}

export interface TypeQuery {
  kind: 'query'
  name: string
  args?: Type[]
}

export interface TypeTemplateLiteral {
  kind: 'template-literal'
  head: string
  spans: { type: Type; literal: string }[]
}

export interface TypePredicate {
  kind: 'predicate'
  parameter: string
  asserts?: boolean
  type?: Type
}

export interface TypeImportType {
  kind: 'import-type'
  argument: string
  qualifier?: string
  isTypeOf?: boolean
  args?: Type[]
}

export interface TypeUnknown {
  kind: 'unknown'
  text: string
  nodeType: string
}

export interface TypeMap {
  intrinsic: TypeIntrinsic
  literal: TypeLiteral
  reference: TypeReference
  union: TypeUnion
  intersection: TypeIntersection
  array: TypeArray
  tuple: TypeTuple
  'function-type': TypeFunctionType
  'type-operator': TypeTypeOperator
  record: TypeRecord
  conditional: TypeConditional
  infer: TypeInfer
  'indexed-access': TypeIndexedAccess
  mapped: TypeMapped
  query: TypeQuery
  'template-literal': TypeTemplateLiteral
  predicate: TypePredicate
  'import-type': TypeImportType
  unknown: TypeUnknown
}

/** A type expression as the scanner models it. Discriminated on `kind`; narrow with the type argument: `Type<'union'>`. */
export type Type<K extends keyof TypeMap = keyof TypeMap> = TypeMap[K]

/**
 * Per-kind payloads of a {@link Part} — the named pieces inside declarations
 * and types: signatures, parameters, properties, methods, enum members. The
 * rendered union is {@link PartMap}.
 * @internal
 */
export type TypeComponentDefinitions = {
  signature: { generics?: Part<'generic'>[]; params: Part<'parameter'>[]; return: Type; construct?: boolean }
  parameter: { name: string; type: Type; rest?: boolean; default?: string; optional: boolean }
  generic: { name: string; constraint?: Type; default?: Type }
  property: { name: string; type: Type; defaultValue?: string; optional?: boolean }
  method: { name: string; signatures: Part<'signature'>[] }
  'index-signature': { parameter: Part<'parameter'>; type: Type }
  'enum-member': { name: string; value?: string | number }
  'tuple-element': { name?: string; type: Type; optional?: boolean; rest?: boolean }
}

/**
 * Built-in type names rendered as keywords.
 * @internal
 */
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

/** A named piece inside a declaration or type — signature, parameter, property, method, …. Narrow with the type argument: `Part<'property'>`. */
export type Part<K extends keyof PartMap = keyof PartMap> = PartMap[K]
/** A member of a class, interface or inline object type. */
export type Member = Part<'property' | 'method' | 'signature' | 'index-signature'>
/** Any scanned node: {@link Declaration}, {@link Type} or {@link Part}. */
export type Any<K extends keyof KindsMap = keyof KindsMap> = KindsMap[K]

// ---------------- Remapped with kind and base ----------------
/**
 * {@link TypeComponentDefinitions} with `kind` discriminants and {@link NodeBase} merged in — the concrete part shapes.
 * @internal
 */
export type PartMap = t.MapKind<TypeComponentDefinitions, 'kind', NodeBase>
/**
 * Every scanned node shape, keyed by `kind`.
 * @internal
 */
export type KindsMap = DeclarationMap & TypeMap & PartMap

// ---------------- COMMENTS ----------------

/**
 * Payloads of the block tags the scanner parses structurally. Tags outside
 * this set are preserved as the catch-all `'*'` entry of
 * {@link CommentTagMap}: name, optional caption and raw markdown body.
 * @internal
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

/** Concrete tag shapes keyed by tag name: {@link CommentTagDefinitions} plus the `'*'` catch-all for custom tags. */
export type CommentTagMap = t.Compute<
  { [K in keyof CommentTagDefinitions]: t.Compute<CommentTagDefinitions[K] & { tag: K; kind: K }> } & {
    '*': { tag: string; kind: '*'; name?: string; caption?: string; text: string }
  }
>
/** A block tag of a comment. Discriminated on `tag`; narrow with the type argument: `CommentTag<'@example'>`. */
export type CommentTag<K extends keyof CommentTagMap = keyof CommentTagMap> = CommentTagMap[K]

/** A piece of a comment's summary: markdown `text`, or an inline `{@link target}` reference. */
export type CommentPart = t.MapKindUnion<
  {
    text: { text: string }
    link: { target: string; text?: string; style?: 'code' | 'plain' }
  },
  'kind'
>

/** A parsed JSDoc block: the summary as {@link CommentPart}s, plus its block tags. */
export interface Comment {
  parts: CommentPart[]
  /** Block tags. Omitted when empty so the common case stays small. */
  tags?: CommentTag[]
}

// ---------------- Guards ----------------
// prettier-ignore
const ISD = is.struct({ kind: is.oneOf('variable', 'function', 'class', 'interface', 'type-alias', 'export', 'enum', 'namespace', 'module') }, false)
/**
 * Whether a scanned node is a {@link Declaration}.
 * @internal
 */
export const isDeclaration = (x: any): x is Declaration => ISD(x)

// prettier-ignore
const IST = is.struct({ kind: is.oneOf('intrinsic', 'literal', 'reference', 'union', 'intersection', 'array', 'tuple', 'function-type', 'type-operator', 'record', 'conditional', 'infer', 'indexed-access', 'mapped', 'query', 'template-literal', 'predicate', 'import-type') }, false)
/**
 * Whether a scanned node is a {@link Type}.
 * @internal
 */
export const isType = (x: any): x is Type => IST(x)

// prettier-ignore
const ISP = is.struct({ kind: is.oneOf('signature', 'parameter', 'generic', 'property', 'method', 'index-signature', 'enum-member', 'tuple-element') }, false)
/**
 * Whether a scanned node is a {@link Part}.
 * @internal
 */
export const isPart = (x: any): x is Part => ISP(x)

// prettier-ignore
const ISK = is.or(ISD, IST, ISP)
/**
 * Whether a value is any scanned node — declaration, type or part.
 * @internal
 */
export const isKind = (x: any): x is Any => ISK(x)

export const match = <K extends keyof KindsMap>(kind: K, x: unknown): x is KindsMap[K] => isKind(x) && x.kind === kind
