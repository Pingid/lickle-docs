import type { Layout, PageSource, Placement } from '../types.ts'
import type * as Reflect from '../../reflect/types.ts'

import * as Select from './select.ts'
import * as Match from './match.ts'
import * as Place from './place.ts'

/**
 * The declarative face of the layout: the sidebar as an ordered list of
 * sections, each saying *what* is in it, *in what order*, and *to what depth*.
 *
 * A composed {@link Place} chain describes placement as a sequence of edits,
 * which is exactly right when you are refining one — and indirect when what you
 * actually want to state is the shape of the site. An outline states the shape;
 * it compiles to the same presets, so nothing is hidden and nothing is lost.
 * The two mix freely: an outline *is* a `Layout`, so it composes with layers
 * before and after it.
 *
 * @example
 * ```ts
 * layout: Place.compose(
 *   Place.defaultFilter,
 *   Outline.of(
 *     { name: 'Guides', include: Match.file('docs/guides/**') },
 *     { name: 'API', include: Match.isEntry(), depth: 2 },
 *     { name: 'types', include: Match.kinds('interface', 'type-alias'), render: 'inline' },
 *     { name: /.+/ }, // everything else, after the named sections
 *   ),
 * )
 * ```
 */

/**
 * One section of the outline — a sidebar heading and the rules for what sits
 * under it.
 *
 * Two forms:
 *  - a **section**, with an `include` match saying what it holds;
 *  - a **placeholder**, a bare `name` (string or `RegExp`) that only claims a
 *    position in the running order, for a bucket some other layer assigns —
 *    `{ name: 'functions' }` next to a `Place.bucket(Select.kind)` below, or a
 *    trailing `{ name: /.+/ }` to sweep the rest.
 */
export type Section = SectionSpec | Placeholder | string

/** A section that claims sources of its own. */
export type SectionSpec = {
  /**
   * The sidebar heading. Omit for the unheaded lead run — the section that
   * renders without a heading, which is why anything under a heading belongs to
   * that heading.
   */
  name?: string
  /**
   * What belongs to this section. First section to match a source claims it, so
   * order the list from most specific to least.
   */
  include: Match.Match
  /**
   * Nest the section's entries in a collapsible folder instead of listing them
   * flat: `true` names it after the section, a string names it outright, and a
   * {@link Select} derives it per declaration (`Select.dir()` mirrors the source
   * tree). A `/` nests further.
   *
   * A folder is a node, not a heading, so it joins the *unheaded* run at its
   * level — ahead of the headed sections — and its entries read flat inside it.
   * Among folders it sorts by the section's position in this list. When you want
   * a heading and a folder, give the folder a different name from the section.
   */
  folder?: boolean | Select.Value<string>
  /**
   * Render this section's entries on the page of the declaration `into`
   * matches, instead of giving each one a page of its own.
   *
   * The real-declaration counterpart to {@link folder}'s synthetic one: a
   * folder is a sidebar node with no page, this is a page. Use it when a group
   * belongs together on one screen — a set of primitives, a family of helpers —
   * and the module that would host them is already in your source.
   *
   * Implies `render: 'inline'` and no sidebar rows for the entries; the host
   * keeps its own row. The host is revived if the export graph flattened it
   * away, but placing the *host* is still yours: say where it goes with a
   * `Place.into` of its own, or let it fall where the default puts it.
   */
  into?: Match.Match
  /**
   * Order within the section. Each item is an exact display name, a `RegExp`
   * over it, or a {@link Match}; entries sort by the index of their first match,
   * and the unmatched stay alphabetical after them.
   */
  order?: (string | RegExp | Match.Match)[]
  /**
   * How far the tree expands below this section: declarations more than `depth`
   * re-export hops from an entrypoint stop earning sidebar rows (see
   * {@link Select.depth}). `depth: 1` is "the entrypoints and their members".
   */
  depth?: number
  /** What happens past `depth` — see {@link Place.depth}. Defaults to `'nav'`. */
  beyond?: 'nav' | 'inline' | 'hidden'
  /**
   * How this section's entries render: `'page'` each on its own route,
   * `'inline'` on their parent's page, `'hidden'` not at all (still resolvable
   * for `{@link}`).
   */
  render?: 'page' | 'inline' | 'hidden'
  /** `false` keeps the pages and drops the sidebar rows. */
  nav?: boolean
  /**
   * Whether containers in this section lend their label to their descendants'
   * sidebar labels — the `Reflect.` in `Reflect.Module`. Defaults to namespaces
   * and nested modules qualifying, entrypoints not.
   */
  qualify?: boolean
  /**
   * Extra layers, scoped to this section's subtree. The escape hatch: anything
   * the fields above don't cover is still an ordinary {@link Place} layer, and
   * still confined to this section.
   */
  layers?: Layout[]
}

