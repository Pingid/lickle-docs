import type { Placement, Place, Parent, Alias, Layout, PageSource, DocSource, Rank, TraceEntry } from '../types.ts'
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

      // Materialise the lower result once so the trace can diff against it, and
      // capture anything the layer reports from inside itself. Whether those
      // inner entries or this layer's own name is the useful attribution is a
      // structural question — see `label`'s `transparent` — so it is answered
      // here rather than by comparing outcomes after the fact.
      const before = base()
      const inner: TraceEntry[] = []
      const after = layout(p, { ...cx, default: () => before, trace: (e) => inner.push(e) })

      if (inner.length > 0 && layout.transparent) {
        for (const entry of inner) cx.trace(entry)
        return after
      }
      if (after && !same(before, after)) cx.trace({ layer: labelOf(layout, p), before, after })
      return after
    },
    (_, cx) => cx.default(),
  )

const labelOf = (layout: Layout, source: PageSource): string =>
  typeof layout.label === 'function' ? layout.label(source) : (layout.label ?? '(layer)')

const same = (a: Placement, b: Placement): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * Tag a layout with the name `ldocs why` reports it under.
 *
 * `transparent` says what happens when the layout is itself a composition: a
 * transparent wrapper (a scope the config wrote — {@link within}, an outline)
 * reports its inner layers and stays out of the way, while an opaque one (a
 * preset that composes internally, like {@link depth}) reports itself and hides
 * its own machinery. Defaults to opaque, which is right for every preset.
 *
 * A function label is resolved per source, so a layer that behaves differently
 * for different declarations can say which behaviour applied.
 */
export const label = (
  label: string | ((source: PageSource) => string),
  layout: Layout,
  opts?: { transparent?: boolean },
): Layout =>
  Object.assign(layout.bind(null) as Layout, {
    label,
    ...(opts?.transparent ? { transparent: true as const } : {}),
  })

/**
 * Scope layers to a subset of the site: `layouts` run only for sources `match`
 * accepts, and every other source passes through untouched. The composition
 * primitive that makes "these rules, but only here" expressible without
 * repeating the predicate on every layer.
 *
 * Inside the scope the set is already narrowed, so `Match.all()` — the unit,
 * which matches every source including standalone pages — is the natural inner
 * match.
 *
 * @example One entrypoint laid out differently from the rest
 * ```ts
 * Place.within(
 *   Match.under(Match.name('experimental')),
 *   Place.bucket(Match.all(), 'Experimental'),
 *   Place.depth(1),
 * )
 * ```
 */
export const within = (match: Match.Match, ...layouts: Layout[]): Layout => {
  const inner = compose(...layouts)
  return label(
    'Place.within',
    (source, cx) => {
      const base = cx.default()
      if (base.page === null) return base
      const hit = source.kind === 'doc' ? match(source.decl, base) : (match.page?.(source, base) ?? false)
      return hit ? inner(source, cx) : base
    },
    { transparent: true },
  )
}

/**
 * Map matching sources' {@link Place} through a function — the escape hatch
 * that stays inside the preset vocabulary. Reach for it when a decision needs
 * arbitrary code but not a whole hand-written {@link Layout}: the match, the
 * pass-through and the `page: null` guard are already handled.
 *
 * @example Number the sections of a guide by filename prefix
 * ```ts
 * Place.map(Match.file('docs/guides/**'), (place, source) => ({
 *   ...place,
 *   order: Number(source.kind === 'doc' ? 0 : (source.file?.match(/(\d+)-/)?.[1] ?? 0)),
 * }))
 * ```
 */
