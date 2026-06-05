import type { RouteNode, PageType } from './types.ts'
import * as reflect from '../reflect/index.ts'
import * as config from '../../config/load.ts'
import * as naming from './naming.ts'
import { kindLayout } from './builder.ts'

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
  /**
   * URL prefix applied to every entrypoint route (and, transitively, its
   * children). Defaults to `'l'`, giving URLs like `/l/<entry>/<symbol>` —
   * leaving `/` free for a README or other landing page.
   *
   * If the empty slug `''` isn't already reserved (no README owns `/`), the
   * first entrypoint is promoted to `/` instead of being prefixed, so the
   * docs always have a base route. Set to `''` to disable prefixing entirely.
   */
  basePath?: string
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
 * What a route's child slot can hold after reshaping:
 *   - `{ id, alias? }` — a real declaration child (built into a page).
 *   - `{ group, children }` — a synthetic group wrapping nested children.
 *
 * A synthetic group becomes a label-only navigation node: it has children but
 * no `page` and no `slug`, so it's a collapsible heading in the sidebar that
 * isn't itself a navigation target. Its children keep their own slugs nested
 * under the *module* (the group doesn't appear in slugs or qualified names),
 * so wrapping `Foo` in a `"Types"` group never turns it into `module/Types/Foo`.
 * Use it to lay out a labelled section (`"Core API"`, `"Types"`) with no
 * backing declaration.
 */
export type ChildSpec = { id: number; alias?: string } | { group: string; children: ChildSpec[] }

/**
 * Customisation seam for the route tree. The traversal, de-duplication and
 * page wiring stay in {@link buildRoutes}; a provider decides per-route
 * presentation and (optionally) per-route child shape. Build one with
 * {@link createRouteProvider} and override the parts you care about.
 */
export interface RouteProvider {
  /** Label, slug and qualified name for the route. */
  name(cx: RouteContext): naming.Parts
  /** Whether the route appears in navigation (the sidebar). */
  nav(cx: RouteContext): boolean
  /** Optional group heading rendered above the route in navigation. */
  group(cx: RouteContext): string | undefined
  /**
   * Reshape the children of a route before they're built. Receives the
   * children the default traversal would use — the exposure graph in
   * `exposed` mode, the raw declaration tree (minus re-export clauses) in
   * `full` mode — and returns the children to actually build, in order.
   *
   * Filter, reorder, relocate (pull a grandchild up by returning its id), or
   * wrap runs in synthetic groups. Slug and ownership allocation still happen
   * downstream, so a declaration relocated here is still owned by whichever
   * route reaches it first in build order; later reaches become links. This
   * hook only decides shape, never identity.
   */
  children?(cx: RouteContext, kids: ChildSpec[]): ChildSpec[]
}

/** URL prefix the default provider nests every generated doc route under. */
const DOC_BASE = 'l'

/**
 * Default naming: entry modules from their path/alias, everything else nested
 * under its parent. The whole API lives under `/l/` so the site root (`/`) is
 * free for a README or a redirect to the first entrypoint. Children inherit the
 * prefix via their parent's slug, so only root slugs need it applied here.
 */
const defaultName = (cx: RouteContext): naming.Parts => {
  if (cx.parent !== undefined) return naming.childParts(cx.alias ?? cx.decl.name, cx.parent)
  const parts = naming.rootParts(cx.decl as reflect.Declaration<'module'>, cx.options)
  return { ...parts, slug: parts.slug ? `${DOC_BASE}/${parts.slug}` : DOC_BASE }
}

/**
 * Compose a provider from optional overrides; unset hooks fall back to the
 * stock behaviour: path-derived names, everything navigable, no `group`
 * headings, and {@link kindLayout} grouping children by declaration kind (the
 * same labels and order the page content listing uses).
 */
export const createRouteProvider = (overrides: Partial<RouteProvider> = {}): RouteProvider => ({
  name: overrides.name ?? defaultName,
  nav: overrides.nav ?? (() => true),
  group: overrides.group ?? (() => undefined),
  children: overrides.children ?? kindLayout,
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
  const provider = opts.provider ?? createRouteProvider()
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

  // Default routing puts every entrypoint under `/<basePath>/...` so `/` is
  // free for a README. When no route already owns `''`, the first entrypoint
  // is promoted to `/` instead of being prefixed — child slugs of a promoted
  // entry nest from `''`, so they also drop the prefix.
  const basePath = opts.basePath
  const promoteFirstToRoot = !!basePath && !usedSlugs.has('')
  let promoted = false

  const applyBase = (slug: string): string => {
    if (!basePath) return slug
    if (promoteFirstToRoot && !promoted) {
      promoted = true
      return ''
    }
    return slug ? `${basePath}/${slug}` : basePath
  }

  // Children of a route: the exposure graph in `exposed` mode, the raw
  // declaration tree (minus re-export clauses) in `full` mode.
  const childrenOf = (id: number): ChildSpec[] => {
    if (!full) return [...index.exposed(id)]
    const out: ChildSpec[] = []
    for (const c of index.children(id)) if (c.kind !== 'export') out.push({ id: c.id })
    return out
  }

  // Canonical parts for every routed declaration, so a page re-exposed
  // elsewhere can link back to where it actually lives. Seeded with the roots
  // up front (below) so a root re-exported by another resolves to its own slug.
  const routed = new Map<number, naming.Parts>()

  const nameOf = (id: number, parent?: naming.Parts, alias?: string): naming.Parts => {
    const named = provider.name({ decl: index.get(id)!, alias, parent, index, options })
    const slug = parent === undefined ? applyBase(named.slug) : named.slug
    return { ...named, slug: uniqueSlug(slug) }
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

    // Hand the default child set to the provider for reshaping, then build.
    const raw = childrenOf(id)
    const specs = provider.children ? provider.children(cx, raw) : raw
    const children = buildChildSpecs(specs, parts, id)

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

  // Lower a (possibly reshaped) child-spec list into route nodes. Real ids run
  // through the same seen/ownership logic as before — first reach owns the
  // page, later reaches become links. A synthetic `{ group }` becomes a
  // label-only node (no page, no slug) whose children are built normally; its
  // children's slugs still nest under `parent`, so the group is purely
  // presentational.
  const buildChildSpecs = (specs: ChildSpec[], parent: naming.Parts, selfId: number): RouteNode<Page>[] => {
    const out: RouteNode<Page>[] = []
    for (const spec of specs) {
      if ('group' in spec) {
        const children = buildChildSpecs(spec.children, parent, selfId)
        if (children.length) out.push({ label: spec.group, children, sidebar: true })
        continue
      }
      if (spec.id === selfId) continue
      if (seen.has(spec.id)) {
        const canon = routed.get(spec.id)
        if (canon) out.push(linkNode(spec.id, parent, spec.alias, canon))
        continue
      }
      out.push(buildRoute(spec.id, parent, spec.alias))
    }
    return out
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
