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
  enum: Enum<T>
  namespace: Namespace<T>
  exports: Exports<T>
}

export type TypeMap<T extends TypeRegistry> = {
  intrinsic: IntrinsicType
  literal: LiteralType
  reference: ReferenceType<T>
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
}

export interface Source {
  file: string
  line: number
  column: number
}

/**
 * Stamped onto every routable declaration during the JSON build pass. Lets
 * the client treat slugs, qualified names, and display names as data instead
 * of recomputing them at render time.
 */
export interface Routable {
  /** Stable, collision-free URL slug. */
  slug: string
  /** Dotted qualified name, e.g. `models.User`, `foo.Inner.Bar`. */
  qualifiedName: string
  /** Friendly display name — `User` even when the source name is `index`. */
  displayName: string
}

// ---------------- declarations ----------------
export interface Module<T extends TypeRegistry = Registry> extends Base<T>, Routable {
  kind: 'module'
  path?: string
  name?: string
  /** Source-order ids of the publicly exposed children — direct `export` decls plus emitted `Exports` / `Namespace` clauses. */
  children: number[]
}

/**
 * TS `export namespace foo { ... }` block. Owns its members directly — every
 * id in `children` is declared inside the block. `export * as foo from '…'`
 * does NOT use this kind; it produces an `Exports` clause whose single
 * entry points at the source module.
 */
export interface Namespace<T extends TypeRegistry = Registry> extends Base<T>, Routable {
  kind: 'namespace'
  name: string
  children: number[]
}

/**
 * Every `export …` clause — named, star, namespace re-export, or local. The
 * shape is uniform: `names` lists each exposed name paired with the id of
 * the underlying declaration. The id can point at any declaration in the
 * flat list, including a `Module` (this is how `export * as foo from './x'`
 * is represented: a single entry whose id is the './x' module).
 */
export interface Exports<T extends TypeRegistry = Registry> extends Base<T> {
  kind: 'exports'
  names: { name: string; id: number }[]
}

export interface Variable<T extends TypeRegistry = Registry> extends Base<T>, Routable {
  kind: 'variable'
  type: AnyType<T>
  name: string
  defaultValue?: string
}

export interface Func<T extends TypeRegistry = Registry> extends Base<T>, Routable {
  kind: 'function'
  name: string
  /** Multiple entries represent overloads; each carries its own comment. */
  signatures: Signature<T>[]
}

export interface Class<T extends TypeRegistry = Registry> extends Base<T>, Routable {
  kind: 'class'
  name: string
  typeParameters?: TypeParameter<T>[]
  /** Class can extend at most one base, but the array shape matches `Interface`. */
  extends?: AnyType<T>[]
  implements?: AnyType<T>[]
  constructors: Signature<T>[]
  properties: Property<T>[]
  methods: Method<T>[]
  indexSignature?: IndexSignature<T>
}

export interface Interface<T extends TypeRegistry = Registry> extends Base<T>, Routable {
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

export interface TypeAlias<T extends TypeRegistry = Registry> extends Base<T>, Routable {
  kind: 'type-alias'
  name: string
  typeParameters?: TypeParameter<T>[]
  type: AnyType<T>
}

export interface Enum<T extends TypeRegistry = Registry> extends Base<T>, Routable {
  kind: 'enum'
  name: string
  const?: boolean
  members: EnumMember<T>[]
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
  optional?: boolean
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

/**
 * A type referring to another declaration by id. When the target lives in the
 * project, the resolver populates an `id` that points at it. When the target
 * is outside the project, `external` classifies the source so the renderer
 * can style it (greyed out, no link, etc.).
 */
export interface ReferenceType<T extends TypeRegistry = Registry> {
  kind: 'reference'
  id: number
  name: string
  typeArguments?: AnyType<T>[]
  /**
   * Set when this reference cannot resolve to an in-project declaration.
   *   - `stdlib`: lib.d.ts (e.g. `Array`, `Promise`)
   *   - `package`: an installed dependency (`node_modules`)
   *   - `anonymous`: an inferred or otherwise unlocatable symbol
   */
  external?: 'stdlib' | 'package' | 'anonymous'
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
/**
 * Doc comments are always emitted in structured form. The renderer flattens
 * `parts` into markdown when needed, resolving `{@link …}` targets through
 * the project's slug index.
 */
export interface Comment<T extends TypeRegistry = Registry> {
  parts: CommentPart[]
  /** Block tags. Omitted when empty so the common case stays small. */
  tags?: CommentTag<T>[]
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
  '@example': { tag: '@example'; caption?: string; code: string; text?: string }
  '@augments': { tag: '@augments'; class: AnyType<T>; text: string }
  '@implements': { tag: '@implements'; class: AnyType<T>; text: string }
}
