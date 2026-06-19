// ./src/core/layout/group.ts
import type { Group, GroupedItems } from './types.ts'
import type { DeclarationFacade } from './facade.ts'
import { kindOrder, pluralLabel } from '../naming.ts'

/**
 * Kind narrowing helper for layout configs: `is('function', d)` narrows `d` to
 * the function facade (or any `{ kind }` value, e.g. a `Reflect.Type`).
 */
export const is = <K extends string, T extends { kind: string }>(kind: K, x?: T): x is Extract<T, { kind: K }> =>
  x?.kind === kind

/**
 * Maps a declaration to the bucket it lists under, refining the bucket a prior
 * grouping assigned (`prev`). The same function feeds the sidebar (a child's
 * `Nav.group`) and a parent page's member listing, so both agree.
 */
export type GroupBy = (d: DeclarationFacade, prev: Group | undefined) => Group | undefined

/** Chain groupings left to right: each receives the bucket the previous one chose. */
export const composeGroups =
  (...gs: GroupBy[]): GroupBy =>
  (d, prev) =>
    gs.reduce<Group | undefined>((acc, g) => g(d, acc), prev)

/** Identity helper, for symmetry with the route adapter's `groupBy`. */
export const groupBy = (cb: GroupBy): GroupBy => cb

/**
 * The stock grouping: entrypoint modules first (in entrypoint order), then
 * everything else by kind — functions, variables, types, … — in {@link kindOrder}.
 */
export const groupByKind: GroupBy = (d, p) => {
  if (p) return p
  if (d.isEntry()) return { name: '', order: 1 + (d.entryIndex() ?? 0) }
  return { name: pluralLabel(d.kind), order: kindOrder(d.kind) }
}

/**
 * Bucket declarations carrying `tag` under its text; everything else keeps the
 * bucket it already had. Unlike the old route adapter, groups order first-seen —
 * no string-hash ordering.
 */
export const groupByTag =
  (
    tag: `@${string}`,
    order: (prev: number) => number = () => 0,
    orderOther: (prev: number) => number = () => 0,
  ): GroupBy =>
  (d, prev) => {
    const t = d.tags.get(tag)
    if (t?.text) return { name: t.text, order: order(prev?.order ?? 0) }
    if (prev) return { name: prev.name, order: orderOther(prev.order ?? 0) }
    return undefined
  }

/**
 * Bucket `items` by group name, then order buckets by {@link Group} (ascending;
 * ties keep first-seen). Items without a group fall into the `''` bucket.
 */
export const groupItems = <T extends Record<string, any>>(
  items: T[],
  groupOf: (item: T) => Group | undefined,
): GroupedItems<T>[] => {
  const groups = new Map<string, { order: number; items: T[] }>()
  for (const item of items) {
    const group = groupOf(item)
    const name = group?.name ?? ''
    let bucket = groups.get(name)
    if (!bucket) groups.set(name, (bucket = { order: group?.order ?? Infinity, items: [] }))
    bucket.items.push(item)
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([group, bucket]) => ({ group, items: bucket.items }))
}
