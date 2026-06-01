import type { RouteNode } from './index.ts'

export const displayRoutes = (routes: RouteNode[], prefix: string = '') => {
  const kinds = { module: 'M', markdown: '.MD', declaration: 'D' }
  for (const r of routes) {
    const id = (r.page as { id?: number }).id ?? r.label
    console.log(`${prefix}${kinds[r.page.kind]} ${id} (${r.slug})`)
    if (r.children) displayRoutes(r.children, prefix + '  ')
  }
}
