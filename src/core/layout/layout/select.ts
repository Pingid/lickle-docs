import type { DeclarationFacade } from '../facade.ts'
import { pluralLabel } from '../../naming.ts'

/**
 * A {@link Select} derives a value from a declaration — the bucket name for
 * {@link Place.bucket}, the label for {@link Place.rename}, and so on. The
 * counterpart to {@link Match}: where a Match answers yes/no, a Select returns
 * data. Returning `undefined` means "no opinion", and the preset leaves the
 * field it would have set untouched.
 *
 * Any plain function of a declaration is a valid Select — the brand is
 * bookkeeping for {@link is}, never a requirement for callers.
 */
export type Select<T> = {
  (d: DeclarationFacade): T
  [selectSymbol]?: true
}
const selectSymbol = Symbol('Select')

/** Whether `x` is a branded {@link Select}. Note a bare function is still usable as one. */
export const is = <T>(x: T): x is T & Select<any> => typeof x === 'function' && (x as any)[selectSymbol] === true

/** Brand a plain function as a {@link Select}. */
export const select = <T>(f: (d: DeclarationFacade) => T): Select<T> => {
  const fn = (d: DeclarationFacade) => f(d)
  fn[selectSymbol] = true
  return fn as Select<T>
}

/**
 * A preset field that is either a fixed value or derived per declaration. Every
 * `Place` preset that takes a string accepts a {@link Select} in its place, so
 * `Place.rename(m, 'Config')` and `Place.rename(m, Select.tag('@name'))` are
 * both valid.
 */
export type Value<T> = T | Select<T | undefined>

/** Resolve a {@link Value} against a declaration. Bare functions count as Selects. */
export const resolve = <T>(value: Value<T>, d: DeclarationFacade): T | undefined =>
  typeof value === 'function' ? (value as Select<T | undefined>)(d) : value

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

/** The declaration's intrinsic name. */
export const name: Select<string> = select((d) => d.name)

/**
 * The label of the entrypoint this declaration is reachable from (`'./config'`
 * → `config`), or `undefined` when it is exposed from none. Declarations
 * reachable from several entrypoints report the first.
 *
 * @example Bucket everything by the entrypoint that exports it
 * ```ts
 * Place.bucket(Select.entry())
 * ```
 */
export const entry = (): Select<string | undefined> =>
  select((d): string | undefined => {
    const own = d.entry()
    if (own) return entryLabel(own.as)
    const [root] = d.exposure.root()
    const as = root?.entry()?.as
    return as === undefined ? undefined : entryLabel(as)
  })

const entryLabel = (as: string): string => as.replace(/^\.\//, '').replace(/^\.$/, '')

/**
 * The declaration's source directory, project-relative and POSIX-separated
 * (`src/core/layout/place.ts` → `src/core/layout`). `undefined` for
 * declarations at the project root. Pairs with {@link Place.folder} to mirror
 * the source tree in the sidebar.
 *
 * @example Mirror the source tree
 * ```ts
 * Place.folder(Match.all(), Select.dir())
 * ```
 */
export const dir = (opts?: { depth?: number }): Select<string | undefined> =>
  select((d): string | undefined => {
    const file = d.raw.sources?.[0]?.file
    if (!file) return undefined
    const segs = file.split('/').slice(0, -1)
    const kept = opts?.depth === undefined ? segs : segs.slice(0, opts.depth)
    return kept.length ? kept.join('/') : undefined
  })

/**
 * The first Select to return a defined value — a fallback chain.
 *
 * @example Prefer an explicit `@group`, else fall back to the kind
 * ```ts
 * Place.bucket(Select.first(Select.tag('@group'), Select.kind))
 * ```
 */
export const first = <T>(...selects: Select<T | undefined>[]): Select<T | undefined> =>
  select((d): T | undefined => {
    for (const s of selects) {
      const v = s(d)
      if (v !== undefined) return v
    }
    return undefined
  })

/** Map a Select's result, leaving `undefined` untouched. */
export const map = <T, U>(sel: Select<T | undefined>, cb: (value: T) => U): Select<U | undefined> =>
  select((d): U | undefined => {
    const v = sel(d)
    return v === undefined ? undefined : cb(v)
  })
