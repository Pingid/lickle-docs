// TypeDoc ReflectionKind values, see typedoc/src/lib/models/reflections/kind.ts
export const Kind = {
  Project: 1,
  Module: 2,
  Namespace: 4,
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  CallSignature: 4096,
  IndexSignature: 8192,
  ConstructorSignature: 16384,
  Parameter: 32768,
  TypeLiteral: 65536,
  TypeParameter: 131072,
  Accessor: 262144,
  GetSignature: 524288,
  SetSignature: 1048576,
  TypeAlias: 2097152,
  Reference: 4194304,
} as const

export type KindValue = (typeof Kind)[keyof typeof Kind]

/**
 * Structural shape used by {@link effectiveKind}. Kept loose to avoid pulling
 * the full `typedoc` types into this module.
 */
type DeclLike = {
  kind: number
  signatures?: unknown[]
  type?: { type?: string; declaration?: { signatures?: unknown[] } }
}

/**
 * Promote a callable `const` (TypeDoc reports it as `Variable`) to `Function`.
 * Source-level `const f = () => ...` is semantically a function, so the UI
 * labels and groups it that way. Everything else passes through.
 */
export const effectiveKind = (decl: DeclLike): number => {
  if (decl.kind !== Kind.Variable) return decl.kind
  if (decl.signatures?.length) return Kind.Function
  const d = decl.type
  if (d?.type === 'reflection' && d.declaration?.signatures?.length) return Kind.Function
  return decl.kind
}

/**
 * Call signatures for a declaration. Functions/Methods carry them on
 * `decl.signatures`; callable Variables (see {@link effectiveKind}) carry
 * them under `type.declaration.signatures`. Returns `[]` when neither path
 * yields signatures. Generic over `S` so callers keep their typedoc types.
 */
export const signaturesOf = <S>(decl: {
  signatures?: S[]
  type?: { type?: string; declaration?: { signatures?: S[] } }
}): S[] => {
  if (decl.signatures?.length) return decl.signatures
  const d = decl.type
  if (d?.type === 'reflection' && d.declaration?.signatures?.length) return d.declaration.signatures
  return []
}

export const labelOf = (kind: number): string => {
  switch (kind) {
    case Kind.Project:
      return 'project'
    case Kind.Module:
      return 'module'
    case Kind.Namespace:
      return 'namespace'
    case Kind.Enum:
      return 'enum'
    case Kind.EnumMember:
      return 'member'
    case Kind.Variable:
      return 'variable'
    case Kind.Function:
      return 'function'
    case Kind.Class:
      return 'class'
    case Kind.Interface:
      return 'interface'
    case Kind.Constructor:
      return 'constructor'
    case Kind.Property:
      return 'property'
    case Kind.Method:
      return 'method'
    case Kind.Accessor:
      return 'accessor'
    case Kind.TypeAlias:
      return 'type'
    case Kind.Reference:
      return 'reference'
    default:
      return 'symbol'
  }
}

export const shortOf = (kind: number): string => {
  switch (kind) {
    case Kind.Module:
      return 'M'
    case Kind.Namespace:
      return 'N'
    case Kind.Enum:
      return 'E'
    case Kind.Variable:
      return 'V'
    case Kind.Function:
      return 'ƒ'
    case Kind.Class:
      return 'C'
    case Kind.Interface:
      return 'I'
    case Kind.Property:
      return 'p'
    case Kind.Method:
      return 'm'
    case Kind.TypeAlias:
      return 'T'
    default:
      return '·'
  }
}

export const ROUTABLE_KINDS = new Set<number>([
  Kind.Module,
  Kind.Namespace,
  Kind.Class,
  Kind.Interface,
  Kind.Function,
  Kind.Variable,
  Kind.Enum,
  Kind.TypeAlias,
])

export const isRoutable = (kind: number): boolean => ROUTABLE_KINDS.has(kind)

/**
 * Canonical group ordering: functions → variables → types → everything else.
 * Accepts both typedoc's titles ("Type Aliases") and our bucket titles ("types").
 * Unknown titles sort to the end.
 */
const GROUP_ORDER = [
  'functions',
  'variables',
  'type aliases',
  'classes',
  'interfaces',
  'enumerations',
  'namespaces',
  'modules',
  'properties',
  'methods',
  'accessors',
]
const GROUP_ALIAS: Record<string, string> = { types: 'type aliases', enums: 'enumerations' }

export const groupOrder = (title: string): number => {
  const t = title.trim().toLowerCase()
  const i = GROUP_ORDER.indexOf(GROUP_ALIAS[t] ?? t)
  return i < 0 ? GROUP_ORDER.length : i
}
