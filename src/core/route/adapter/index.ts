import { compose, type RouteContext } from '../provider/core.ts'
import { createFacade, type DeclarationFacade } from '../provider/facade.ts'
import { groupOrder, pluralLabel } from '../naming.ts'

export type * from '../provider/core.ts'
export type * from '../types.ts'
export * from '../naming.ts'

export { compose }

export const groupBy = (
  cb: (
    d: DeclarationFacade,
    cx: RouteContext,
    value: { name: string; order?: number } | undefined,
  ) => { name: string; order?: number },
) =>
  compose({
    links: (value, _, cx) => value.map((l) => ({ ...l, group: cb(createFacade(cx.docs, l.target)!, cx, l.group) })),
    sidebar: (value, d, cx) => {
      if (!value) return undefined
      return { ...value, group: cb(d, cx, value?.group) }
    },
    referenced: (value, _, cx) =>
      value.map((r) => ({ ...r, group: cb(createFacade(cx.docs, r.target)!, cx, r.group) })),
  })

export const groupByKind = groupBy((d) => {
  const name = pluralLabel(d.kind)
  return { name, order: groupOrder(name) }
})

export const slugBase = (prefix: string) => compose({ slug: (value) => joinSlug(prefix, value) })

const joinSlug = (prefix: string, value: string) => {
  const v = value.startsWith('/') ? value.slice(1) : value
  const p = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  if (!p.length) return v
  if (!v.length) return p
  return `${p}/${v}`
}
