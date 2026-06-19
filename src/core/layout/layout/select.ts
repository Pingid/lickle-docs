import type { DeclarationFacade } from '../facade.ts'
import { pluralLabel } from '../../naming.ts'

/**
 * A {@link Select} derives a value from a declaration — the bucket name for
 * {@link Place.bucket}, say. The counterpart to {@link Match}: where a Match
 * answers yes/no, a Select returns data.
 */
export type Select<T> = {
  (d: DeclarationFacade): T
  [selectSymbol]?: true
}
const selectSymbol = Symbol('Select')

/** Whether `x` is a branded {@link Select} (vs a bare function or a {@link Match}). */
export const is = <T>(x: T): x is T & Select<any> => typeof x === 'function' && (x as any)[selectSymbol] === true

/** Brand a plain function as a {@link Select}. */
export const select = <T>(f: (d: DeclarationFacade) => T): Select<T> => {
  const fn = (d: DeclarationFacade) => f(d)
  fn[selectSymbol] = true
  return fn as Select<T>
}

/**
 * Bucket name from a declaration's `@tag` text, optionally transformed by `cb`.
 * `undefined` when the declaration lacks the tag, so {@link Place.bucket} leaves
 * its bucket untouched.
 *
 * @example
 * ```ts
 * Place.bucket(Select.tag('@group'))
 * ```
 */
export const tag = (tag: `@${string}`, cb?: (text: string) => string): Select<string | undefined> =>
  select((d): string | undefined => {
    const text = d.tags.get(tag)?.text
    if (!text) return undefined
    return cb ? cb(text) : text
  })

/**
 * Bucket name by kind — the kind's plural label (`'functions'`, `'types'`, …).
 * Entrypoint modules return `''` so they list first, ungrouped, like the home
 * page.
 *
 * @example
 * ```ts
 * Place.bucket(Select.kind)
 * ```
 */
export const kind: Select<string> = select((d) => (d.isEntry() ? '' : pluralLabel(d.kind)))
