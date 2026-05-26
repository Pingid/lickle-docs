export type Mode = 'lazy' | 'json' | 'resolved'

// targetId
export type Collections<T> = { lazy: Iterable<T>; json: T[]; resolved: T[] }

export type Collection<T, M extends Mode> = Collections<T>[M]

export interface ProjectReflection<M extends Mode> {
  name: string
  /** Optional top-level package description, e.g. from the package README. */
  comment?: Comment<M>
  /** A project is fundamentally a collection of modules/files. */
  children: Collection<ModuleReflection<M>, M>
}

export interface BaseReflection<M extends Mode> {
  /** Stable identifier used by `reference` types to point back at a declaration. */
  id: number
  name: string
  comment?: Comment<M>
  /** All source locations contributing to this reflection. Multiple when declarations merge (e.g. interface + namespace, function overloads). */
  sources?: Collection<SourceLocation, M>
  /** Modifiers that may apply to many reflection kinds. Empty/absent when none apply. */
  flags?: ReflectionFlags
}

export interface SourceLocation {
  file: string
  line: number
  column: number
}

export interface ReflectionFlags {
  isReadonly?: boolean
  isStatic?: boolean
  isAbstract?: boolean
  isAsync?: boolean
  isOptional?: boolean
  visibility?: 'public' | 'protected' | 'private'
}

// ---------------- MODULES & RE-EXPORTS ----------------

export interface ModuleReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'module'
  /** Top-level declarations in this module. */
  children: Collection<ModuleMember<M>, M>
}

export type ModuleMember<M extends Mode> = DeclarationReflection<M> | ReExportReflection<M>

/** Any declaration that can appear at module (or namespace) top level. */
export type DeclarationReflection<M extends Mode> =
  | VariableReflection<M>
  | FunctionReflection<M>
  | ClassReflection<M>
  | InterfaceReflection<M>
  | TypeAliasReflection<M>
  | EnumReflection<M>
  | ModuleReflection<M>

/**
 * Re-exports come in three syntactic forms; splitting them keeps each shape
 * unambiguous instead of relying on which optional fields happen to be set.
 */
export type ReExportReflection<_M extends Mode> =
  /** `export * from './x'` */
  | { kind: 're-export-all'; sourceModule: string; resolvedIds?: number[] }
  /** `export * as foo from './x'` */
  | { kind: 're-export-namespace'; sourceModule: string; as: string; resolvedIds?: number[] }
  /** `export { baz as bar } from './x'` — `as` is set only when aliased. */
  | { kind: 're-export-named'; sourceModule: string; name: string; as?: string; resolvedIds?: number[] }

// ---------------- DECLARATIONS ----------------

export interface VariableReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'variable'
  type: TypeReflection<M>
  defaultValue?: string
}

export interface FunctionReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'function'
  /** Multiple entries represent overloads; each carries its own comment. */
  signatures: Collection<SignatureReflection<M>, M>
}

export interface ClassReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'class'
  typeParameters?: Collection<TypeParameterReflection<M>, M>
  extends?: TypeReflection<M>
  implements?: Collection<TypeReflection<M>, M>
  constructors: Collection<SignatureReflection<M>, M>
  properties: Collection<PropertyReflection<M>, M>
  methods: Collection<MethodReflection<M>, M>
  /** Index signature, if any: e.g., `[key: string]: unknown`. */
  indexSignature?: Collection<IndexSignatureReflection<M>, M>
}

export interface InterfaceReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'interface'
  typeParameters?: Collection<TypeParameterReflection<M>, M>
  extends?: Collection<TypeReflection<M>, M>
  properties: Collection<PropertyReflection<M>, M>
  methods: Collection<MethodReflection<M>, M>
  /** Call signatures make the interface itself callable. */
  callSignatures?: Collection<SignatureReflection<M>, M>
  /** Construct signatures make the interface newable. */
  constructSignatures?: Collection<SignatureReflection<M>, M>
  indexSignature?: IndexSignatureReflection<M>
}

export interface TypeAliasReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'type-alias'
  typeParameters?: Collection<TypeParameterReflection<M>, M>
  type: TypeReflection<M>
}

export interface EnumReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'enum'
  isConst?: boolean
  members: Collection<EnumMemberReflection<M>, M>
}

export interface EnumMemberReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'enum-member'
  /** Resolved value when known (numeric or string enums); absent for computed members. */
  value?: string | number
}

// ---------------- CLASS/INTERFACE MEMBERS ----------------

export interface PropertyReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'property'
  type: TypeReflection<M>
  defaultValue?: string
}

