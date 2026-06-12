import { createMemo, type Accessor } from 'solid-js'

import { useDocActiveProject, useDocs, type Reflect } from '../../context/index.tsx'
import { createRouter, type ClientRouter } from '../../../core/route/client/index.ts'

export type { ClientRouter, Route, DocRoute, DocLink } from '../../../core/route/types.ts'
export { groupItems } from '../../../core/route/client/index.ts'

const INSTANCE = new WeakMap<Reflect.DocsVersion, ClientRouter>()

/**
 * The route table for the active version: every page, the sidebar tree and
 * slug/id lookups (see `ClientRouter`). Slugs come prefixed with the project
 * and version path, ready for navigation. Built once per version and reused.
 * @group hooks
 */
export const use = (): Accessor<ClientRouter | undefined> => {
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
