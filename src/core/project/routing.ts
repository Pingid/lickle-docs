import type { RouteNode, PageType } from './json.ts'
import * as reflect from '../reflect/index.ts'
import * as config from '../../config/load.ts'
import * as naming from './naming.ts'

type Page = 'declaration' | 'module'

export type Options = {
  rootName: string
  entrypoints?: config.Entry[]
  /** Override how routes are named / grouped / shown. Defaults to {@link createRouteProvider}. */
  provider?: RouteProvider
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
 * page wiring stay in {@link build}; a provider only decides per-route
 * presentation. Build one with {@link createRouteProvider} and override the
 * parts you care about.
 */
export interface RouteProvider {
  /** Label, slug and qualified name for the route. */
  name(cx: RouteContext): naming.Parts
  /** Whether the route appears in navigation (the sidebar). */
  nav(cx: RouteContext): boolean
  /** Optional group heading rendered above the route in navigation. */
  group(cx: RouteContext): string | undefined
}

/** Default naming: entry modules from their path/alias, everything else nested under its parent. */
const defaultName = (cx: RouteContext): naming.Parts =>
  cx.parent === undefined
    ? naming.rootParts(cx.decl as reflect.Declaration<'module'>, cx.options)
    : naming.childParts(cx.alias ?? cx.decl.name, cx.parent)

/**
 * Compose a provider from optional overrides; unset hooks fall back to the
 * stock behaviour (path-derived names, everything navigable, no groups).
 */
export const createRouteProvider = (overrides: Partial<RouteProvider> = {}): RouteProvider => ({
  name: overrides.name ?? defaultName,
  nav: overrides.nav ?? (() => true),
  group: overrides.group ?? (() => undefined),
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
export const build = (index: reflect.Index, opts: Options): RouteNode<Page>[] => {
  const options: naming.NameOptions = {
    rootName: opts.rootName,
    aliases: new Map((opts.entrypoints ?? []).map((e) => [e.path, e.as.replace(/^\.\//, '')])),
    commonDir: index.commonDir(),
  }
  const provider = opts.provider ?? createRouteProvider()

  // Reserve every entry module up front so a root that's also re-exported by
  // another stays top-level instead of nesting under it.
  const roots = [...index.roots()]
  const seen = new Set<number>(roots.map((r) => r.id))

  const buildRoute = (id: number, parent?: naming.Parts, alias?: string): RouteNode<Page> => {
    const decl = index.get(id)!
    const cx: RouteContext = { decl, alias, parent, index, options }
    const parts = provider.name(cx)

    seen.add(id)
    const children: RouteNode<Page>[] = []
    for (const e of index.exposed(id)) {
      if (seen.has(e.id)) continue
      children.push(buildRoute(e.id, parts, e.alias))
    }

    const kind: Page = decl.kind === 'module' ? 'module' : 'declaration'
    const page: PageType<Page> = {
      kind,
      id,
      alias: parts.label,
      qualified: parts.qualified,
      referencedIn: [...index.referencedIn(id)],
    }
    const group = provider.group(cx)
    return { label: parts.label, slug: parts.slug, page, children, nav: provider.nav(cx), ...(group ? { group } : {}) }
  }

  return roots.map((root) => buildRoute(root.id))
}

export const displayRoutes = (routes: RouteNode[], prefix: string = '') => {
  const kinds = { module: 'M', markdown: '.MD', declaration: 'D' }
  for (const r of routes) {
    const id = (r.page as { id?: number }).id ?? r.label
    console.log(`${prefix}${kinds[r.page.kind]} ${id} (${r.slug})`)
    if (r.children) displayRoutes(r.children, prefix + '  ')
  }
}
