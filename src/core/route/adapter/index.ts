/**
 * Customise how declarations become pages, slugs and sidebar entries.
 *
 * Route generation walks every documented declaration through a provider; an
 * `Adapter` is a record of hooks that refine the provider's output — each
 * hook receives the default value (placement, title, slug, member links)
 * together with the declaration and returns a replacement. Pass an adapter
 * as the `provider` field of the config; combine several with `compose`.
 *
 * Two families of combinators cover the common cases. `groupBy` regroups
 * the sidebar and member listings (`groupByKind` is the stock grouping).
 * `placeIn` and `place` choose which module owns the page of a declaration
 * that is re-exported in several places — both built on the `exposure` hook,
 * which relocates slug, title and sidebar placement together.
 *
 * @example Group members by source directory instead of kind
 * ```ts
 * import { defineConfig, Adapter } from '@lickle/docs/config'
 *
 * export default defineConfig({
 *   name: 'My Library',
 *   provider: Adapter.groupBy((d) => ({ name: d.sources[0]?.file.split('/')[0] ?? '' })),
 * })
 * ```
 *
 * @example Let the `core` entrypoint own everything it re-exports
 * ```ts
 * provider: Adapter.compose(Adapter.placeIn('./core'), Adapter.groupByKind)
 * ```
 */
import { compose, type ExposurePath } from '../provider/core.ts'
import { type DeclarationFacade } from '../provider/facade.ts'
import { kindOrder, pluralLabel } from '../naming.ts'
import type { Adapter } from '../provider/core.ts'
import type { Reflect } from '../../../core/index.ts'

export type { DeclarationFacade, ModuleFacade } from '../provider/facade.ts'
export type * from '../provider/core.ts'
export type * from '../types.ts'

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
      if (!value) return undefined
      return { ...value, group: cb(d, value?.group) }
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
 * Prefer the entrypoint `entry` as home: whenever a declaration is
 * re-exported by several entrypoints, the shortest chain through `entry`
 * becomes canonical — its page, title and sidebar entry move there, and the
 * other exposers link to it. Declarations `entry` does not expose keep their
 * default placement.
 *
 * @param entry The entrypoint label from the config, e.g. `./config` (a
 * leading `./` is optional).
 *
 * @example Shared types live under the main module
 * ```ts
 * import { defineConfig, Adapter } from '@lickle/docs/config'
 *
 * export default defineConfig({ name: 'My Library', provider: Adapter.placeIn('.') })
 * ```
 */
export const placeIn = (entry: string): Adapter => ({
  exposure: (path, d) => {
    const through = d.exposure.ancestors().filter((p) => sameEntry(p[0]?.entry()?.as, entry))
    return through.sort((a, b) => a.length - b.length)[0] ?? path
  },
})

/**
 * Pin declarations to a home by name. Keys are declaration names; values
 * name the owning module as the entrypoint label optionally followed by
 * re-export aliases, slash-separated. Declarations whose name is absent —
 * or that the named module does not expose — keep their default placement.
 *
 * @param homes Map of declaration name to owning module.
 *
 * @example
 * ```ts
 * import { defineConfig, Adapter } from '@lickle/docs/config'
 *
 * export default defineConfig({
 *   name: 'My Library',
 *   provider: Adapter.place({ UserConfig: 'config', Route: 'config/Adapter' }),
 * })
 * ```
 */
export const place = (homes: Record<string, string>): Adapter => ({
  exposure: (path, d) => {
    const home = homes[d.name]
    if (home === undefined) return path
    return d.exposure.ancestors().find((p) => pathLabel(p) === normalize(home)) ?? path
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
  declare: (v, d) => (cb(d) ? v : undefined),
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
  declare: (v, d) => {
    if (d.raw.comment) d.raw.comment = cb(d.raw.comment)
    return v
  },
})

/**
 * The module chain of an exposure path as a slash-joined label: the
 * entrypoint label plus the alias of every intermediate module. The last
 * hop names the declaration itself, so it is excluded.
 */
const pathLabel = (p: ExposurePath): string =>
  [normalize(p[0]?.entry()?.as ?? ''), ...p.slice(0, -1).map((f) => f.alias() ?? f.name)].join('/')

const sameEntry = (a: string | undefined, b: string) => a !== undefined && normalize(a) === normalize(b)
const normalize = (s: string) => s.replace(/^\.\/?/, '')

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
