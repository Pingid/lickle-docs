import type { RouteNode } from './index.ts'

export const displayRoutes = (routes: RouteNode[], prefix: string = '') => {
  const kinds = { doc: 'D', markdown: '.MD' }
  // console.log(JSON.stringify(compact(routes)))

  // routes.map
  for (const r of routes) {
    const id = (r.page as { id?: number }).id ?? r.label
    console.log(`${prefix}${kinds[r.page.kind]} ${id} (${r.slug})`)
    if (r.children) displayRoutes(r.children, prefix + '  ')
  }
}

type CompactRouteNode = Pick<RouteNode, 'label' | 'slug'> & { children: CompactRouteNode[] }

const compact = (routes: RouteNode[]): CompactRouteNode[] => {
  return routes
    .map((r) => {
      // if (r.page.kind === 'declaration') return ['D']
      return [
        {
          label: r.label,
          slug: r.slug,
          children: compact(r.children),
        },
      ]
    })
    .flat()
}
