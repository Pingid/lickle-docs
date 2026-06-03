import type { RouteNode } from '../../../../core/project/index.ts'

export const flattenSlugs = (routes: RouteNode[]): string[] => {
  const out: string[] = []
  const walk = (ns: RouteNode[]) => {
    for (const n of ns) {
      out.push(n.slug)
      if (n.children.length) walk(n.children)
    }
  }
  walk(routes)
  return out
}
