import type { index } from '@lickle/docs'

/**
 * String discriminants for everything we care about in the UI. The schema
 * already gives us declaration kinds; the additional members (`'enum-member'`,
 * `'property'`, …) come from nested reflections that aren't declarations but
 * still need labels and icons.
 */
export type Kind =
  | 'module'
  | 'variable'
  | 'function'
  | 'class'
  | 'interface'
  | 'type-alias'
  | 'enum'
  | 're-export'
  | 'enum-member'
  | 'property'
  | 'method'
  | 'parameter'
  | 'signature'
  | 'index-signature'
  | 'object-literal'

type CallableHost = {
  type?: { kind?: string; signatures?: unknown[]; declaration?: { callSignatures?: unknown[] } }
}

/**
 * Promote a callable `const` (the resolver reports it as `variable`) to
 * `function`. Source-level `const f = () => …` is semantically a function, so
 * the UI labels and groups it that way. Everything else passes through.
 */
export const effectiveKind = (decl: { kind: string } & CallableHost): Kind => {
  if (decl.kind !== 'variable') return decl.kind as Kind
  const t = decl.type
  if (t?.kind === 'function-type' && (t as { signatures?: unknown[] }).signatures?.length) return 'function'
  if (t?.kind === 'reflection' && t.declaration?.callSignatures?.length) return 'function'
  return 'variable'
}

/**
 * Call signatures for a declaration. `function` and `method` carry them
 * directly on `signatures`; callable Variables (see {@link effectiveKind})
 * carry them on `type.signatures` (`function-type`) or
 * `type.declaration.callSignatures` (`reflection`).
 */
export const signaturesOf = (decl: {
  signatures?: index.Signature[]
  type?: { kind?: string; signatures?: index.Signature[]; declaration?: { callSignatures?: index.Signature[] } }
}): index.Signature[] => {
  if (decl.signatures?.length) return decl.signatures
  const t = decl.type
  if (t?.kind === 'function-type' && t.signatures?.length) return t.signatures
  if (t?.kind === 'reflection' && t.declaration?.callSignatures?.length) return t.declaration.callSignatures
  return []
}

const LABELS: Record<Kind, string> = {
  module: 'module',
  variable: 'variable',
  function: 'function',
  class: 'class',
  interface: 'interface',
  'type-alias': 'type',
  enum: 'enum',
  're-export': 'reference',
  'enum-member': 'member',
  property: 'property',
  method: 'method',
  parameter: 'parameter',
  signature: 'signature',
  'index-signature': 'index signature',
  'object-literal': 'object',
}

export const labelOf = (kind: Kind | string): string => LABELS[kind as Kind] ?? 'symbol'

const SHORTS: Partial<Record<Kind, string>> = {
  module: 'M',
  variable: 'V',
  function: 'ƒ',
  class: 'C',
  interface: 'I',
  'type-alias': 'T',
  enum: 'E',
  property: 'p',
  method: 'm',
  're-export': 'R',
}

export const shortOf = (kind: Kind | string): string => SHORTS[kind as Kind] ?? '·'

const ROUTABLE: ReadonlySet<Kind> = new Set([
  'module',
  'class',
  'interface',
  'function',
  'variable',
  'enum',
  'type-alias',
])

export const isRoutable = (kind: Kind | string): boolean => ROUTABLE.has(kind as Kind)

const PLURAL: Record<Kind, string> = {
  module: 'modules',
  variable: 'variables',
  function: 'functions',
  class: 'classes',
  interface: 'interfaces',
  'type-alias': 'types',
  enum: 'enums',
  're-export': 'references',
  'enum-member': 'members',
  property: 'properties',
  method: 'methods',
  parameter: 'parameters',
  signature: 'signatures',
  'index-signature': 'index signatures',
  'object-literal': 'objects',
}

export const pluralLabel = (kind: Kind | string): string => PLURAL[kind as Kind] ?? `${labelOf(kind)}s`

/**
 * Canonical group ordering: functions → variables → types → everything else.
 * Unknown titles sort to the end.
 */
const GROUP_ORDER = [
  'functions',
  'variables',
  'types',
  'classes',
  'interfaces',
  'enums',
  'modules',
  'references',
  'properties',
  'methods',
]

export const groupOrder = (title: string): number => {
  const i = GROUP_ORDER.indexOf(title.trim().toLowerCase())
  return i < 0 ? GROUP_ORDER.length : i
}
