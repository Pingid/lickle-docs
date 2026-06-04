import type { RouteNode, PageType } from './types.ts'
import * as reflect from '../reflect/index.ts'
import * as config from '../../config/load.ts'
import * as naming from './naming.ts'

type Page = 'doc'

export type Options = {
  rootName: string
  entrypoints?: config.Entry[]
  /** Override how routes are named / grouped / shown. Defaults to {@link createRouteProvider}. */
  provider?: RouteProvider
  /**
   * `'exposed'` (default) routes only the public API reachable through exports.
   * `'full'` routes every scanned declaration, grouped under its own module —
   * including internal, non-exported ones.
   */
  mode?: 'exposed' | 'full'
  /** Slugs already taken by routes built elsewhere (e.g. a README home page). */
  reserved?: Iterable<string>
}

// ----------------------------------------------------------------------------
// Provider abstraction
// ----------------------------------------------------------------------------

/** Everything a provider needs to decide a single route, computed top-down. */
export type RouteContext = {
  /** The declaration this route points at. */
  decl: reflect.Declaration
  /** Exposure alias on this path (set by renames / `export * as`). */
  alias?: string
  /** Resolved parts of the parent route; `undefined` at an entry module. */
  parent?: naming.Parts
  /** The reflect index, for providers that need to inspect the graph. */
  index: reflect.Index
  /** Naming options (project name, entry aliases, common dir). */
  options: naming.NameOptions
}

/**
 * Customisation seam for the route tree. The traversal, de-duplication and
 * page wiring stay in {@link buildRoutes}; a provider only decides per-route
 * presentation. Every hook is optional and receives the stock result as
 * `defaults`, so an override can build on the default instead of replacing it:
 *
 * ```ts
 * createRouteProvider({ name: (cx, defaults) => ({ ...defaults, label: defaults.label.toUpperCase() }) })
 * ```
 */
export interface RouteProvider {
  /** Label, slug and qualified name for the route. */
  name?(cx: RouteContext, defaults: naming.Parts): naming.Parts
  /** Whether the route appears in navigation (the sidebar). */
  nav?(cx: RouteContext, defaults: boolean): boolean
  /** Optional group heading rendered above the route in navigation. */
  group?(cx: RouteContext): string | undefined
}

/** A provider with every hook resolved — what {@link buildRoutes} consumes. */
export type ResolvedRouteProvider = {
  name(cx: RouteContext): naming.Parts
  nav(cx: RouteContext): boolean
  group(cx: RouteContext): string | undefined
}

/** Default naming: entry modules from their path/alias, everything else nested under its parent. */
const defaultName = (cx: RouteContext): naming.Parts =>
  cx.parent === undefined
    ? naming.rootParts(cx.decl as reflect.Declaration<'module'>, cx.options)
    : naming.childParts(cx.alias ?? cx.decl.name, cx.parent)

/**
 * Resolve a (partial) provider: unset hooks fall back to the stock behaviour
 * (path-derived names, everything navigable, no groups), and each set hook
 * receives that stock result as its `defaults` argument.
 */
export const createRouteProvider = (provider: RouteProvider = {}): ResolvedRouteProvider => ({
  name: (cx) => {
    const def = defaultName(cx)
    return provider.name?.(cx, def) ?? def
  },
  nav: (cx) => provider.nav?.(cx, true) ?? true,
  group: (cx) => provider.group?.(cx),
})

// ----------------------------------------------------------------------------
// Build
// ----------------------------------------------------------------------------

/**
 * Build the navigation tree from the reflect index. The shape mirrors the
 * exposure graph (`index.exposed`) rather than the raw declaration tree, so
 * `export * from`, `export * as ns`, renames and namespaces are already
 * resolved. Each declaration is routed once — the first exposure path wins —
 * which keeps slugs unique and avoids duplicate pages.
 */
