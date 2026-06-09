import { createMemo, type Accessor } from 'solid-js'

import { useDocActiveProject, useDocs, type Types } from '../../context/index.tsx'
import { createRouter } from '../../../core/route/client/index.ts'

const INSTANCE = new WeakMap<Types.DocsVersion, Types.ClientRouter>()

export const useDocRouter = (): Accessor<Types.ClientRouter | undefined> => {
  const docs = useDocs()
  const doc = useDocActiveProject()
  const routes = createMemo(() => {
    const prj = doc.json()
    const active = doc.version()
    if (!prj || !active) return undefined
    if (INSTANCE.has(active)) return INSTANCE.get(active)!
    const r = createRouter({
      routes: prj.routes,
      prefix: { doc: docs.name().replace(/^@/, ''), page: '' },
      base: doc.version()?.slug,
    })
    INSTANCE.set(active, r)
    return r
  })
  return routes
}
