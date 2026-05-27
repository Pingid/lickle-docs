// ---------------- Pass through for customizing the type registry ----------------
export interface TypeRegistry {
  declarations: Record<string, any>
  types: Record<string, any>
}
export type AnyDeclaration<T extends TypeRegistry = Registry> = T['declarations'][keyof T['declarations']]
export type AnyType<T extends TypeRegistry = Registry> = T['types'][keyof T['types']]

// ---------------- Default registry ----------------
export interface Registry extends TypeRegistry {
  declarations: DeclarationMap<Registry>
  types: TypeMap<Registry>
}

export interface DeclarationMap<T extends TypeRegistry> {
  module: Module<T>
  variable: Variable<T>
  function: Func<T>
  class: Class<T>
  interface: Interface<T>
  'type-alias': TypeAlias<T>
  enum: Enum
  're-export': ReExport
}

export type TypeMap<T extends TypeRegistry> = {
  intrinsic: IntrinsicType
  literal: LiteralType
  reference: ReferenceType<T>
  unresolved: UnresolvedType<T>
  union: UnionType<T>
  intersection: IntersectionType<T>
  array: ArrayType<T>
  tuple: TupleType<T>
  function: FunctionType<T>
  typeoperator: TypeOperatorType<T>
  query: QueryType<T>
  reflection: ReflectionType<T>
}

// ---------------- Shared types ----------------
export interface Base<T extends TypeRegistry = Registry> {
  /** Stable identifier used by `reference` types to point back at a declaration. */
  id: number
  /** Doc comment */
  comment?: Comment<T>
  /** All source locations contributing to this reflection. */
  sources?: Source[]
  /** Modifiers that may apply to many reflection kinds. */
  flags?: Flags
}

export interface Source {
  file: string
  line: number
  column: number
}

export interface Flags {
  readonly?: boolean
  static?: boolean
  abstract?: boolean
  async?: boolean
  optional?: boolean
  visibility?: 'public' | 'protected' | 'private'
}

// ---------------- declarations ----------------
export interface Module<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'module'
  path?: string
  name?: string
  children: AnyDeclaration<T>[]
}

export interface ReExport<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 're-export'
  sourceModule: string
  as?: string
  named: NamedExport[]
}

export interface NamedExport {
  name: string
  as?: string
}

export interface Variable<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'variable'
  type: AnyType<T>
  name: string
  defaultValue?: string
}

export interface Func<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'function'
  name: string
  /** Multiple entries represent overloads; each carries its own comment. */
  signatures: Signature<T>[]
}

export interface Class<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'class'
  name: string
  typeParameters?: TypeParameter<T>[]
  extends?: AnyType<T>
  implements?: AnyType<T>[]
  constructors: Signature<T>[]
  properties: Property<T>[]
  methods: Method<T>[]
  indexSignature?: IndexSignature<T>
}

export interface Interface<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'interface'
  name: string
  typeParameters?: TypeParameter<T>[]
  extends?: AnyType<T>[]
  properties: Property<T>[]
  methods: Method<T>[]
  callSignatures?: Signature<T>[]
  constructSignatures?: Signature<T>[]
  indexSignature?: IndexSignature<T>
}

export interface TypeAlias<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'type-alias'
  name: string
  typeParameters?: TypeParameter<T>[]
  type: AnyType<T>
}

export interface Enum<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'enum'
  name: string
  const?: boolean
  members: EnumMember[]
}
export interface EnumMember<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'enum-member'
  name: string
  value?: string | number
}

// ---------------- CLASS/INTERFACE MEMBERS ----------------
export interface Property<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'property'
  name: string
  type: AnyType<T>
  defaultValue?: string
}

export interface Method<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'method'
  name: string
  signatures: Signature<T>[]
}

export interface IndexSignature<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'index-signature'
  parameter: Parameter<T>
  type: AnyType<T>
}

// ---------------- SIGNATURES & PARAMETERS ----------------
export interface Signature<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'signature'
  name?: string
  typeParameters?: TypeParameter<T>[]
  parameters: Parameter<T>[]
  type: AnyType<T>
}

