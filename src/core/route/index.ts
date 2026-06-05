import type { Route } from './types.ts'

import {
  compose,
  makeContext,
  withMemo,
  provide,
  groupByKind,
  type ContextOptions,
  groupOrder,
} from './provider/index.ts'

export type * from './provider/index.ts'
export * from './debug/index.ts'
export type * from './types.ts'

export const docRoutes = (opts: ContextOptions): Route[] => {
  const cx = makeContext(opts, (c) => withMemo(provide(c, compose(groupByKind, opts.adapter))))

  const routes: Route[] = []
  for (const decl of opts.docs.declarations()) {
    const r = cx.provider.route(decl.id)
    if (r) routes.push(r)
  }

  return routes.sort((a, b) => {
    const a1 = a.body.find((b) => b.kind === 'doc:statement')
    const b1 = b.body.find((b) => b.kind === 'doc:statement')
    if (!a1 || !b1) return 0
    return groupOrder(cx.docs.get(a1.id)!) - groupOrder(cx.docs.get(b1.id)!)
  })
}
