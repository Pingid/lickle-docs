import { type RouteContext, type Provider, type Adapter, provideAdapter } from './core.ts'
import type { DocRoute, Sidebar, DocLink } from '../types.ts'
import type { Exposure } from '../../reflect/indexed.ts'

export const provide = (c: RouteContext, adapter: Adapter): Provider => provideAdapter(c, provider(c), adapter)

const provider = (cx: RouteContext): Provider => ({
  alias: getAlias(cx),
  slug: getSlug(cx),
  declare: getRoute(cx),
  sidebar: getSidebar(cx),
  links: getLinks(cx),
  referenced: getReferenced(cx),
})

const getRoute =
  (cx: RouteContext) =>
  (id: number): DocRoute | undefined => {
    const decl = cx.docs.get(id)!
    if (decl.kind === 'export') return undefined

    const sidebar = cx.provider.sidebar(id)
    const title = cx.provider.alias(id)
    const slug = cx.provider.slug(id)
    const links = cx.provider.links(id)
    const referenced = cx.provider.referenced(id)

    return { kind: 'doc', decl: id, title, slug, sidebar, links, referenced }
  }

const getLinks =
  (cx: RouteContext) =>
  (id: number): DocLink[] => {
    const decl = cx.docs.get(id)!
    if (decl.kind !== 'module') return []
    return cx.docs.exposes(id).map((e) => ({ target: e.exposer, alias: e.alias ?? cx.provider.alias(id) }))
  }

const getReferenced =
  (cx: RouteContext) =>
  (id: number): DocLink[] => {
    return Array.from(cx.docs.referencedIn(id)).map((id) => ({ target: id, alias: cx.provider.alias(id) }))
  }

const getSlug =
  (cx: RouteContext) =>
  (id: number): string =>
    getSegments(cx, id).join('/')

const getSidebar =
  (cx: RouteContext) =>
  (id: number): Sidebar | undefined => {
    const idx = cx.docs.rootIndex(id)
    if (typeof idx === 'number') return { order: idx + 1 }
    if (!cx.docs.isExposed(id)) return undefined

    const parents = getExposedPath(cx, id)
    const parent = parents[parents.length - 1]
    const decl = cx.docs.get(id)!

    if ((!parent && decl.kind === 'module') || decl.kind === 'export') return undefined

    if (!parent) return undefined

    return { parent: cx.provider.slug(parent.exposer) }
  }

const getAlias =
  (cx: RouteContext) =>
  (id: number): string => {
    if (cx.docs.isRoot(id)) cx.docs.rootAlias(id)!.as.replace(/^\.\//, '')

    if (cx.docs.isExposed(id)) {
      return getExposedPath(cx, id)
        .map((e) => e.alias)
        .join('.')
    }

    const decl = cx.docs.get(id)!
    if (decl.kind === 'module') {
      const segments = getSegments(cx, id)
      return segments.join('/')
    }

    return decl.name
  }

const getSegments = (cx: RouteContext, id: number): string[] => {
  if (cx.docs.isRoot(id)) return rootAliasSegments(cx, id)
  const pth = getExposedPath(cx, id)
  if (pth.length > 0) {
    const root = rootAliasSegments(cx, pth[0]!.exposer)
    return [...root, ...pth.map((e) => e.alias)].filter((e) => e !== undefined)
  } else {
    const path = cx.docs.parents(id)
    return path
      .map((e) => {
        const dec = cx.docs.get(e)!
        if (cx.docs.isRoot(e)) return rootAliasSegments(cx, e)
        if (dec.kind === 'module') return pathSegments(cx, dec.path)
        return dec.name
      })
      .flat()
  }
}

const rootAliasSegments = (cx: RouteContext, id: number): string[] => pathSegments(cx, cx.docs.rootAlias(id)!.as)

const getExposedPath = (cx: RouteContext, id: number): Exposure[] =>
  cx.docs.exposures(id).sort((a, b) => rank(cx, b) - rank(cx, a))[0] ?? []

const rank = (cx: RouteContext, pth: Exposure[]) => {
  if (pth.length === 0) return 0
  const root = pth[0]!.exposer
  const rootAlias = cx.docs.rootAlias(root)
  if (!rootAlias) return 0
  return rootAlias.index
}

const pathSegments = (cx: RouteContext, path: string) => {
  let segs = path
    .replace(/^\.\//, '')
    .replace(/\.\w+$/, '')
    .split('/')
  if (segs[segs.length - 1] === 'index') segs.pop()
  if (segs[segs.length - 1] === '.') segs[segs.length - 1] = ''
  const com = cx.docs.commonDir().split('/')
  while (com.length > 0 && segs.length > 0 && com[0] === segs[0]) {
    com.shift()
    segs.shift()
  }

  return segs
}
