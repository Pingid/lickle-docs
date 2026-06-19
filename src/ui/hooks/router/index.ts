import { createMemo, type Accessor } from 'solid-js'

import { createLayoutRouter, type LayoutRouter } from '../../../core/layout/client.ts'
import { useDocActiveProject, type Reflect } from '../../context/index.tsx'

export type { LayoutRouter } from '../../../core/layout/client.ts'
/** The router surface the UI consumes. */
export type ClientRouter = LayoutRouter
export type { PageNode, DocPage, DocLink } from '../../../core/layout/types.ts'
export { groupItems } from '../../../core/layout/group.ts'

const INSTANCE = new WeakMap<Reflect.DocsVersion, LayoutRouter>()

/**
 * The page table for the active version: every page, the server-built sidebar
 * tree and slug/id lookups. Slugs come prefixed with the project and version
 * path, ready for navigation. Built once per version and reused.
 * @group hooks
 */
export const use = (): Accessor<LayoutRouter | undefined> => {
  const doc = useDocActiveProject()
  const router = createMemo(() => {
    const prj = doc.json()
    const active = doc.version()
    if (!prj || !active) return undefined
    if (INSTANCE.has(active)) return INSTANCE.get(active)!
    const base = doc.version()?.slug
    const r = createLayoutRouter({
      pages: prj.pages,
      sidebar: prj.sidebar,
      redirects: prj.redirects,
      prefix: prj.prefix,
      base,
    })
    INSTANCE.set(active, r)
    return r
  })
  return router
}