/**
 * A position in the running order for a bucket another layer assigns.
 *
 * A bare string is the same thing: `'hooks'` and `{ name: 'hooks' }` are
 * interchangeable. A run of sections whose names *are* the buckets a
 * `Place.bucket(Select.tag('@group'))` already assigned then reads as the list
 * it is, rather than as N copies of `{ name: X, include: Match.tag('@group', X) }`
 * that have to be kept in step with each other.
 */
export type Placeholder = { name: string | RegExp }

/** Normalize the bare-string form so the compiler sees one shape. */
const asSection = (s: Section): SectionSpec | Placeholder => (typeof s === 'string' ? { name: s } : s)

/**
 * Compile an outline into a {@link Layout}.
 *
 * Section order is display order — the list *is* the sidebar. Within it, the
 * first section to match a source claims it, which is the opposite of
 * `Place.compose`'s "later layers win" and the natural reading of an ordered
 * list; write the specific sections first and the catch-alls last.
 *
 * Everything an outline does, it does through the presets: the claim becomes a
 * {@link Place.bucket}-shaped edit, the list order becomes
 * {@link Place.bucketOrder}, `depth` becomes {@link Place.depth}, and
 * per-section rules are wrapped in a {@link Place.within} scope. `ldocs why`
 * names the claiming section, so a surprising placement is still attributable.
 */
export const of = (...input: Section[]): Layout => {
  const sections = input.map(asSection)
  const claim = claims(sections)

  return Place.label(
    'Outline.of',
    Place.compose(
      // One pass, in list order, taking the first section that matches — the
      // literal reading of the list. (Reversing the sections and leaning on
      // `compose`'s last-wins produces the same buckets, but evaluates every
      // section for every source and reports the losers in the trace.)
      claimLayer(sections, claim),
      // The list order, as bucket order. Placeholders take part; a folder
      // section and an unnamed one both claim the `''` bucket they render as.
      Place.bucketOrder(...sections.map(bucketNameOf)),
      // Per-section rules, in list order — later sections may still refine
      // earlier ones' members, exactly as hand-written layers would.
      ...sections.map((s, at) => (isSpec(s) ? sectionLayer(s, at, claim) : null)).filter(nonNull),
    ),
    { transparent: true },
  )
}

const isSpec = (s: SectionSpec | Placeholder): s is SectionSpec => 'include' in s && s.include !== undefined
const nonNull = <T>(x: T | null): x is T => x !== null

/** Which section claims a source: its index in the list, or `-1` for none. */
type Claim = (source: PageSource, place?: Placement) => number

/**
 * The claim decision, computed once per declaration and reused.
 *
 * Memoized because it is asked twice over: once to assign the bucket, and again
 * for every ancestor when a section scopes its structural rules. A declaration's
 * claim does not change during a build, so the cache is also what keeps those
 * two answers consistent.
 */
const claims = (sections: (SectionSpec | Placeholder)[]): Claim => {
  const specs = sections.map((s, at) => ({ s, at })).filter((x): x is { s: SectionSpec; at: number } => isSpec(x.s))
  const cache = new Map<Reflect.Id | PageSource, number>()

  return (source, place) => {
    const key = source.kind === 'doc' ? source.decl.id : source
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const found = specs.find(({ s }) =>
      source.kind === 'doc' ? s.include(source.decl, place) : (s.include.page?.(source, place) ?? false),
    )
    const at = found?.at ?? -1
    cache.set(key, at)
    return at
  }
}

/**
 * The claim itself: one layer that walks the sections in order and buckets a
 * source under the first that accepts it. Labelled per source, so the trace
 * names the section rather than an anonymous `Place.bucket`.
 */
const claimLayer = (sections: (SectionSpec | Placeholder)[], claim: Claim): Layout =>
  Place.label(
    (source) => {
      const at = claim(source)
      return at < 0 ? 'Outline.of' : `Outline.section(${sections[at]!.name ?? ''})`
    },
    Place.map(Match.all(), (place, source) => {
      const at = claim(source, { page: place })
      if (at < 0) return place
      // Keep any order an earlier `bucketOrder` assigned, exactly as
      // `Place.bucket` does.
      return { ...place, group: { name: claimedBucket(sections[at] as SectionSpec), order: place.group?.order } }
    }),
  )

