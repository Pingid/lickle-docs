import { compose, type RouteContext } from './core.ts'
import type * as reflect from '../../reflect/index.ts'
import type { Kind } from '../../project/kind.ts'

export const groupBy = (
  cb: (
    d: reflect.Declaration,
    cx: RouteContext,
    value: { name: string; order?: number } | undefined,
  ) => { name: string; order?: number },
) =>
  compose({
    modules: (value, id, cx) => value.map((m) => ({ ...m, group: cb(cx.docs.get(id)!, cx, m.group) })),
    sidebar: (value, id, cx) => {
      if (!value) return undefined
      const decl = cx.docs.get(id)!
      return { parent: value?.parent, group: cb(decl, cx, value?.group) }
    },
  })

export const groupByKind = groupBy((d) => ({ name: pluralLabel(d.kind), order: groupOrder(d) }))

const GROUP_ORDER: (keyof reflect.DeclarationMap)[] = [
  'module',
  'function',
  'variable',
  'class',
  'interface',
  'type-alias',
  'enum',
  'namespace',
  'export',
]

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

const pluralLabel = (kind: Kind | string): string => PLURAL[kind as Kind] ?? `${kind}s`

export const groupOrder = (d: reflect.Declaration): number => {
  const i = GROUP_ORDER.indexOf(d.kind)
  return i < 0 ? GROUP_ORDER.length : i
}
