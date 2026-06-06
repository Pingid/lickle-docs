import { compose, type RouteContext } from '../provider/core.ts'
import { groupOrder, pluralLabel } from '../naming.ts'
import type { Reflect } from '../../index.ts'

export type * from '../provider/core.ts'
export type * from '../types.ts'
export * from '../naming.ts'

export { compose }

export const groupBy = (
  cb: (
    d: Reflect.Declaration,
    cx: RouteContext,
    value: { name: string; order?: number } | undefined,
  ) => { name: string; order?: number },
) =>
  compose({
    modules: (value, d, cx) => value.map((m) => ({ ...m, group: cb(cx.docs.get(d.id)!, cx, m.group) })),
    sidebar: (value, d, cx) => {
      if (!value) return undefined
      const decl = cx.docs.get(d.id)!
      return { parent: value?.parent, group: cb(decl, cx, value?.group) }
    },
    referenced: (value, _, cx) => value.map((r) => ({ ...r, group: cb(cx.docs.get(r.target)!, cx, r.group) })),
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
