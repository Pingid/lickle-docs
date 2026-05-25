export interface ProjectReflection {
  name: string
  /** Optional top-level package description, e.g. from the package README. */
  comment?: Comment
  /** A project is fundamentally a collection of modules/files. */
  children: ModuleReflection[]
}

export interface BaseReflection {
  /** Stable identifier used by `reference` types to point back at a declaration. */
  id: number
  name: string
  comment?: Comment
  /** All source locations contributing to this reflection. Multiple when declarations merge (e.g. interface + namespace, function overloads). */
  sources?: SourceLocation[]
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

export interface ModuleReflection extends BaseReflection {
  kind: 'module'
  /** Top-level declarations in this module. */
  children: DeclarationReflection[]
  /** Re-exports from other modules. Kept separate from `children` because they don't introduce new declarations. */
  reExports?: ReExportReflection[]
}

/** Any declaration that can appear at module (or namespace) top level. */
export type DeclarationReflection =
  | VariableReflection
  | FunctionReflection
  | ClassReflection
  | InterfaceReflection
  | TypeAliasReflection
  | EnumReflection
  | ModuleReflection

/**
 * Re-exports come in three syntactic forms; splitting them keeps each shape
 * unambiguous instead of relying on which optional fields happen to be set.
 */
export type ReExportReflection =
  /** `export * from './x'` */
  | { kind: 're-export-all'; sourceModule: string; resolvedIds?: number[] }
  /** `export * as foo from './x'` */
  | { kind: 're-export-namespace'; sourceModule: string; as: string; resolvedIds?: number[] }
  /** `export { baz as bar } from './x'` — `as` is set only when aliased. */
  | { kind: 're-export-named'; sourceModule: string; name: string; as?: string; resolvedIds?: number[] }

// ---------------- DECLARATIONS ----------------

export interface VariableReflection extends BaseReflection {
  kind: 'variable'
  type: TypeReflection
  defaultValue?: string
}

export interface FunctionReflection extends BaseReflection {
  kind: 'function'
  /** Multiple entries represent overloads; each carries its own comment. */
  signatures: SignatureReflection[]
}

export interface ClassReflection extends BaseReflection {
  kind: 'class'
  typeParameters?: TypeParameterReflection[]
  extends?: TypeReflection
  implements?: TypeReflection[]
  constructors: SignatureReflection[]
  properties: PropertyReflection[]
  methods: MethodReflection[]
  /** Index signature, if any: e.g., `[key: string]: unknown`. */
  indexSignature?: IndexSignatureReflection
}

export interface InterfaceReflection extends BaseReflection {
  kind: 'interface'
  typeParameters?: TypeParameterReflection[]
  extends?: TypeReflection[]
  properties: PropertyReflection[]
  methods: MethodReflection[]
  /** Call signatures make the interface itself callable. */
  callSignatures?: SignatureReflection[]
  /** Construct signatures make the interface newable. */
  constructSignatures?: SignatureReflection[]
  indexSignature?: IndexSignatureReflection
}

export interface TypeAliasReflection extends BaseReflection {
  kind: 'type-alias'
  typeParameters?: TypeParameterReflection[]
  type: TypeReflection
}

export interface EnumReflection extends BaseReflection {
  kind: 'enum'
  isConst?: boolean
  members: EnumMemberReflection[]
}

export interface EnumMemberReflection extends BaseReflection {
  kind: 'enum-member'
  /** Resolved value when known (numeric or string enums); absent for computed members. */
  value?: string | number
}

// ---------------- CLASS/INTERFACE MEMBERS ----------------

export interface PropertyReflection extends BaseReflection {
  kind: 'property'
  type: TypeReflection
  defaultValue?: string
}

export interface MethodReflection extends BaseReflection {
  kind: 'method'
  signatures: SignatureReflection[]
}

export interface IndexSignatureReflection extends BaseReflection {
  kind: 'index-signature'
  /** The key type — typically `string` or `number`. */
  parameter: ParameterReflection
  /** The value type. */
  type: TypeReflection
}

// ---------------- SIGNATURES & PARAMETERS ----------------

/**
 * Represents one callable shape — for functions, methods, constructors, and
 * call/construct signatures on interfaces. Extends BaseReflection so each
 * overload can carry its own JSDoc comment.
 */
export interface SignatureReflection extends BaseReflection {
  kind: 'signature'
  typeParameters?: TypeParameterReflection[]
  parameters: ParameterReflection[]
  /** Return type (or constructed type for construct signatures). */
  type: TypeReflection
}

export interface ParameterReflection extends BaseReflection {
  kind: 'parameter'
  type: TypeReflection
  isOptional: boolean
  isRest?: boolean
  defaultValue?: string
}

export interface TypeParameterReflection {
  name: string
  /** `T extends Foo` */
  constraint?: TypeReflection
  /** `T = string` */
  default?: TypeReflection
}

// ---------------- TYPES ----------------

export type TypeReflection =
  | IntrinsicType
  | LiteralType
  | ReferenceType
  | UnionType
  | IntersectionType
  | ArrayType
  | TupleType
  | FunctionType
  | TypeOperatorType
  | QueryType
  | ReflectionType

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
export interface ReferenceType {
  kind: 'reference'
  /** Stable id for this reference site. Used by the second-pass resolver. */
  id: number
  name: string
  /** Resolved id of the target declaration, when in-project. */
  targetId?: number
  typeArguments?: TypeReflection[]
}

export interface UnionType {
  kind: 'union'
  types: TypeReflection[]
}

export interface IntersectionType {
  kind: 'intersection'
  types: TypeReflection[]
}

export interface ArrayType {
  kind: 'array'
  elementType: TypeReflection
}

export interface TupleType {
  kind: 'tuple'
  elements: TupleElement[]
}

export interface TupleElement {
  type: TypeReflection
  /** Labeled tuple element name, if any: e.g., `[x: number, y: number]`. */
  name?: string
  isOptional?: boolean
  isRest?: boolean
}

/** Function/callable types appearing inline, e.g. `(x: number) => string`. */
export interface FunctionType {
  kind: 'function-type'
  signatures: SignatureReflection[]
}

/** `keyof T`, `readonly T[]`, `unique symbol`. */
export interface TypeOperatorType {
  kind: 'type-operator'
  operator: 'keyof' | 'readonly' | 'unique'
  target: TypeReflection
}

/** `typeof foo` */
export interface QueryType {
  kind: 'query'
  queryType: ReferenceType
}

/** Inline object/type-literal shapes. */
export interface ReflectionType {
  kind: 'reflection'
  declaration: ObjectLiteralReflection
}

export interface ObjectLiteralReflection extends BaseReflection {
  kind: 'object-literal'
  properties: PropertyReflection[]
  methods?: MethodReflection[]
  callSignatures?: SignatureReflection[]
  constructSignatures?: SignatureReflection[]
  indexSignature?: IndexSignatureReflection
}

// ---------------- COMMENTS ----------------

export interface Comment {
  /** Free-form description text (the main JSDoc body). */
  text: string
  tags: CommentTag[]
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
