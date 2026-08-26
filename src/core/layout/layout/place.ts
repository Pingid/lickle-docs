import type { Placement, Place, Parent, Alias, Layout, PageSource } from '../types.ts'
import type { DeclarationFacade } from '../facade.ts'

import * as Select from './select.ts'
import * as Match from './match.ts'

/**
 * The placement layer: small {@link Layout}-returning helpers covering the common
 * placement refinements, so most configs never construct a `Placement` by hand.
 * Compose them with {@link compose}; each is a thin opinion over the framework
 * default, returning `cx.default()` for inputs it doesn't touch so lower layers
 * survive. Predicates come from {@link Match}; per-declaration values (bucket
 * names, labels, …) from {@link Select} — every preset below that takes a string
 * accepts a `Select` in its place.
 */

/**
 * Compose layouts into one. A later layout wraps the earlier ones and wins on
 * conflict. When the context carries a `trace`, each layer that changes the
 * placement reports itself — this is what `ldocs why` reads.
 */
export const compose = (...layouts: Layout[]): Layout =>
  layouts.reduce<Layout>(
    (below, layout) => (p, cx) => {
      const base = () => below(p, cx) ?? cx.default()
      if (!cx.trace) return layout(p, { ...cx, default: base })
      // Materialise the lower result once so the trace can diff against it.
      const before = base()
      const after = layout(p, { ...cx, default: () => before })
      if (after && !same(before, after)) cx.trace({ layer: layout.label ?? '(layer)', before, after })
      return after
    },
    (_, cx) => cx.default(),
  )

const same = (a: Placement, b: Placement): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Tag a layout with the name `ldocs why` reports it under. */
export const label = (label: string, layout: Layout): Layout => Object.assign(layout.bind(null) as Layout, { label })

// ─────────────────────────────────────────────────────────────────────────
// Placement presets — match-first throughout
// ─────────────────────────────────────────────────────────────────────────

/**
 * The filter the zero-config layout applies: keep what the public API exposes,
 * minus anything tagged `@internal`. Exported so a config can compose it
 * explicitly rather than reimplement it — and so widening is a matter of
 * *leaving it out*.
 *
 * @example Narrow further
 * ```ts
 * layout: Place.compose(Place.defaultFilter, Place.filter(Match.not(Match.tag('@alpha'))))
 * ```
 *
 * @example Widen — document unexposed internals too
 * ```ts
 * layout: Place.bucket(Select.kind) // no defaultFilter, so nothing is dropped
 * ```
 */
export const defaultFilter: Layout = label(
  'Place.defaultFilter',
  filterLayout(Match.all(Match.exposed(), Match.not(Match.tag('@internal')))),
)

/**
 * Keep only sources `keep` accepts. Rejected sources are excluded
 * (`{ page: null }`) — no page, no listing, no sidebar, and not resolvable for
 * `{@link}`. To keep a declaration resolvable while hiding it, prefer
 * {@link visibility} with `page: false`.
 *
 * Standalone pages are dropped only when `keep` mentions pages (see
 * {@link Match}); a declaration-only predicate leaves them alone.
 *
 * @example
 * ```ts
 * Place.filter(Match.all(Match.exposed(), Match.not(Match.tag('@internal'))))
 * ```
 */
export const filter = (keep: Match.Match): Layout => label('Place.filter', filterLayout(keep))

function filterLayout(keep: Match.Match): Layout {
  return (source, cx) => {
    if (source.kind === 'doc') return keep(source.decl, { page: null }) ? cx.default() : { page: null }
    if (!keep.page) return cx.default()
    return keep.page(source, { page: null }) ? cx.default() : { page: null }
  }
}

/**
 * Assign a sidebar bucket. Two forms:
 *  - `bucket(select)` — derive each declaration's bucket name from a {@link Select}
 *    (e.g. {@link Select.kind}); an `undefined` result leaves the bucket untouched.
 *  - `bucket(match, name)` — put matching sources in the fixed `name` bucket.
 *
 * The two are told apart by whether a second argument is present, so a bare
 * lambda works in either position.
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
  (match: Match.Match, name: Select.Value<string>): Layout
} = (arg: Match.Match | Select.Select<string | undefined>, name?: Select.Value<string>): Layout =>
  label(
    'Place.bucket',
    name === undefined
      ? onDoc((base, d) => {
          const picked = (arg as Select.Select<string | undefined>)(d)
          return picked === undefined ? base : withGroup(base, picked)
        })
      : onMatch(arg as Match.Match, (base, source) => {
          const picked = valueOf(name, source)
          return picked === undefined ? base : withGroup(base, picked)
        }),
  )

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
  label(
    'Place.bucketOrder',
    onPlaced((base) => {
      const g = base.page.group
      if (!g) return base
      const i = names.findIndex((p) => (typeof p === 'string' ? p === g.name : p.test(g.name)))
      return i < 0 ? base : { ...base, page: { ...base.page, group: { ...g, order: i } } }
    }),
  )

/**
 * Order siblings *within* a bucket. Each argument is an exact display name, a
 * `RegExp` over it, or a {@link Match}; a node sorts by the index of its first
 * match, and unmatched nodes keep the default alphabetical order after them.
 *
 * The counterpart to {@link bucketOrder}, which orders the buckets themselves.
 * Applies to declarations and standalone pages alike, so a hand-written guide
 * can be pinned above generated API entries.
 *
 * @example Pin the entry points, leave the rest alphabetical
 * ```ts
 * Place.order('Getting started', 'Configuration', Match.name('defineConfig'))
 * ```
 */
