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

// ---------------- Top level project ----------------
export interface Project<T extends TypeRegistry = Registry> {
  name: string
  /** Optional top-level package description, e.g. from the package README. */
  comment?: Comment
  /** A project is fundamentally a collection of modules/files. */
  children: T['declarations']['module'][]
}

// ---------------- Shared types ----------------
export interface Base {
  /** Stable identifier used by `reference` types to point back at a declaration. */
  id: number
  /** Doc comment */
  comment?: Comment
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

export interface Module<T extends TypeRegistry = Registry> extends Base {
  kind: 'module'
  path?: string
  name?: string
  children: AnyDeclaration<T>[]
}

export interface ReExport extends Base {
  kind: 're-export'
  sourceModule: string
  as?: string
  named: NamedExport[]
}

export interface NamedExport {
  name: string
  as?: string
}

export interface Variable<T extends TypeRegistry = Registry> extends Base {
  kind: 'variable'
  type: AnyType<T>
  name: string
  defaultValue?: string
}

export interface Func<T extends TypeRegistry = Registry> extends Base {
  kind: 'function'
  name: string
  /** Multiple entries represent overloads; each carries its own comment. */
  signatures: Signature<T>[]
}

export interface Class<T extends TypeRegistry = Registry> extends Base {
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

export interface Interface<T extends TypeRegistry = Registry> extends Base {
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

export interface TypeAlias<T extends TypeRegistry = Registry> extends Base {
  kind: 'type-alias'
  name: string
  typeParameters?: TypeParameter<T>[]
  type: AnyType<T>
}

export interface Enum extends Base {
  kind: 'enum'
  name: string
  const?: boolean
  members: EnumMember[]
}
export interface EnumMember extends Base {
  kind: 'enum-member'
  name: string
  value?: string | number
}

// ---------------- CLASS/INTERFACE MEMBERS ----------------
export interface Property<T extends TypeRegistry = Registry> extends Base {
  kind: 'property'
  name: string
  type: AnyType<T>
  defaultValue?: string
}

export interface Method<T extends TypeRegistry = Registry> extends Base {
  kind: 'method'
  name: string
  signatures: Signature<T>[]
}

export interface IndexSignature<T extends TypeRegistry = Registry> extends Base {
  kind: 'index-signature'
  parameter: Parameter<T>
  type: AnyType<T>
}

// ---------------- SIGNATURES & PARAMETERS ----------------
export interface Signature<T extends TypeRegistry = Registry> extends Base {
  kind: 'signature'
  name?: string
  typeParameters?: TypeParameter<T>[]
  parameters: Parameter<T>[]
  type: AnyType<T>
}

export interface Parameter<T extends TypeRegistry = Registry> extends Base {
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

export interface ObjectLiteral<T extends TypeRegistry = Registry> extends Base {
  kind: 'object-literal'
  properties: Property<T>[]
  methods?: Method<T>[]
  callSignatures?: Signature<T>[]
  constructSignatures?: Signature<T>[]
  indexSignature?: IndexSignature<T>
}

// ---------------- COMMENTS ----------------
export interface Comment {
  /** Flat text of the comment body. Inline links are rendered as their display text. */
  text: string
  /** Structured body — present only when the comment contains inline `{@link …}` references. */
  parts?: CommentPart[]
  tags: CommentTag[]
}

export type CommentPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; target: string; text?: string; style?: 'code' | 'plain' }

/**
 * Tagged comment metadata. Known tags carry whatever structured info JSDoc
 * supplies (types, names, type parameters); unknown tags fall through to a
 * generic shape. Type-bearing fields default to the base registry — augment if
 * you need them resolved against a custom one.
 */
export type CommentTag =
  | { tag: '@param' | '@property'; name: string; type?: AnyType; optional?: boolean; default?: string; text: string }
  | { tag: '@returns' | '@throws'; type?: AnyType; text: string }
  | { tag: '@type' | '@satisfies'; type: AnyType; text: string }
  | { tag: '@template'; typeParameters: TypeParameter[]; text: string }
  | { tag: '@see'; target?: string; text: string }
  | { tag: '@example'; caption?: string; code: string }
  | { tag: '@extends' | '@augments' | '@implements'; class: AnyType; text: string }
  | { tag: '@deprecated' | '@remarks' | '@default' | '@author'; text: string }
  | { tag: string; name?: string; text: string }
