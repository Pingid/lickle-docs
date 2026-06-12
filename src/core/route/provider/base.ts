import { type RouteContext, type Provider, type Adapter, provideAdapter } from './core.ts'
import type { DocRoute, Sidebar, DocLink } from '../types.ts'
import type * as Reflect from '../../reflect/index.ts'
import { type DeclarationFacade } from './facade.ts'

export const provide = (c: RouteContext, adapter: Adapter): Provider => provideAdapter(provider(c), adapter)

const provider = (cx: RouteContext): Provider => ({
  alias: getAlias(cx),
  slug: getSlug(cx),
  route: getRoute(cx),
  sidebar: getSidebar(),
  links: getLinks(),
  referenced: getReferenced(),
  declaration: (d) => d,
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
 * Default slugs mirror the exposure graph instead of one canonical chain:
 * an entrypoint mounts at its label; a declaration with exactly one direct
 * exposer nests under that exposer's slug under its local alias,
 * recursively; a declaration several modules expose directly has no single
 * home, so it claims the bare name (the builder relocates colliding bare
 * slugs to source-path slugs); unexposed declarations place by source path.
 */
const getSlug = (cx: RouteContext) => {
  const segments = makeSegments(cx)
  return (decl: DeclarationFacade): string => segments(decl.id).join('/')
}

const makeSegments = (cx: RouteContext) => {
  const memo = new Map<Reflect.Id, string[]>()
  const visiting = new Set<Reflect.Id>()
  // Defaults recurse through raw index data, never through cx.provider.slug,
  // so an adapter's slug hook applies exactly once on top of the result.
  const segments = (id: Reflect.Id): string[] => {
    const hit = memo.get(id)
    if (hit) return hit
    // Pathological export cycle: bail to source-path placement.
    if (visiting.has(id)) return lexicalSegments(cx, id)
    visiting.add(id)
    try {
      const out = compute(id)
      memo.set(id, out)
      return out
    } finally {
      visiting.delete(id)
    }
  }
  const compute = (id: Reflect.Id): string[] => {
    const d = cx.docs.get(id)
    if (!d) return []
    if (cx.docs.isRoot(id)) return rootAliasSegments(cx, id)
    const by = cx.docs.exposedBy(id)
    if (by.length === 1) return [...segments(by[0]!.exposer), by[0]!.alias ?? d.name]
    if (by.length > 1) {
      // Multi-exposed: the bare name. File modules have no usable `name`;
      // use a unanimous re-export alias, else their source path.
      if (d.kind !== 'module') return [d.name]
      const aliases = new Set(by.map((e) => e.alias))
      const [alias] = aliases
      return aliases.size === 1 && alias !== undefined ? [alias] : pathSegments(cx, d.path)
    }
    return lexicalSegments(cx, id)
  }
  return segments
}

/**
 * Default sidebar: entrypoints are roots (in entrypoint order); every
 * module and namespace owns an edge for each member it exposes, so a
 * declaration appears under every exposer. Duplicates are by design; the
 * router's ancestry guard stops cycles.
 */
const getSidebar =
  () =>
  (decl: DeclarationFacade): Sidebar | undefined => {
    if (decl.kind === 'export') return undefined

    const children = sidebarChildren(decl)
    const idx = decl.entryIndex()
    if (typeof idx === 'number') return { root: idx + 1, ...(children.length ? { children } : {}) }
    return children.length ? { children } : undefined
  }

/** Child edges of a module/namespace: every member it exposes, alphabetical. */
const sidebarChildren = (decl: DeclarationFacade): DocLink[] => {
  if (decl.kind !== 'module' && decl.kind !== 'namespace') return []
  return decl.exposure
    .children()
    .filter((c) => !c.isEntry() && c.kind !== 'export')
    .map((c) => ({ target: c.id, alias: c.alias() ?? c.name }))
    .sort((a, b) => a.alias.localeCompare(b.alias))
}

/**
 * Default titles: an entrypoint shows its label; an exposed declaration
 * shows the qualified hop chain (`Adapter.filter`) when every exposure
 * chain spells it the same, and its bare name when exposers disagree;
 * unexposed modules show their source path, other declarations their name.
 */
const getAlias =
  (cx: RouteContext) =>
  (decl: DeclarationFacade): string => {
    if (decl.isEntry()) return decl.entry()!.as.replace(/^\.\//, '').replace(/^\.$/, cx.name)

    const chains = decl.exposure.ancestors()
    if (chains.length > 0) {
      const quals = chains.map((chain) => chain.map((f) => f.alias() ?? f.name).join('.'))
      return quals.every((q) => q === quals[0]) ? quals[0]! : decl.name
    }

    if (decl.kind === 'module') return lexicalSegments(cx, decl.id).join('/')

    return decl.name
  }

/**
 * Source-path placement: the defining-parent chain, from the file module
 * down to the declaration. Used when no entrypoint exposes the declaration,
 * and by the builder as the landing spot for colliding bare slugs.
 */
const lexicalSegments = (cx: Pick<RouteContext, 'docs'>, id: Reflect.Id): string[] => {
  const d = cx.docs.get(id)
  if (!d) return []
  const own = cx.docs.isRoot(id)
    ? rootAliasSegments(cx, id)
    : d.kind === 'module'
      ? pathSegments(cx, (d as Reflect.Declaration<'module'>).path)
      : [d.name]
  const parent = cx.docs.get(d.parent) ? lexicalSegments(cx, d.parent) : []
  return [...parent, ...own]
}

/** Source-path slug for a declaration — the builder's collision fallback. */
export const lexicalSlug = (cx: Pick<RouteContext, 'docs'>, id: Reflect.Id): string => lexicalSegments(cx, id).join('/')

const rootAliasSegments = (cx: Pick<RouteContext, 'docs'>, id: number): string[] =>
  pathSegments(cx, cx.docs.rootAlias(id)!.as)

const pathSegments = (cx: Pick<RouteContext, 'docs'>, path: string) => {
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