export interface MethodReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'method'
  signatures: Collection<SignatureReflection<M>, M>
}

export interface IndexSignatureReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'index-signature'
  /** The key type — typically `string` or `number`. */
  parameter: Collection<ParameterReflection<M>, M>
  /** The value type. */
  type: TypeReflection<M>
}

// ---------------- SIGNATURES & PARAMETERS ----------------

/**
 * Represents one callable shape — for functions, methods, constructors, and
 * call/construct signatures on interfaces. Extends BaseReflection so each
 * overload can carry its own JSDoc comment.
 */
export interface SignatureReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'signature'
  typeParameters?: Collection<TypeParameterReflection<M>, M>
  parameters: Collection<ParameterReflection<M>, M>
  /** Return type (or constructed type for construct signatures). */
  type: TypeReflection<M>
}

export interface ParameterReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'parameter'
  type: TypeReflection<M>
  isOptional: boolean
  isRest?: boolean
  defaultValue?: string
}

export interface TypeParameterReflection<M extends Mode> {
  name: string
  /** `T extends Foo` */
  constraint?: TypeReflection<M>
  /** `T = string` */
  default?: TypeReflection<M>
}

// ---------------- TYPES ----------------

export type TypeReflection<M extends Mode> =
  | IntrinsicType
  | LiteralType
  | ReferenceType<M>
  | UnionType<M>
  | IntersectionType<M>
  | ArrayType<M>
  | TupleType<M>
  | FunctionType<M>
  | TypeOperatorType<M>
  | QueryType<M>
  | ReflectionType<M>

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

/** A named reference, e.g. `Promise<User>` or a custom declared type. */
export interface ReferenceType<M extends Mode> {
  kind: 'reference'
  /** Stable id for this reference site. Used by the second-pass resolver. */
  id: number
  name: string
  /** Resolved id of the target declaration, when in-project. */
  targetId?: number
  typeArguments?: Collection<TypeReflection<M>, M>
}

export interface UnionType<M extends Mode> {
  kind: 'union'
  types: Collection<TypeReflection<M>, M>
}

export interface IntersectionType<M extends Mode> {
  kind: 'intersection'
  types: Collection<TypeReflection<M>, M>
}

export interface ArrayType<M extends Mode> {
  kind: 'array'
  elementType: TypeReflection<M>
}

export interface TupleType<M extends Mode> {
  kind: 'tuple'
  elements: Collection<TupleElement<M>, M>
}

export interface TupleElement<M extends Mode> {
  type: TypeReflection<M>
  /** Labeled tuple element name, if any: e.g., `[x: number, y: number]`. */
  name?: string
  isOptional?: boolean
  isRest?: boolean
}

/** Function/callable types appearing inline, e.g. `(x: number) => string`. */
export interface FunctionType<M extends Mode> {
  kind: 'function-type'
  signatures: Collection<SignatureReflection<M>, M>
}

/** `keyof T`, `readonly T[]`, `unique symbol`. */
export interface TypeOperatorType<M extends Mode> {
  kind: 'type-operator'
  operator: 'keyof' | 'readonly' | 'unique'
  target: TypeReflection<M>
}

/** `typeof foo` */
export interface QueryType<M extends Mode> {
  kind: 'query'
  queryType: ReferenceType<M>
}

/** Inline object/type-literal shapes. */
export interface ReflectionType<M extends Mode> {
  kind: 'reflection'
  declaration: ObjectLiteralReflection<M>
}

export interface ObjectLiteralReflection<M extends Mode> extends BaseReflection<M> {
  kind: 'object-literal'
  properties: Collection<PropertyReflection<M>, M>
  methods?: Collection<MethodReflection<M>, M>
  callSignatures?: Collection<SignatureReflection<M>, M>
  constructSignatures?: Collection<SignatureReflection<M>, M>
  indexSignature?: Collection<IndexSignatureReflection<M>, M>
}

// ---------------- COMMENTS ----------------

export interface Comment<M extends Mode> {
  /** Free-form description text (the main JSDoc body). */
  text: string
  tags: Collection<CommentTag, M>
}

/**
 * JSDoc tags. Most tags are plain text, but `@param` and `@example` are
 * common enough to warrant dedicated shapes for accurate rendering.
 */
export type CommentTag =
  | { tag: '@param'; name: string; text: string }
  | { tag: '@example'; caption?: string; code: string }
  | { tag: '@returns' | '@throws' | '@deprecated' | '@see' | '@remarks' | '@default'; text: string }
  | { tag: string; name?: string; text: string }
