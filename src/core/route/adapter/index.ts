/**
 * Customise how declarations become pages, slugs and sidebar entries.
 *
 * Route generation walks every documented declaration through a provider; an
 * `Adapter` is a record of hooks that refine the provider's output — each
 * hook receives the default value (title, slug, sidebar placement, member
 * links) together with the declaration and returns a replacement. Pass an
 * adapter as the `provider` field of the config; combine several with
 * `compose`.
 *
 * `groupBy` covers the common case — regrouping the sidebar and member
 * listings — and `groupByKind` is the stock grouping the default site uses.
 *
 * @example Group members by source directory instead of kind
 * ```ts
 * import { defineConfig, Adapter } from '@lickle/docs/config'
 *
 * export default defineConfig({
 *   name: 'My Library',
 *   provider: Adapter.groupBy((d) => ({ name: d.srcFile.split('/')[1] ?? '' })),
 * })
 * ```
 */
import { createFacade, type DeclarationFacade } from '../provider/facade.ts'
import { compose, type RouteContext } from '../provider/core.ts'
import { kindOrder, pluralLabel } from '../naming.ts'

export type { DeclarationFacade } from '../provider/facade.ts'
export type * from '../provider/core.ts'
export type * from '../types.ts'
export * from '../naming.ts'

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
 * Adapter.groupBy((d) => (d.isExposed() ? { name: 'api', order: 0 } : { name: 'internals', order: 1 }))
 * ```
 */
export const groupBy = (
  cb: (
    d: DeclarationFacade,
    cx: RouteContext,
    value: { name: string; order?: number } | undefined,
  ) => { name: string; order?: number },
) =>
  compose({
    links: (value, _, cx) => value.map((l) => ({ ...l, group: cb(createFacade(cx.docs, l.target)!, cx, l.group) })),
    sidebar: (value, d, cx) => {
      if (!value) return undefined
      return { ...value, group: cb(d, cx, value?.group) }
    },
    referenced: (value, _, cx) =>
      value.map((r) => ({ ...r, group: cb(createFacade(cx.docs, r.target)!, cx, r.group) })),
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
