/**
 * Customise how declarations become pages, slugs and sidebar entries.
 *
 * Route generation walks every documented declaration through a provider; an
 * `Adapter` is a record of hooks that refine the provider's output — each
 * hook receives the default value (title, slug, sidebar edges, member links)
 * together with the declaration and returns a replacement. Pass an adapter
 * as the `provider` field of the config; combine several with `compose`.
 *
 * The defaults mirror the export graph: a declaration appears under every
 * module that exposes it; its page nests under a sole direct exposer and
 * flattens to the bare name when several modules expose it directly.
 * Combinators cover the common refinements — `groupBy`/`groupByKind`/
 * `groupByTag` regroup the listings, `section` curates a top-level sidebar
 * group, `filter` hides declarations, `mapComment` rewrites doc comments.
 *
 * @example Group members by source directory instead of kind
 * ```ts
 * import { defineConfig, Adapter } from '@lickle/docs/config'
 *
 * export default defineConfig({
 *   name: 'My Library',
 *   provider: Adapter.groupBy((d) => ({ name: d.raw.sources[0]?.file.split('/')[0] ?? '' })),
 * })
 * ```
 */
import { compose } from '../provider/core.ts'
import { type DeclarationFacade } from '../provider/facade.ts'
import { kindOrder, pluralLabel } from '../naming.ts'
import type { Adapter } from '../provider/core.ts'
import { Reflect } from '../../../core/index.ts'

export type { DeclarationFacade, ModuleFacade } from '../provider/facade.ts'
export type * from '../provider/core.ts'

export { compose }

/**
 * Build an adapter that regroups the three grouped surfaces at once: member
 * links on parent pages, sidebar entries and "referenced in" backlinks.
 *
 * `cb` receives the declaration, the route context and the group the default
 * provider assigned, and returns the group to use. Groups order ascending by
 * `order` (ties keep first-seen order); items keep their order within a
 * group.
 *
 * @param cb Maps a declaration to its group.
 * @returns An adapter to pass as the config `provider` (or to {@link compose}).
 *
 * @example Group by exposure, internals last
 * ```ts
 * Adapter.groupBy((d) => (d.exposure.is() ? { name: 'api', order: 0 } : { name: 'internals', order: 1 }))
 * ```
 */
export const groupBy = (
  cb: (
    d: DeclarationFacade,
    value: { name: string; order?: number } | undefined,
  ) => { name: string; order?: number } | undefined,
) =>
  compose({
    links: (value, d) => value.map((l) => ({ ...l, group: cb(d.get(l.target)!, l.group) })),
    sidebar: (value, d) => {
      if (!value?.children) return value
      return { ...value, children: value.children.map((l) => ({ ...l, group: cb(d.get(l.target)!, l.group) })) }
    },
    referenced: (value, d) => value.map((r) => ({ ...r, group: cb(d.get(r.target)!, r.group) })),
  })

/**
 * The stock grouping: entrypoint modules first (in entrypoint order), then
 * everything else bucketed by kind — `functions`, `variables`, `types`, … —
 * in {@link kindOrder} order.
 */
export const groupByKind = groupBy((d) => {
  if (d.isEntry()) return { name: '', order: 1 + (d.entryIndex() ?? 0) }
  return { name: pluralLabel(d.kind), order: kindOrder(d.kind) }
})

/**
 * Group sidebar entries and member listings by a JSDoc tag — declarations
 * carrying the tag bucket under its text; everything else keeps its current
 * group, ordered after the tagged ones.
 *
 * @param tag The tag to read, e.g. `@group` — a declaration documented with
 * `@group hooks` buckets under "hooks".
 *
 * @example
 * ```ts
 * provider: Adapter.groupByTag('@group')
 * ```
 */
export const groupByTag = (tag: `@${string}`) =>
  groupBy((d, group) => {
    const t = d.tags.get(tag)
    if (t?.text) return { name: t.text, order: sortByHash(t.text) }
    if (group) return { ...group, order: group.order ? group.order + sortByHash.MAX : 1 }
    return group
  })

/**
 * Add a curated top-level sidebar section. Declarations whose name is listed
 * become roots grouped under `title` — *in addition to* their normal place
 * in the tree, so the same page is reachable from both. Names resolve by
 * declaration name; the first match wins for duplicates.
 *
 * @param title Section heading shown above the entries.
 * @param names Declaration names to list, in the given order.
 * @param opts `order` positions the section among the root groups
 * (default `-1`, above the ungrouped roots).
 *
 * @example A hand-picked "essentials" section
 * ```ts
 * provider: Adapter.section('essentials', ['defineConfig', 'defineComponents', 'LiveExample'])
 * ```
 */
export const section = (title: string, names: string[], opts?: { order?: number }): Adapter => ({
  sidebar: (value, d) => {
    const index = names.indexOf(d.name)
    if (index < 0) return value
    return { ...(value ?? {}), root: index, group: { name: title, order: opts?.order ?? -1 } }
  },
})

/**
 * Keep only declarations `cb` accepts. Rejected declarations emit no page —
 * they disappear from the sidebar, member listings, backlinks and search.
 *
 * @example Hide everything tagged `@internal`
 * ```ts
 * provider: Adapter.filter((d) => !d.tags.has('@internal'))
 * ```
 */
export const filter = (cb: (d: DeclarationFacade) => boolean): Adapter => ({
  route: (v, d) => (cb(d) ? v : undefined),
})

/**
 * Rewrite each declaration's doc comment before it renders. Useful for
 * stripping mechanical tags the adapter has already consumed.
 *
 * @example Hide `@group` tags from the rendered pages
 * ```ts
 * provider: Adapter.mapComment((c) => ({ ...c, tags: c.tags?.filter((t) => t.tag !== '@group') }))
 * ```
 */
export const mapComment = (cb: (d: Reflect.Comment) => Reflect.Comment): Adapter => ({
  declaration: (v, d) => {
    if (d.raw.comment) d.raw.comment = cb(d.raw.comment)
    return v
  },
})

/**
 * Stable order key derived from a string, so grouped items get a
 * deterministic order without manual numbering.
 * @internal
 */
export const sortByHash = (text: string) => {
  let hash = 0
  if (text.length === 0) return hash

  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }

  return Math.abs(hash)
}
sortByHash.MAX = 2_147_483_647

export const match = <K extends string, T extends { kind: string }>(kind: K, x?: T): x is Extract<T, { kind: K }> =>
  x?.kind === kind