export const map = (match: Match.Match, fn: (place: Place, source: PageSource) => Place): Layout =>
  label(
    'Place.map',
    onMatch(match, (base, source) => ({ ...base, page: fn(base.page, source) })),
  )

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
      ? onDoc((base, source) => {
          const picked = (arg as Select.Select<string | undefined>)(source.decl)
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
/**
 * Band 0 of the {@link Rank} space: content positioned deliberately, which
 * leads the entrypoint modules the scan discovered (band 1).
 */
const CONTENT_BAND = 0

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
      return i < 0 ? base : { ...base, page: { ...base.page, order: [CONTENT_BAND, i] } }
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
 * `order` gives the folder a position of its own. Without one a folder has no
 * rank and borrows its earliest child's, which is fine when the contents should
 * decide and wrong when the folder should sit somewhere specific.
 *
 * @example
 * ```ts
 * Place.folder(Match.kinds('type-alias'), 'Types')
 * Place.folder(Match.all(), Select.dir())
 * Place.folder(Match.file('docs/**'), 'Guides', { order: [0, 0] })
 * ```
 */
export const folder = (
  match: Match.Match,
  name: Select.Value<string>,
  opts?: { order?: Rank; label?: string },
): Layout =>
  label(
    'Place.folder',
    onMatch(match, (base, source) => {
      const resolved = valueOf(name, source)
      if (resolved === undefined) return base
      const { nav: _derive, ...rest } = base
      return {
        ...rest,
        page: {
          ...base.page,
          parent: {
            virtual: resolved,
            ...(opts?.label === undefined ? {} : { label: opts.label }),
            ...(opts?.order === undefined ? {} : { order: opts.order }),
          },
        },
      }
    }),
  )

/**
 * Control how matching sources appear. Two independent questions, one each:
 *
 *  - `render` — `'page'` (its own route), `'inline'` (rendered on the parent's
 *    page, no route), `'hidden'` (no route, still resolvable for `{@link}`);
 *  - `nav` — `false` keeps the page and drops the sidebar row.
 *
 * An omitted field is left as the layers below decided it, so `{ nav: false }`
 * drops a row without also promoting an inlined node back to a page.
 *
 * {@link inline}, {@link hide} and {@link pagesFor} are the readable spellings
 * of the common cases; this is the primitive under them.
 *
 * @example Collapse small option types onto their owner
 * ```ts
 * Place.visibility(Match.tag('@inline'), { render: 'inline' })
 * ```
 */
export const visibility = (match: Match.Match, opts?: { render?: Place['render']; nav?: boolean }): Layout =>
  label(
    'Place.visibility',
    onMatch(match, (base) => {
      const placed: Placement = { ...base, page: { ...base.page, ...(opts?.render ? { render: opts.render } : {}) } }
      return opts?.nav === false ? { ...placed, nav: [] } : placed
    }),
  )

/**
 * Render matching declarations **inline** on their parent's page: full docs, no
 * route, no sidebar row. The readable spelling of
 * `Place.visibility(match, { render: 'inline' })`.
 *
 * Inlining a container strands its members — they are documented on a page that
 * no longer exists — so prefer it for leaves, or let {@link depth} handle the
 * distinction for you.
 *
 * @example
 * ```ts
 * Place.inline(Match.tag('@inline'))
 * Place.inline(Match.all(Match.kinds('module'), Match.members({ max: 2 })))
 * ```
 */
export const inline = (match: Match.Match): Layout => label('Place.inline', visibility(match, { render: 'inline' }))

/**
 * Drop matching sources' pages while keeping them resolvable for `{@link}` and
 * breadcrumbs — `Place.visibility(match, { render: 'hidden' })`. Compare
 * {@link filter}, which removes the declaration outright and breaks those links.
 */
export const hide = (match: Match.Match): Layout => label('Place.hide', visibility(match, { render: 'hidden' }))

/**
 * State positively which declarations deserve a page of their own: matching
 * ones keep theirs, and every other **declaration** renders inline on its
 * parent (or is hidden, with `rest: 'hidden'`).
 *
 * The complement of writing `Place.inline(Match.not(…))` by hand, minus its two
 * traps: standalone pages are never touched, and containers (modules and
 * namespaces) keep their pages, since they are what the inlined members render
 * *on*. Inline a container deliberately with {@link inline} if that is what you
 * mean.
 *
 * @example Pages for components and hooks; everything else reads in place
 * ```ts
 * Place.pagesFor(Match.bucket('components', 'hooks'))
 * ```
 */
export const pagesFor = (match: Match.Match, opts?: { rest?: 'inline' | 'hidden' }): Layout => {
  const rest = opts?.rest ?? 'inline'
  return label(
    'Place.pagesFor',
    onDoc((base, source) => {
      const d = source.decl
      if (d.kind === 'module' || d.kind === 'namespace' || d.isEntry()) return base
      if (match(d, base)) return base
      return { ...base, page: { ...base.page, render: rest } }
    }),
  )
}

/**
 * How far the tree expands: declarations more than `max` re-export hops from an
 * entrypoint stop earning sidebar rows of their own (see {@link Select.depth}
 * for the count). `max: 1` is "entrypoints and their members, nothing deeper".
 *
 * `beyond` says what happens to the ones past the cut:
 *  - `'nav'` (default) — keep the page, drop the sidebar row. Nothing is lost:
 *    the parent page still links to it.
 *  - `'inline'` — leaves render inline on their parent's page. Containers keep
 *    their page (inlining one would strand its members) and lose only the row.
 *  - `'hidden'` — no route at all, still resolvable for `{@link}`.
 *
 * @example A two-level sidebar, deeper members read on the page above them
 * ```ts
 * Place.depth(2, { beyond: 'inline' })
 * ```
 */
export const depth = (max: number, opts?: { beyond?: 'nav' | 'inline' | 'hidden' }): Layout => {
  const deeper = Match.depth({ min: max + 1 })
  const beyond = opts?.beyond ?? 'nav'
  if (beyond === 'hidden') return label('Place.depth', visibility(deeper, { render: 'hidden' }))
  if (beyond === 'nav') return label('Place.depth', visibility(deeper, { nav: false }))
  return label(
    'Place.depth',
    compose(
      visibility(Match.all(deeper, Match.leaf()), { render: 'inline' }),
      visibility(Match.all(deeper, Match.not(Match.leaf())), { nav: false }),
    ),
  )
}

/**
 * Whether matching containers lend their label to their descendants' sidebar
 * labels — the `Reflect.` in `Reflect.Module`. Namespaces and nested modules
 * qualify by default; entrypoints do not, since their members are the public
 * surface and read better bare.
 *
 * A node's label is qualified when an *ancestor* qualifies, so this targets the
 * container, not the labelled node.
 *
 * @example Flat labels everywhere
 * ```ts
 * Place.qualify(Match.all(), false)
 * ```
 *
 * @example Qualify under one entrypoint, so `client.connect` reads in full
 * ```ts
 * Place.qualify(Match.all(Match.isEntry(), Match.name('client')), true)
 * ```
 */
export const qualify = (match: Match.Match, on: boolean = true): Layout =>
  label('Place.qualify', place(match, { qualify: on }))

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

/** Refine placed **declarations** only, passing the source; standalone pages pass through. */
const onDoc = (fn: (base: Placed, source: DocSource) => Placement): Layout =>
  onPlaced((base, source) => (source.kind === 'doc' ? fn(base, source) : base))

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
