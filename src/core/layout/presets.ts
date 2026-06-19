import type { Layout, Placement, Place, Parent, Alias } from './types.ts'
import type { DeclarationFacade } from './facade.ts'
import type { GroupBy } from './group.ts'
import { effectiveNav } from './tree.ts'

/**
 * The presets layer: small {@link Layout}-returning helpers covering the common
 * placement refinements, so most configs never construct a `Placement` by hand.
 * Compose them with {@link compose}. Each is a thin opinion over the framework
 * default — it returns `cx.default()` for inputs it doesn't touch, so lower
 * layers survive.
 */

/** Predicate over a declaration, used by the matching presets. */
export type Match = (d: DeclarationFacade) => boolean

/**
 * Shared shape of every matching preset: refine the placement of doc sources
 * that have a content home and match, pass everything else through. Narrows
 * `base.page` to non-null once, so `fn` reads it directly.
 */
const onMatch =
  (match: Match, fn: (base: Placement & { page: Place }, d: DeclarationFacade) => Placement): Layout =>
  (source, cx) => {
    const base = cx.default()
    if (source.kind !== 'doc' || base.page === null || !match(source.decl)) return base
    return fn(base as Placement & { page: Place }, source.decl)
  }

/**
 * Keep only declarations `keep` accepts. Rejected declarations are excluded
 * (`{ page: null }`) — no page, no listing, no sidebar. Markdown is untouched.
 *
 * @example
 * ```ts
 * Layout.filter((d) => !d.tags.has('@internal') && d.exposure.is())
 * ```
 */
export const filter =
  (keep: Match): Layout =>
  (source, cx) =>
    source.kind === 'doc' && !keep(source.decl) ? { page: null } : cx.default()

/**
 * Assign every doc node's sidebar bucket from a {@link GroupBy}. Sets the group
 * on the node's own `Nav` entries, so the same `GroupBy` also buckets parent
 * pages' member listings (read back from the nav) and the two stay in sync.
 *
 * @example
 * ```ts
 * Layout.grouping(Layout.composeGroups(Layout.groupByKind, Layout.groupByTag('@group')))
 * ```
 */
export const grouping = (group: GroupBy): Layout =>
  onMatch(
    () => true,
    (base, d) => ({ ...base, nav: effectiveNav(base).map((n) => ({ ...n, group: group(d, n.group) })) }),
  )

/**
 * Pin matching declarations to sidebar/member position `n` (lower sorts first),
 * overriding the default alphabetical order for them. Sets `Nav.order`.
 *
 * @example Float defineConfig to the top of its group
 * ```ts
 * Layout.order((d) => d.name === 'defineConfig', -1)
 * ```
 */
export const order = (match: Match, n: number): Layout =>
  onMatch(match, (base) => ({ ...base, nav: effectiveNav(base).map((nv) => ({ ...nv, order: n })) }))

/**
 * Override fields of the matching declarations' content {@link Place} — the
 * primitive the other placement presets build on.
 *
 * @example Move config types under a virtual folder
 * ```ts
 * Layout.place((d) => d.kind === 'type-alias', { parent: { virtual: 'types' } })
 * ```
 */
export const place = (match: Match, into: Partial<Place>): Layout =>
  onMatch(match, (base) => ({ ...base, page: { ...base.page, ...into } }))

/** Give matching declarations a fixed URL segment. */
export const slug = (match: Match, slug: string): Layout => place(match, { slug })

/** Rename matching declarations' page title / sidebar label. */
export const rename = (match: Match, name: string): Layout => place(match, { name })

/** Put matching declarations under a virtual sidebar folder (`/` nests). */
export const folder = (name: string, match: Match): Layout => place(match, { parent: { virtual: name } })

/**
 * Render matching declarations inline on their parent's page (`render: 'inline'`)
 * rather than as their own page: no route, no standalone sidebar entry, full
 * docs shown before the parent's member links.
 */
export const suppressPages = (match: Match): Layout => place(match, { render: 'inline' })

/** Keep matching declarations' pages but drop them from the sidebar. */
export const hideFromNav = (match: Match): Layout => onMatch(match, (base) => ({ ...base, nav: [] }))

/**
 * Add a curated top-level sidebar section. Matching declarations appear under
 * `title` at the root *in addition to* their normal place, so the page is
 * reachable from both. `names` is a name list (positions order the entries) or
 * a predicate.
 *
 * Both occurrences link to the same canonical slug; the sidebar keys the active
 * row by trail, but `findTrail` matches the first occurrence in DFS order, so
 * navigating via the section copy highlights the canonical branch. Cosmetic.
 *
 * @example
 * ```ts
 * Layout.section('Essentials', ['defineConfig', 'defineComponents'])
 * ```
 */
export const section = (title: string, names: string[] | Match, opts?: { order?: number }): Layout => {
  const matches: Match = typeof names === 'function' ? names : (d) => names.includes(d.name)
  const orderOf = (d: DeclarationFacade) => (typeof names === 'function' ? 0 : names.indexOf(d.name))
  return onMatch(matches, (base, d) => ({
    ...base,
    nav: [
      ...effectiveNav(base),
      { parent: { root: true }, name: base.page.name, group: { name: title, order: opts?.order ?? -1 }, order: orderOf(d) },
    ],
  }))
}

/**
 * Give matching declarations a secondary, navigable URL that points at their
 * canonical page (see {@link Alias}). Defaults the alias's parent and name to
 * the canonical placement's.
 *
 * @example A short URL that redirects to the canonical page
 * ```ts
 * Layout.alias((d) => d.name === 'defineConfig', { name: 'config', parent: { root: true } })
 * ```
 */
export const alias = (
  match: Match,
  spec: { name?: string; slug?: string; parent?: Parent; mode?: Alias['mode'] },
): Layout =>
  onMatch(match, (base) => ({
    ...base,
    aliases: [
      ...(base.aliases ?? []),
      { parent: spec.parent ?? base.page.parent, name: spec.name ?? base.page.name, slug: spec.slug, mode: spec.mode },
    ],
  }))
