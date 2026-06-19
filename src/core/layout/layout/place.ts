import type { Placement, Place, Parent, Alias, Layout } from '../types.ts'
import type { DeclarationFacade } from '../facade.ts'

import * as Select from './select.ts'
import * as Match from './match.ts'

/**
 * The placement layer: small {@link Layout}-returning helpers covering the common
 * placement refinements, so most configs never construct a `Placement` by hand.
 * Compose them with {@link compose}; each is a thin opinion over the framework
 * default, returning `cx.default()` for inputs it doesn't touch so lower layers
 * survive. Predicates come from {@link Match}; per-declaration values (bucket
 * names, …) from {@link Select}.
 */

/** Compose layouts into one. A later layout wraps the earlier ones and wins on conflict. */
export const compose = (...layouts: Layout[]): Layout =>
  layouts.reduce<Layout>(
    (below, layout) => (p, cx) => layout(p, { ...cx, default: () => below(p, cx) ?? cx.default() }),
    (_, cx) => cx.default(),
  )

// ─────────────────────────────────────────────────────────────────────────
// Placement presets — match-first throughout
// ─────────────────────────────────────────────────────────────────────────

/**
 * Keep only declarations `keep` accepts. Rejected declarations are excluded
 * (`{ page: null }`) — no page, no listing, no sidebar. Markdown is untouched.
 *
 * @example
 * ```ts
 * Place.filter(Match.all(Match.exposed(), Match.not(Match.tag('@internal'))))
 * ```
 */
export const filter =
  (keep: Match.Match): Layout =>
  (source, cx) =>
    source.kind === 'doc' && !keep(source.decl, { page: null }) ? { page: null } : cx.default()

/**
 * Assign a sidebar bucket. Two forms:
 *  - `bucket(select)` — derive each declaration's bucket name from a {@link Select}
 *    (e.g. {@link Select.kind}); an `undefined` result leaves the bucket untouched.
 *  - `bucket(match, name)` — put matching declarations in the fixed `name` bucket.
 *
 * Sets the node's canonical `Place.group`, so the bucket drives both the sidebar
 * and parent pages' member listings (each appearance inherits it via
 * `effectiveNav`). Composes like every preset — a later `bucket` wins over an
 * earlier one. Bucket *order* is set separately, by {@link bucketOrder}.
 *
 * @example
 * ```ts
 * Place.bucket(Select.kind)                                     // by kind
 * Place.bucket(Match.kinds('interface', 'type-alias'), 'types') // a fixed bucket
 * ```
 */
export const bucket: {
  (select: Select.Select<string | undefined>): Layout
  (match: Match.Match, name: string): Layout
} = (arg: Match.Match | Select.Select<string | undefined>, name?: string): Layout =>
  Select.is(arg)
    ? onMatch(Match.all(), (base, d) => {
        const picked = (arg as Select.Select<string | undefined>)(d)
        return picked === undefined ? base : withGroup(base, picked)
      })
    : onMatch(arg as Match.Match, (base) => withGroup(base, name!))

/**
 * Order the sidebar buckets by name. Each argument is an exact bucket name or a
 * `RegExp`; a bucket sorts by the index of its first match. List the curated
 * sections first, then a catch-all `RegExp` last to sweep the remaining buckets.
 *
 * @example
 * ```ts
 * Place.bucketOrder('components', 'hooks', 'types', /.+/)
 * ```
 */
export const bucketOrder = (...names: (string | RegExp)[]): Layout =>
  onMatch(Match.all(), (base) => {
    const g = base.page.group
    if (!g) return base
    const i = names.findIndex((p) => (typeof p === 'string' ? p === g.name : p.test(g.name)))
    return i < 0 ? base : { ...base, page: { ...base.page, group: { ...g, order: i } } }
  })

/**
 * Override fields of matching declarations' content {@link Place} — the primitive
 * the other placement presets build on.
 *
 * @example Move config types under a virtual folder
 * ```ts
 * Place.place(Match.kinds('type-alias'), { parent: { virtual: 'types' } })
 * ```
 */
export const place = (match: Match.Match, into: Partial<Place>): Layout =>
  onMatch(match, (base) => ({ ...base, page: { ...base.page, ...into } }))

/** Give matching declarations a fixed URL segment. */
export const slug = (match: Match.Match, slug: string): Layout => place(match, { slug })

/** Rename matching declarations' page title / sidebar label. */
export const rename = (match: Match.Match, name: string): Layout => place(match, { name })

/** Put matching declarations under a virtual sidebar folder (`/` nests). */
export const folder = (match: Match.Match, name: string): Layout => place(match, { parent: { virtual: name } })

/**
 * Control how matching declarations appear. Defaults to a fully-visible page.
 *  - `page: false` — no route, but still resolvable for `{@link}` and breadcrumbs.
 *  - `inline: true` — rendered inline on the parent's page, with no route of its own.
 *  - `nav: false` — keep the page but drop it from the sidebar.
 *
 * @example Collapse small option types onto their owner
 * ```ts
 * Place.visibility(Match.tag('@inline'), { inline: true })
 * ```
 */
export const visibility = (match: Match.Match, opts?: { nav?: boolean; page?: boolean; inline?: boolean }): Layout =>
  onMatch(match, (base) => {
    const render: Place['render'] = opts?.inline ? 'inline' : opts?.page === false ? 'hidden' : 'page'
    const placed: Placement = { ...base, page: { ...base.page, render } }
    return opts?.nav === false ? { ...placed, nav: [] } : placed
  })

/**
 * Give matching declarations a secondary, navigable URL that points at their
 * canonical page (see {@link Alias}). Defaults the alias's parent and name to
 * the canonical placement's.
 *
 * @example A short URL that redirects to the canonical page
 * ```ts
 * Place.alias(Match.name('defineConfig'), { name: 'config', parent: { root: true } })
 * ```
 */
export const alias = (
  match: Match.Match,
  spec: { name?: string; slug?: string; parent?: Parent; mode?: Alias['mode'] },
): Layout =>
  onMatch(match, (base) => ({
    ...base,
    aliases: [
      ...(base.aliases ?? []),
      { parent: spec.parent ?? base.page.parent, name: spec.name ?? base.page.name, slug: spec.slug, mode: spec.mode },
    ],
  }))

// ─────────────────────────────────────────────────────────────────────────
// Internal seams
// ─────────────────────────────────────────────────────────────────────────

/**
 * Shared shape of every matching preset: refine doc sources that have a content
 * home and match, pass everything else through. Narrows `base.page` to non-null
 * once, so `fn` reads it directly.
 */
const onMatch =
  (match: Match.Match, fn: (base: Placement & { page: Place }, d: DeclarationFacade) => Placement): Layout =>
  (source, cx) => {
    const base = cx.default()
    if (source.kind !== 'doc' || base.page === null || !match(source.decl, base)) return base
    return fn(base as Placement & { page: Place }, source.decl)
  }

/** Set the node's canonical bucket on its Place, keeping any order a lower layer assigned. */
const withGroup = (base: Placement & { page: Place }, name: string): Placement => ({
  ...base,
  page: { ...base.page, group: { name, order: base.page.group?.order } },
})
