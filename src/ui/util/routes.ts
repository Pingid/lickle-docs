import type { BaseRoute, RouteNode } from '../../core/project/types.ts'

/** A label-only group node (no page, no slug) — present only for sidebar layout. */
export const isGroupNode = (r: BaseRoute<unknown>): boolean => r.page === undefined

/**
 * Flatten synthetic group wrappers, yielding page-bearing routes in order.
 * Group nodes exist only to lay out the sidebar; everywhere else (content
 * listings, search, references) wants the actual pages underneath them.
 */
export const pageRoutes = (nodes: readonly BaseRoute<unknown>[]): RouteNode[] => {
  const out: RouteNode[] = []
  for (const n of nodes) {
    if (n.page === undefined) out.push(...pageRoutes(n.children))
    else out.push(n as RouteNode)
  }
  return out
}

/** Page-bearing descendants that are `doc` pages (declaration routes). */
export const docRoutes = (nodes: readonly BaseRoute<unknown>[]): RouteNode[] =>
  pageRoutes(nodes).filter((r) => r.page?.kind === 'doc')
