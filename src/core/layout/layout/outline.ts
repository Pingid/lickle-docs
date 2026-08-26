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
export type Section = SectionSpec | Placeholder

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

/** A position in the running order for a bucket another layer assigns. */
export type Placeholder = { name: string | RegExp }

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
export const of = (...sections: Section[]): Layout => {
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

const isSpec = (s: Section): s is SectionSpec => 'include' in s && s.include !== undefined
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
const claims = (sections: Section[]): Claim => {
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
const claimLayer = (sections: Section[], claim: Claim): Layout =>
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
const bucketNameOf = (s: Section): string | RegExp => (isSpec(s) ? claimedBucket(s) : (s.name ?? ''))

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
  const entries: Layout[] = []
  const subtree: Layout[] = []

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

  const layers: Layout[] = []
  if (entries.length) layers.push(Place.within(mine, ...entries))
  if (subtree.length) layers.push(Place.within(Match.any(mine, Match.under(mine)), ...subtree))
  return Place.label(`Outline.rules(${s.name ?? ''})`, Place.compose(...layers), { transparent: true })
}
