import type * as Reflect from '../../reflect/index.ts'
import { memo1 } from '../../../_lib/util/index.ts'

import { type DeclarationFacade, type ModuleFacade } from './facade.ts'
import type { DocRoute, Sidebar, DocLink } from '../types.ts'

/**
 * One route-generation refinement. Receives the value the default provider
 * produced, the declaration it belongs to and the shared {@link RouteContext};
 * returns the value to use instead.
 */
export type Hook<V> = (value: V, declarationFacade: DeclarationFacade) => V

/**
 * A re-export chain from an entrypoint to a declaration — the shape
 * `d.exposure.ancestors()` returns. Each element is an exposing module,
 * carrying the alias of the next hop; the first element must be an
 * entrypoint module for the path to produce a slug. An empty path places
 * the declaration by source path and hides it from the sidebar.
 */
export type ExposurePath = ModuleFacade[]

/**
 * A record of hooks refining route generation, one per facet. Every hook is
 * optional; omitted facets keep the default behaviour. Combine adapters with
 * {@link compose} and pass the result as the config `provider`.
 */
export interface Adapter {
  /**
   * Canonical exposure path — where the declaration's page lives when it is
   * re-exported in several places. The default picks the shortest chain from
   * the earliest entrypoint; return another `d.exposure.ancestors()` path to
   * relocate the page. Slug, title and sidebar placement all follow.
   */
  exposure?: Hook<ExposurePath>
  /** Display title of a declaration's page and links to it. */
  alias?: Hook<string>
  /** URL path of a declaration's page. */
  slug?: Hook<string>
  /** Sidebar placement — parent, group and order. Return `undefined` to hide the entry. */
  sidebar?: Hook<Sidebar | undefined>
  /** The page emitted for a declaration. Return `undefined` to skip the page. */
  declare?: Hook<DocRoute | undefined>
  /** Member links listed on the declaration's page. */
  links?: Hook<DocLink[]>
  /** "Referenced in" backlinks shown on the declaration's page. */
  referenced?: Hook<DocLink[]>
}

/** Shared state passed to every hook: the reflection index, the resolved {@link Provider} and the project name. */
export type RouteContext = { docs: Reflect.Index; provider: Provider; name: string }

/** Inputs for {@link makeContext}. */
export type ContextOptions = {
  /** The reflection index of every scanned declaration. */
  docs: Reflect.Index
  /** The project name, used as the route prefix. */
  name: string
  /** Optional refinements applied over the base provider. */
  adapter?: Adapter
}

/**
 * The resolved route-generation functions, each keyed by declaration id.
 * What an {@link Adapter} refines: hooks wrap these per-facet defaults.
 */
export type Provider = {
  /** Canonical exposure path for the declaration — empty when placed by source path. */
  exposure(id: DeclarationFacade): ExposurePath
  /** Display title for the declaration. */
  alias(id: DeclarationFacade): string
  /** URL path for the declaration's page. */
  slug(id: DeclarationFacade): string
  /** The page route for the declaration, or `undefined` when it has none. */
  declare(id: DeclarationFacade): DocRoute | undefined
  /** Sidebar placement, or `undefined` when hidden. */
  sidebar(id: DeclarationFacade): Sidebar | undefined
  /** Member links listed on the declaration's page. */
  links(id: DeclarationFacade): DocLink[]
  /** Backlinks from declarations that reference this one. */
  referenced(id: DeclarationFacade): DocLink[]
}

/**
 * Merge adapters left to right into one. For each facet, later hooks receive
 * the output of earlier hooks, so order matters: `compose(a, b)` runs `a`
 * first and lets `b` refine its result.
 */
export const compose = (...adapters: (Adapter | undefined)[]): Adapter => adapters.reduce<Adapter>(merge, {})

const hooks = ['exposure', 'alias', 'slug', 'declare', 'sidebar', 'referenced', 'links'] as const
const merge = (a: Adapter | undefined, b: Adapter | undefined): Adapter => {
  if (!a) return b ?? {}
  if (!b) return a ?? {}
  const out: any = { ...a }
  for (const hook of hooks) {
    if (b[hook]) out[hook] = mergeHook((a as any)[hook], (b as any)[hook])
  }
  return out
}

const mergeHook = <V>(a?: Hook<V>, b?: Hook<V>): Hook<V> | undefined => {
  if (!a && !b) return undefined
  if (!a) return b
  if (!b) return a
  return (curr, id) => b(a(curr, id), id)
}

/**
 * Apply an adapter over a base provider: each provider method is wrapped so
 * the matching hook post-processes its result. Facets without a hook pass
 * through untouched.
 */
export const provideAdapter = (base: Provider, adapter?: Adapter): Provider => {
  if (!adapter) return base
  return Object.fromEntries(
    hooks.map((hook) => [hook, applyHook(adapter?.[hook] as Hook<any>, base[hook])]),
  ) as Provider
}

const applyHook = <V>(hook: Hook<V> | undefined, def: (id: DeclarationFacade) => V): ((id: DeclarationFacade) => V) => {
  if (!hook) return def
  return (id) => hook(def(id), id)
}

/**
 * Memoize every provider method by declaration id. Route generation calls
 * the same facets repeatedly (slugs feed sidebar entries, links and
 * breadcrumbs), so results are computed once.
 */
export const withMemo = (ad: Provider): Provider =>
  Object.fromEntries(hooks.map((hook) => [hook, memo1(ad[hook as keyof Provider])])) as Provider
