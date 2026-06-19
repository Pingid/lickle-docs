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
  | 'export'
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
  | 'record'
  | 'unknown'

const LABELS: Record<Kind, string> = {
  module: 'module',
  namespace: 'namespace',
  export: 'export',
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
  record: 'object',
  unknown: 'unknown',
}

/** Human-readable label for a kind: `'type-alias'` → `'type'`, `'record'` → `'object'`. */
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

/** One-character badge for a kind, as shown in sidebars and search hits: `'function'` → `'ƒ'`, `'type-alias'` → `'T'`. */
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

/** Whether declarations of this kind get a page of their own. Members (properties, methods, …) render inline on their owner's page. */
export const isRoutable = (kind: Kind | string): boolean => ROUTABLE.has(kind as Kind)

const PLURAL: Record<Kind, string> = {
  module: 'modules',
  namespace: 'namespaces',
  export: 'exports',
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
  record: 'objects',
  unknown: 'unknown',
}

/** Plural section heading for a kind, as used by the stock grouping: `'type-alias'` → `'types'`. */
export const pluralLabel = (kind: Kind | string): string => PLURAL[kind as Kind] ?? `${labelOf(kind)}s`

const GROUP_KIND_ORDER: Kind[] = [
  'module',
  'namespace',
  'class',
  'function',
  'variable',
  'interface',
  'type-alias',
  'enum',
  'property',
  'method',
]

/** Sort index for kind groups (modules first, then functions, variables, types, …). Unlisted kinds sort last. */
export const kindOrder = (kind: Kind): number => {
  const i = GROUP_KIND_ORDER.indexOf(kind)
  return i < 0 ? GROUP_KIND_ORDER.length : i
}
