import { type RouteContext, type Provider, type Adapter, type ExposurePath, provideAdapter } from './core.ts'
import { type DeclarationFacade, type ModuleFacade } from './facade.ts'
import type { DocRoute, Sidebar, DocLink } from '../types.ts'

export const provide = (c: RouteContext, adapter: Adapter): Provider => provideAdapter(provider(c), adapter)

const provider = (cx: RouteContext): Provider => ({
  exposure: getExposure(),
  alias: getAlias(cx),
  slug: getSlug(cx),
  declare: getRoute(cx),
  sidebar: getSidebar(cx),
  links: getLinks(),
  referenced: getReferenced(),
})

const getRoute =
  (cx: RouteContext) =>
  (decl: DeclarationFacade): DocRoute | undefined => {
    if (decl.kind === 'export') return undefined

    const sidebar = cx.provider.sidebar(decl)
    const title = cx.provider.alias(decl)
    const slug = cx.provider.slug(decl)
    const links = cx.provider.links(decl)
    const referenced = cx.provider.referenced(decl)

    return { kind: 'doc', decl: decl.id, title, slug, sidebar, links, referenced }
  }

const getLinks =
  () =>
  (decl: DeclarationFacade): DocLink[] => {
    if (decl.kind === 'module' || decl.kind === 'namespace') {
      return decl.exposure.children().map((e) => ({ target: e.id, alias: e.alias() ?? e.name }))
    }
    return []
  }

const getReferenced =
  () =>
  (decl: DeclarationFacade): DocLink[] => {
    return Array.from(decl.referenced()).map((r) => ({ target: r.id, alias: r.alias() ?? r.name }))
  }

/**
 * Default canonical-placement policy: the shortest re-export chain wins,
 * ties broken toward the earliest entrypoint. The page lives at this path;
 * every other exposer lists it as a link. Refine via the adapter's
 * `exposure` hook — slug, alias and sidebar all derive from it.
 */
const getExposure =
  () =>
  (decl: DeclarationFacade): ExposurePath =>
    decl.exposure.ancestors().sort((a, b) => a.length - b.length || rank(a) - rank(b))[0] ?? []

/** Entrypoint index of a path's root, for canonical-path tie-breaks. */
const rank = (pth: ModuleFacade[]) => pth[0]?.entry()?.index ?? 0

const getSlug =
  (cx: RouteContext) =>
  (decl: DeclarationFacade): string =>
    getSegments(cx, decl).join('/')

const getSidebar =
  (cx: RouteContext) =>
  (decl: DeclarationFacade): Sidebar | undefined => {
    const idx = decl.entryIndex()
    if (typeof idx === 'number') return { order: idx + 1 }

    if (decl.kind === 'export') return undefined

    const path = cx.provider.exposure(decl)
    const parent = path[path.length - 1]
    if (!parent) return undefined

    return { parent: cx.provider.slug(parent) }
  }

const getAlias =
  (cx: RouteContext) =>
  (decl: DeclarationFacade): string => {
    if (decl.isEntry()) return decl.entry()!.as.replace(/^\.\//, '').replace(/^\.$/, cx.name)

    const path = cx.provider.exposure(decl)
    if (path.length > 0) return path.map((f) => f.alias() ?? f.name).join('.')

    if (decl.kind === 'module') return getSegments(cx, decl).join('/')

    return decl.name
  }

const getSegments = (cx: RouteContext, decl: DeclarationFacade): string[] => {
  if (decl.isEntry()) return rootAliasSegments(cx, decl.id)
  const path = cx.provider.exposure(decl)
  // console.log(path)
  // A path rooted anywhere but an entrypoint has no mount point; fall back
  // to source-path placement rather than fabricating segments.
  if (path.length > 0 && path[0]!.isEntry()) {
    // console.log(path.map((f) => f.alias() ?? f.name))
    if (path.map((f) => f.alias() ?? f.name)[0] === 'Types') {
      // console.log(cx.docs.exposures(decl.id))
    }
    return [...rootAliasSegments(cx, path[0]!.id), ...path.map((f) => f.alias() ?? f.name)]
  }
  // The defining-parent chain is a tree-index concept with no facade hop, so
  // it stays id-based.
  return decl.exposure.parents().flatMap((e) => {
    if (e.kind === 'namespace') return e.alias() ?? e.name
    if (e.kind === 'module') {
      console.log(e.alias() ?? e.name)
    }
    if (e.isEntry()) return rootAliasSegments(cx, e.id)
    return e.alias() ?? e.name
  })
}

const rootAliasSegments = (cx: RouteContext, id: number): string[] => pathSegments(cx, cx.docs.rootAlias(id)!.as)

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
