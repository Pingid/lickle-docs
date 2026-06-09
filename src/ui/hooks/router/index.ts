import { createMemo, type Accessor } from 'solid-js'

import { useDocActiveProject, type Types } from '../../context/index.tsx'
import { createRouter } from '../../../core/route/client/index.ts'

const INSTANCE = new WeakMap<Types.ProjectJson, Types.ClientRouter>()

export const useDocRouter = (): Accessor<Types.ClientRouter | undefined> => {
  const doc = useDocActiveProject()
  const routes = createMemo(() => {
    const prj = doc.current()
    if (!prj) return undefined
    if (INSTANCE.has(prj)) return INSTANCE.get(prj)!
    const r = createRouter({ items: prj.routes.items, prefix: prj.routes.prefix, base: doc.version()?.slug })
    INSTANCE.set(prj, r)
    return r
  })
  return routes
}