export interface Parameter<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'parameter'
  name: string
  type: AnyType<T>
  rest?: boolean
  default?: string
  optional: boolean
}

export interface TypeParameter<T extends TypeRegistry = Registry> {
  name: string
  /** `T extends Foo` */
  constraint?: AnyType<T>
  /** `T = string` */
  default?: AnyType<T>
}

// ---------------- TYPES ----------------
export interface IntrinsicType {
  kind: 'intrinsic'
  name:
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
}

export interface LiteralType {
  kind: 'literal'
  value: string | number | boolean | bigint | null
}

export interface ReferenceType<T extends TypeRegistry = Registry> {
  kind: 'reference'
  id: number
  name: string
  typeArguments?: AnyType<T>[]
}

/**
 * A type the resolver cannot link to a project declaration — typically an
 * inferred or anonymous type whose symbol has no source location we crawled
 * (e.g. lib.d.ts internals, intrinsic conditional results). Kept as a
 * name-only marker so consumers don't mistake it for a resolvable reference.
 */
export interface UnresolvedType<T extends TypeRegistry = Registry> {
  kind: 'unresolved'
  name: string
  typeArguments?: AnyType<T>[]
}

export interface UnionType<T extends TypeRegistry = Registry> {
  kind: 'union'
  types: AnyType<T>[]
}

export interface IntersectionType<T extends TypeRegistry = Registry> {
  kind: 'intersection'
  types: AnyType<T>[]
}

export interface ArrayType<T extends TypeRegistry = Registry> {
  kind: 'array'
  elementType: AnyType<T>
}

export interface TupleType<T extends TypeRegistry = Registry> {
  kind: 'tuple'
  elements: TupleElement<T>[]
}

export interface TupleElement<T extends TypeRegistry = Registry> {
  type: AnyType<T>
  name?: string
  optional?: boolean
  rest?: boolean
}

export interface FunctionType<T extends TypeRegistry = Registry> {
  kind: 'function-type'
  signatures: Signature<T>[]
}

export interface TypeOperatorType<T extends TypeRegistry = Registry> {
  kind: 'type-operator'
  operator: 'keyof' | 'readonly' | 'unique'
  target: AnyType<T>
}

export interface QueryType<T extends TypeRegistry = Registry> {
  kind: 'query'
  queryType: ReferenceType<T>
}

export interface ReflectionType<T extends TypeRegistry = Registry> {
  kind: 'reflection'
  declaration: ObjectLiteral<T>
}

export interface ObjectLiteral<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'object-literal'
  properties: Property<T>[]
  methods?: Method<T>[]
  callSignatures?: Signature<T>[]
  constructSignatures?: Signature<T>[]
  indexSignature?: IndexSignature<T>
}

// ---------------- COMMENTS ----------------
export interface Comment<T extends TypeRegistry = Registry> {
  /** Flat text of the comment body. Inline links are rendered as their display text. */
  text: string
  /** Structured body — present only when the comment contains inline `{@link …}` references. */
  parts?: CommentPart[]
  tags: CommentTag<T>[]
}

export type CommentPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; target: string; text?: string; style?: 'code' | 'plain' }

export type CommentTag<T extends TypeRegistry = Registry> =
  | CommentTagMap<T>[keyof CommentTagMap<T>]
  | { tag: string; name?: string; text: string }

export interface CommentTagMap<T extends TypeRegistry = Registry> {
  '@param': { tag: '@param'; name: string; type?: AnyType<T>; optional?: boolean; default?: string; text: string }
  '@property': { tag: '@property'; name: string; type?: AnyType<T>; optional?: boolean; default?: string; text: string }
  '@returns': { tag: '@returns'; type?: AnyType<T>; text: string }
  '@throws': { tag: '@throws'; type?: AnyType<T>; text: string }
  '@type': { tag: '@type'; type: AnyType<T>; text: string }
  '@satisfies': { tag: '@satisfies'; type: AnyType<T>; text: string }
  '@template': { tag: '@template'; typeParameters: TypeParameter<T>[]; text: string }
  '@see': { tag: '@see'; target?: string; text: string }
  '@example': { tag: '@example'; caption?: string; code: string }
}
