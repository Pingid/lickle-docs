/**
 * String discriminants for everything we render. Server-side normalisation
 * (in `scan.ts`) collapses callable variables to `function`, so the client
 * can read `decl.kind` directly without runtime adjustment.
 *
 * Members like `'enum-member'`, `'property'`, … are not declarations but
 * still appear in member listings and search hits.
 */
export type Kind =
  | 'module'
  | 'namespace'
  | 'exports'
  | 'variable'
  | 'function'
  | 'class'
  | 'interface'
  | 'type-alias'
  | 'enum'
  | 'enum-member'
  | 'property'
  | 'method'
  | 'parameter'
  | 'signature'
  | 'index-signature'
  | 'object-literal'

const LABELS: Record<Kind, string> = {
  module: 'module',
  namespace: 'namespace',
  exports: 'exports',
  variable: 'variable',
  function: 'function',
  class: 'class',
  interface: 'interface',
  'type-alias': 'type',
  enum: 'enum',
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
  namespace: 'N',
  variable: 'V',
  function: 'ƒ',
  class: 'C',
  interface: 'I',
  'type-alias': 'T',
  enum: 'E',
  property: 'p',
  method: 'm',
}

export const shortOf = (kind: Kind | string): string => SHORTS[kind as Kind] ?? '·'

const ROUTABLE: ReadonlySet<Kind> = new Set([
  'module',
  'namespace',
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
  namespace: 'namespaces',
  exports: 'exports',
  variable: 'variables',
  function: 'functions',
  class: 'classes',
  interface: 'interfaces',
  'type-alias': 'types',
  enum: 'enums',
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
  'modules',
  'namespaces',
  'functions',
  'variables',
  'types',
  'classes',
  'interfaces',
  'enums',
  'properties',
  'methods',
]

export const groupOrder = (title: string): number => {
  const i = GROUP_ORDER.indexOf(title.trim().toLowerCase())
  return i < 0 ? GROUP_ORDER.length : i
}