export const buildRoutes = (index: reflect.Index, opts: Options): RouteNode<Page>[] => {
  const options: naming.NameOptions = {
    rootName: opts.rootName,
    aliases: new Map((opts.entrypoints ?? []).map((e) => [e.path, e.as.replace(/^\.\//, '')])),
    commonDir: index.commonDir(),
  }
  const provider = createRouteProvider(opts.provider)
  const full = opts.mode === 'full'
  const seen = new Set<number>()

  // Keep slugs unique across the whole tree (and any reserved/README slugs).
  // The empty root slug falls back to `index` so a README can own `/`.
  const usedSlugs = new Set<string>(opts.reserved ?? [])
  const uniqueSlug = (slug: string): string => {
    if (!usedSlugs.has(slug)) return (usedSlugs.add(slug), slug)
    const base = slug || 'index'
    let next = base
    for (let n = 2; usedSlugs.has(next); n++) next = `${base}-${n}`
    return (usedSlugs.add(next), next)
  }

  // Children of a route: the exposure graph in `exposed` mode, the raw
  // declaration tree (minus re-export clauses) in `full` mode.
  const childrenOf = (id: number): Iterable<{ id: number; alias?: string }> => {
    if (!full) return index.exposed(id)
    const out: { id: number }[] = []
    for (const c of index.children(id)) if (c.kind !== 'export') out.push({ id: c.id })
    return out
  }

  // Canonical parts for every routed declaration, so a page re-exposed
  // elsewhere can link back to where it actually lives. Seeded with the roots
  // up front (below) so a root re-exported by another resolves to its own slug.
  const routed = new Map<number, naming.Parts>()

  const nameOf = (id: number, parent?: naming.Parts, alias?: string): naming.Parts => {
    const named = provider.name({ decl: index.get(id)!, alias, parent, index, options })
    return { ...named, slug: uniqueSlug(named.slug) }
  }

  // A single `doc` page kind: module vs. declaration is derived from the id's
  // reflect kind at render time, so the route doesn't duplicate that fact.
  const makePage = (id: number, parts: naming.Parts): PageType<Page> => ({
    kind: 'doc',
    id,
    alias: parts.label,
    qualified: parts.qualified,
    referencedIn: [...index.referencedIn(id)],
  })

  // A page already owned by another route, surfaced here as a link only: it
  // shows in the parent's child list but stays out of the sidebar and carries
  // no subtree, so clicking it lands on the canonical route.
  const linkNode = (
    id: number,
    parent: naming.Parts,
    alias: string | undefined,
    canon: naming.Parts,
  ): RouteNode<Page> => {
    const cx: RouteContext = { decl: index.get(id)!, alias, parent, index, options }
    const group = provider.group(cx)
    return {
      label: provider.name(cx).label,
      slug: canon.slug,
      page: makePage(id, canon),
      children: [],
      sidebar: false,
      ...(group ? { group } : {}),
    }
  }

  const buildRoute = (id: number, parent?: naming.Parts, alias?: string): RouteNode<Page> => {
    const decl = index.get(id)!
    const cx: RouteContext = { decl, alias, parent, index, options }
    const parts = routed.get(id) ?? nameOf(id, parent, alias)
    routed.set(id, parts)

    seen.add(id)
    const children: RouteNode<Page>[] = []
    for (const e of childrenOf(id)) {
      if (e.id === id) continue
      if (seen.has(e.id)) {
        const canon = routed.get(e.id)
        if (canon) children.push(linkNode(e.id, parts, e.alias, canon))
        continue
      }
      children.push(buildRoute(e.id, parts, e.alias))
    }

    const group = provider.group(cx)
    return {
      label: parts.label,
      slug: parts.slug,
      page: makePage(id, parts),
      children,
      sidebar: provider.nav(cx),
      ...(group ? { group } : {}),
    }
  }

  // `full` lists every module; `exposed` only the entrypoints. Name (and slug-
  // reserve) every root up front so one re-exported by another stays top-level
  // and re-exposures resolve to its canonical slug.
  const roots = full ? [...index.declarations()].filter((d) => d.kind === 'module') : [...index.roots()]
  for (const r of roots) (seen.add(r.id), routed.set(r.id, nameOf(r.id)))

  // Build a root *after* any entrypoint modules it re-exports, so a declaration
  // reachable both directly (a barrel `export *`) and through its own module is
  // owned by the module — the barrel only links to it. Display order is kept as
  // the config order regardless.
  const built = new Map<number, RouteNode<Page>>()
  for (const id of buildOrder(roots, index)) built.set(id, buildRoute(id))
  return roots.map((root) => built.get(root.id)!)
}

/**
 * Roots topologically sorted so an entrypoint module is built before any other
 * root that re-exports its declarations (a barrel `export *`). That way each
 * declaration is owned by the module that defines it, and the barrel only links.
 */
const buildOrder = (roots: reflect.Declaration[], index: reflect.Index): number[] => {
  const rootIds = new Set(roots.map((r) => r.id))

  // The entrypoint module a declaration is defined in (walk to its module ancestor).
  const moduleOf = (id: number): number | undefined => {
    let d = index.get(id)
    while (d && d.kind !== 'module') d = index.get(d.parent)
    return d?.id
  }

  // Roots whose declarations `rootId` re-exposes from elsewhere.
  const deps = (rootId: number): Iterable<number> => {
    const out = new Set<number>()
    for (const e of index.exposed(rootId)) {
      const m = moduleOf(e.id)
      if (m !== undefined && m !== rootId && rootIds.has(m)) out.add(m)
    }
    return out
  }

  const order: number[] = []
  const placed = new Set<number>()
  const stack = new Set<number>()
  const visit = (id: number): void => {
    if (placed.has(id) || stack.has(id)) return
    stack.add(id)
    for (const dep of deps(id)) visit(dep)
    stack.delete(id)
    placed.add(id)
    order.push(id)
  }
  for (const r of roots) visit(r.id)
  return order
}