/** A match for "this section claimed it", for scoping the section's own rules. */
const claimedBy = (at: number, claim: Claim): Match.Match =>
  Match.match(
    (d, place) => claim({ kind: 'doc', decl: d }, place) === at,
    (p, place) => claim(p, place) === at,
  )

/**
 * The bucket a section claims. `folder: true` asks for a folder *instead of* a
 * heading, so it claims the unheaded `''` bucket and lets the folder carry the
 * label — otherwise every entry would sit under a heading inside a folder of
 * the same name.
 */
const bucketNameOf = (s: SectionSpec | Placeholder): string | RegExp => (isSpec(s) ? claimedBucket(s) : (s.name ?? ''))

/**
 * The bucket a *claiming* section puts its sources in. Always a string — only a
 * placeholder may name its bucket with a `RegExp`, and a placeholder claims
 * nothing.
 */
const claimedBucket = (s: SectionSpec): string => (s.folder === true ? '' : (s.name ?? ''))

/** The folder a section nests its entries in, if it asks for one. */
const folderOf = (s: SectionSpec): Select.Value<string> | undefined => {
  if (s.folder === undefined || s.folder === false) return undefined
  const name = s.folder === true ? (s.name ?? '') : s.folder
  return name === '' ? undefined : name
}

/**
 * Band 0 of the {@link Layout.Rank} space: content positioned deliberately,
 * which leads the entrypoint modules the scan discovered.
 */
const CONTENT_BAND = 0

/**
 * A section's rules. Two scopes, because two kinds of rule:
 *  - the section's own **entries** take its folder, order, render and nav;
 *  - its whole **subtree** takes the structural rules — depth and qualified
 *    labels describe levels below the entries, so they have to reach them.
 *
 * Both scope on *what this section claimed*, not on what its `include` would
 * match. The difference matters for a broad include: `Match.isEntry()` with
 * `Match.under` reaches every exposed declaration in the project, so a `depth`
 * on one section would otherwise govern declarations that a later section
 * claimed.
 */
const sectionLayer = (s: SectionSpec, at: number, claim: Claim): Layout => {
  const mine = claimedBy(at, claim)
  const unscoped: Layout[] = []
  const entries: Layout[] = []
  const subtree: Layout[] = []

  // A host page absorbs the section: entries render on it, and their sidebar
  // rows would duplicate what the host already shows.
  //
  // The host itself is *not* one of the section's entries, so the scoped layers
  // below never see it — reviving it has to happen unscoped, or a module the
  // export graph flattened away would still be missing and every entry would
  // parent onto nothing.
  if (s.into) {
    unscoped.push(Place.keep(s.into))
    entries.push(Place.into(Match.all(), s.into))
    // `render: 'inline'` is the whole instruction — it already means no route
    // and no sidebar row. Adding `nav: false` on top erases the nav edge that
    // tells the sidebar builder these entries live *under the host*, and the
    // host then looks like an empty container and is pruned away.
    entries.push(Place.visibility(Match.all(), { render: 'inline' }))
  }

  const folder = folderOf(s)
  // The folder carries the section's position itself, so its contents keep
  // whatever order they earned. (It used to have no rank of its own and inherit
  // its earliest child's, which meant positioning the folder meant offsetting
  // every entry inside it.)
  if (folder !== undefined) entries.push(Place.folder(Match.all(), folder, { order: [CONTENT_BAND, at] }))
  if (s.order) entries.push(Place.order(...s.order))
  if (s.render) entries.push(Place.visibility(Match.all(), { render: s.render }))
  if (s.nav === false) entries.push(Place.visibility(Match.all(), { nav: false }))

  if (s.qualify !== undefined) subtree.push(Place.qualify(Match.all(), s.qualify))
  if (s.depth !== undefined) subtree.push(Place.depth(s.depth, s.beyond ? { beyond: s.beyond } : undefined))
  if (s.layers?.length) subtree.push(...s.layers)

  const layers: Layout[] = [...unscoped]
  if (entries.length) layers.push(Place.within(mine, ...entries))
  if (subtree.length) layers.push(Place.within(Match.any(mine, Match.under(mine)), ...subtree))
  return Place.label(`Outline.rules(${s.name ?? ''})`, Place.compose(...layers), { transparent: true })
}