export const order = (...items: (string | RegExp | Match.Match)[]): Layout =>
  label(
    'Place.order',
    onPlaced((base, source) => {
      const label = base.page.name
      const i = items.findIndex((item) =>
        typeof item === 'string'
          ? item === label
          : item instanceof RegExp
            ? item.test(label)
            : source.kind === 'doc'
              ? item(source.decl, base)
              : (item.page?.(source, base) ?? false),
      )
      return i < 0 ? base : { ...base, page: { ...base.page, order: i } }
    }),
  )

/**
 * Override fields of matching sources' content {@link Place} — the primitive
 * the other placement presets build on. Every string field also accepts a
 * {@link Select}, resolved per declaration.
 *
 * @example Move config types under a virtual folder
 * ```ts
 * Place.place(Match.kinds('type-alias'), { parent: { virtual: 'types' } })
 * ```
 */
export const place = (match: Match.Match, into: PlaceSpec): Layout =>
  label(
    'Place.place',
    onMatch(match, (base, source) => ({ ...base, page: { ...base.page, ...resolveSpec(into, source) } })),
  )

/** {@link Place} fields as a preset accepts them: fixed values, or {@link Select}s resolved per declaration. */
export type PlaceSpec = {
  [K in keyof Place]?: Place[K] extends string | undefined ? Select.Value<string> : Place[K]
}

/** Give matching sources a fixed URL segment. */
export const slug = (match: Match.Match, slug: Select.Value<string>): Layout =>
  label('Place.slug', place(match, { slug }))

/** Rename matching sources' page title / sidebar label. */
export const rename = (match: Match.Match, name: Select.Value<string>): Layout =>
  label('Place.rename', place(match, { name }))

/**
 * Put matching sources under a virtual sidebar folder (`/` nests). Accepts a
 * {@link Select}, so the folder can be derived — `Select.dir()` mirrors the
 * source tree, `Select.entry()` groups by entrypoint.
 *
 * Moves the sidebar row as well as the URL. The framework default pins an
 * explicit `nav` at each exposing module, so setting only the content parent
 * (what {@link place} does) would change a page's path while its sidebar row
 * stayed where it was — not what "put it in this folder" means. Dropping the
 * explicit nav lets it derive from the new parent, which also collapses a
 * declaration exposed from several modules into the one folder you named.
 *
 * @example
 * ```ts
 * Place.folder(Match.kinds('type-alias'), 'Types')
 * Place.folder(Match.all(), Select.dir())
 * ```
 */
export const folder = (match: Match.Match, name: Select.Value<string>): Layout =>
  label(
    'Place.folder',
    onMatch(match, (base, source) => {
      const resolved = valueOf(name, source)
      if (resolved === undefined) return base
      const { nav: _derive, ...rest } = base
      return { ...rest, page: { ...base.page, parent: { virtual: resolved } } }
    }),
  )

/**
 * Control how matching sources appear. Defaults to a fully-visible page.
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
  label(
    'Place.visibility',
    onMatch(match, (base) => {
      const render: Place['render'] = opts?.inline ? 'inline' : opts?.page === false ? 'hidden' : 'page'
      const placed: Placement = { ...base, page: { ...base.page, render } }
      return opts?.nav === false ? { ...placed, nav: [] } : placed
    }),
  )

/**
 * Give matching sources a secondary, navigable URL that points at their
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
  label(
    'Place.alias',
    onMatch(match, (base) => ({
      ...base,
      aliases: [
        ...(base.aliases ?? []),
        {
          parent: spec.parent ?? base.page.parent,
          name: spec.name ?? base.page.name,
          slug: spec.slug,
          mode: spec.mode,
        },
      ],
    })),
  )

// ─────────────────────────────────────────────────────────────────────────
// Internal seams
// ─────────────────────────────────────────────────────────────────────────

type Placed = Placement & { page: Place }

/** Refine every source that still has a content home; pass excluded ones through. */
const onPlaced =
  (fn: (base: Placed, source: PageSource) => Placement): Layout =>
  (source, cx) => {
    const base = cx.default()
    return base.page === null ? base : fn(base as Placed, source)
  }

/** Refine placed **declarations** only — for presets whose value comes from a {@link Select}. */
const onDoc = (fn: (base: Placed, d: DeclarationFacade) => Placement): Layout =>
  onPlaced((base, source) => (source.kind === 'doc' ? fn(base, source.decl) : base))

/**
 * Shared shape of every matching preset: refine placed sources the match
 * accepts, pass everything else through. Standalone pages are considered only
 * when the match carries a page aspect, so declaration-only predicates never
 * disturb markdown.
 */
const onMatch = (match: Match.Match, fn: (base: Placed, source: PageSource) => Placement): Layout =>
  onPlaced((base, source) => {
    const hit = source.kind === 'doc' ? match(source.decl, base) : (match.page?.(source, base) ?? false)
    return hit ? fn(base, source) : base
  })

/** Resolve a preset field. `Select`s only apply to declarations; pages take fixed values. */
const valueOf = <T>(value: Select.Value<T>, source: PageSource): T | undefined =>
  typeof value === 'function'
    ? source.kind === 'doc'
      ? (value as Select.Select<T | undefined>)(source.decl)
      : undefined
    : value

const resolveSpec = (spec: PlaceSpec, source: PageSource): Partial<Place> => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(spec)) {
    const resolved = valueOf(value as Select.Value<unknown>, source)
    if (resolved !== undefined) out[key] = resolved
  }
  return out as Partial<Place>
}

/** Set the node's canonical bucket on its Place, keeping any order a lower layer assigned. */
const withGroup = (base: Placed, name: string): Placement => ({
  ...base,
  page: { ...base.page, group: { name, order: base.page.group?.order } },
})
