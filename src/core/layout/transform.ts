import type * as Reflect from '../reflect/index.ts'

/**
 * A content transform run over each declaration *after* layout has read it —
 * separate from {@link Layout}, which decides placement only. Transforms shape
 * what renders (e.g. strip mechanical tags the grouping already consumed). They
 * may mutate the declaration; running them after layout avoids ordering bugs
 * like stripping `@group` before `Select.tag('@group')` reads it.
 */
export type Transform = (d: Reflect.Declaration) => void

/** Run several transforms over each declaration, left to right. */
export const compose =
  (...transforms: Transform[]): Transform =>
  (d) => {
    for (const t of transforms) t(d)
  }

/**
 * Strip the named comment tags from a declaration, so mechanical tags the
 * grouping already consumed (e.g. `@group`) don't render on the page.
 *
 * @example
 * ```ts
 * transform: Transform.stripTags('@group')
 * ```
 */
export const stripTags =
  (...tags: string[]): Transform =>
  (d) => {
    if (d.comment?.tags) d.comment = { ...d.comment, tags: d.comment.tags.filter((t) => !tags.includes(t.tag)) }
  }
