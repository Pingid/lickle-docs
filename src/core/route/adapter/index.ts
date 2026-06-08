import { createFacade, type DeclarationFacade } from '../provider/facade.ts'
import { compose, type RouteContext } from '../provider/core.ts'
import { kindOrder, pluralLabel } from '../naming.ts'

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
  if (d.isEntry()) return { name: '', order: 1 + (d.entryIndex() ?? 0) }
  return { name: pluralLabel(d.kind), order: kindOrder(d.kind) }
})
