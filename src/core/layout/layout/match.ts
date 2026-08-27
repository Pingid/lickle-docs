import mm from 'micromatch'

import type { DeclarationFacade, DeclarationFacadeMap } from '../facade.ts'
import type * as Reflect from '../../reflect/types.ts'
import { isType } from '../../reflect/types.ts'
import type { Placement, ContentSource } from '../types.ts'
import * as Select from './select.ts'

/**
 * Predicate over a declaration, used by the matching presets.
 *
 * A Match may additionally carry a {@link MatchPage} aspect describing how it
 * answers for a **standalone page** (markdown or component). The rule the
 * presets follow is: *a preset touches standalone pages only when its match
 * mentions them.* A declaration-only matcher such as `Match.kinds('function')`
 * has no page aspect, so `Place.folder(Match.kinds('function'), 'fns')` leaves
 * every markdown page exactly where it was. Reach pages deliberately with
 * {@link page}, {@link title} or {@link file} — or with the unit {@link all},
 * which matches everything by definition.
 */
export type Match = {
  (d: DeclarationFacade, place?: Placement): boolean
  [matchSymbol]?: true
  /** How this predicate answers for a standalone page. Absent ⇒ pages are never touched. */
  page?: MatchPage
}

/** The page half of a {@link Match}: a predicate over a markdown or component source. */
export type MatchPage = (p: ContentSource, place?: Placement) => boolean

const matchSymbol = Symbol('Match')

export const is = <T>(x: T): x is T & Match => typeof x === 'function' && (x as any)[matchSymbol] === true

export const match = (m: Match, page?: MatchPage): Match => {
  const fn: Match = (d, place) => m(d, place)
  fn[matchSymbol] = true
  if (page) fn.page = page
  return fn as Match
}

/**
 * Combine the page aspects of `ms`. Children without one count as `false`, so
 * `all(kinds('function'), page())` never matches a page (a page is not a
 * function) while `any(kinds('function'), page())` does.
 *
 * With arguments, the composite has an aspect only when at least one child
 * does — that is what keeps a declaration-only predicate from disturbing
 * markdown. With **no** arguments there is no child to ask, so `combine([])`
 * supplies the combinator's unit directly: `all()` and `not()` match every
 * source including pages, `any()` matches none. A conjunction's unit ought to
 * be everything, and now it is.
 */
const combinePages = (ms: Match[], combine: (answers: boolean[]) => boolean): MatchPage | undefined =>
  ms.length === 0 || ms.some((m) => m.page)
    ? (p, place) => combine(ms.map((m) => (m.page ? m.page(p, place) : false)))
    : undefined

/**
 * Match sources all of `ms` accept. `all()` — the unit — matches **everything**,
 * declarations and standalone pages alike, so it is the right inner match for a
 * {@link Place.within} scope that has already narrowed the set.
 */
export const all = (...ms: Match[]): Match =>
  match(
    (d, place) => ms.every((m) => m(d, place)),
    combinePages(ms, (a) => a.every(Boolean)),
  )

/** Match sources any of `ms` accept. `any()` — the unit — matches nothing. */
export const any = (...ms: Match[]): Match =>
  match(
    (d, place) => ms.some((m) => m(d, place)),
    combinePages(ms, (a) => a.some(Boolean)),
  )

/** Match sources none of `ms` accept. `not()` matches everything. */
export const not = (...ms: Match[]): Match =>
  match(
    (d, place) => ms.every((m) => !m(d, place)),
    combinePages(ms, (a) => a.every((x) => !x)),
  )

/**
 * Match declarations by intrinsic name. Variadic, so it also expresses a set;
 * each name is a substring/regex match (`String.match` semantics).
 *
 * @example
 * ```ts
 * Match.name('defineConfig', 'defineComponents')
 * ```
 */
export const name = (...names: (string | RegExp)[]): Match => match((d) => names.some((name) => d.name.match(name)))

/**
 * Match declarations by kind. For matching deeper into `d.raw` (e.g. a
 * signature's return type) use {@link kind} with a structural pattern.
 *
 * @example
 * ```ts
 * Match.kinds('interface', 'type-alias')
 * ```
 */
export const kinds = <const K extends (keyof DeclarationFacadeMap)[]>(...kinds: K): Match =>
  match((d): d is DeclarationFacade<K[number]> => (kinds as string[]).includes(d.kind))

/** Match declarations carrying a doc tag. */
export const tag = (tag: `@${string}`, text?: string | RegExp): Match =>
  match((d) => d.tags.has(tag) && (text ? d.tags.get(tag)?.text?.match(text) !== null : true))

/** Match declarations exposed in the public API. */
export const exposed = (): Match => match((d) => d.exposure.is())

/** Match entrypoint modules. */
export const isEntry = (): Match => match((d) => d.isEntry())

/**
 * Match an entrypoint by the label the config gave it — `'.'` reads as the
 * project name, `'./config'` as `config`.
 *
 * {@link name} cannot do this: a module's intrinsic name comes from its
 * declaration, and a file has none, so every entrypoint answers to `'unknown'`.
 * The label is the only handle a config actually knows.
 *
 * @example Everything the `ui` entrypoint exposes
 * ```ts
 * Match.under(Match.entry('ui'))
 * ```
 */
export const entry = (...labels: (string | RegExp)[]): Match =>
  match((d) => {
    const as = d.entry()?.as
    if (as === undefined) return false
    const label = as.replace(/^\.\//, '')
    return labels.length === 0 || labels.some((l) => label.match(l) !== null)
  })

/**
 * Match declarations by **exposure depth** — how many re-export hops separate
 * them from an entrypoint. An entrypoint is `0`, a declaration it exports
 * directly is `1`, a member of a namespace it exports is `2`, and so on; a
 * declaration reachable by several chains takes the shortest. Unexposed
 * declarations have no depth and never match.
 *
 * This is the same number the sidebar nests by, which is what makes it the
 * useful axis for "expand the tree this far, and no further" — see
 * {@link Place.depth}.
 *
 * @example Everything three or more hops deep
 * ```ts
 * Match.depth({ min: 3 })
 * ```
 */
export const depth = (spec: { min?: number; max?: number }): Match => {
  const of = Select.depth()
  return match((d) => {
    const n = of(d)
    if (n === undefined) return false
    return (spec.min === undefined || n >= spec.min) && (spec.max === undefined || n <= spec.max)
  })
}

/**
 * Match containers by how many members they expose. Counts the exposed members
 * a module or namespace contributes to the docs — the same set its page lists —
 * so `{ max: 0 }` is "exposes nothing" and `{ max: 2 }` is "small enough to read
 * in place". Non-containers expose nothing, so they count as `0`.
 *
 * @example Inline modules too small to deserve a page of their own
 * ```ts
 * Place.inline(Match.all(Match.kinds('module'), Match.members({ max: 2 })))
 * ```
 */
export const members = (spec: { min?: number; max?: number }): Match =>
  match((d) => {
    const n = d.exposure.children().length
    return (spec.min === undefined || n >= spec.min) && (spec.max === undefined || n <= spec.max)
  })

/** Match declarations that expose no members — every leaf, plus empty containers. */
export const leaf = (): Match => members({ max: 0 })

/**
 * Match declarations exposed **beneath** a matching container, at any depth:
 * everything inside a namespace, or everything an entrypoint reaches. Walks the
 * exposure chains, so it sees re-exports the way the sidebar does.
 *
 * The inner match is asked about ancestor declarations, not about the
 * declaration being placed — a placement-reading matcher such as
 * {@link bucket} has nothing to read there and answers `false`.
 *
 * @example Everything the `./config` entrypoint exposes
 * ```ts
 * Match.under(Match.all(Match.isEntry(), Match.name('config')))
 * ```
 */
export const under = (...ms: Match[]): Match =>
  match((d) => d.exposure.ancestors().some((chain) => chain.some((a) => ms.some((m) => m(a)))))

/**
 * Match **standalone pages** — markdown and component pages, never
 * declarations. With no argument it matches every page; the optional spec
 * narrows by kind, by the page's declared `folder`/`group`, or by an arbitrary
 * predicate over the source.
 *
 * @example Put every markdown page under a "Guides" folder
 * ```ts
 * Place.folder(Match.page({ kind: 'markdown' }), 'Guides')
 * ```
 */
export const page = (spec?: {
  kind?: ContentSource['kind']
  folder?: string
  group?: string
  where?: (p: ContentSource) => boolean
}): Match =>
  match(
    () => false,
    (p) => {
      if (spec?.kind !== undefined && p.kind !== spec.kind) return false
      if (spec?.folder !== undefined && p.folder !== spec.folder) return false
      if (spec?.group !== undefined && p.group !== spec.group) return false
      return spec?.where ? spec.where(p) : true
    },
  )

/**
 * Match a standalone page by title; each argument is a substring/regex match.
 * Declarations never match — use {@link name} for those.
 */
export const title = (...titles: (string | RegExp)[]): Match =>
  match(
    () => false,
    (p) => titles.some((t) => p.title.match(t)),
  )

/**
 * Match by source file. Patterns are micromatch globs over the
 * **project-relative, POSIX-separated** path — the same path shown on a
 * declaration's source line and the same one `config.include` receives as
 * `file.relative`, so a pattern written for one works in the other.
 *
 * Page-aware: a markdown or component page loaded from disk matches on its own
 * file, so `Match.file('docs/guides/**')` reaches both API pages defined there
 * and the guides themselves.
 *
 * @example
 * ```ts
 * Match.file('src/core/**', '!src/core/internal/**')
 * ```
 */
export const file = (...patterns: string[]): Match =>
  match(
    (d) =>
      patterns.some((pattern) =>
        mm.some(
          d.raw.sources.map((x) => x.file),
          pattern,
        ),
      ),
    (p) => (p.file === undefined ? false : patterns.some((pattern) => mm.isMatch(p.file!, pattern))),
  )

/**
 * Match declarations by their assigned bucket (see `Place.bucket`). `null`
 * matches the unbucketed node (no group). Reads the node's canonical
 * `Place.group`, so it sees whatever earlier `bucket` layers assigned.
 *
 * @example Keep components/hooks as pages, inline the rest
 * ```ts
 * Place.visibility(Match.not(Match.bucket('components', 'hooks')), { render: 'inline' })
 * ```
 */
export const bucket = (...buckets: (string | null)[]): Match => {
  const test = (place?: Placement) => {
    if (!place?.page) return false
    const name = place.page.group?.name
    return buckets.some((b) => (b === null ? !name : b === name))
  }
  return match(
    (_, place) => test(place),
    (_, place) => test(place),
  )
}

/**
 * Match declarations by kind and a structural pattern over their raw shape.
 * A leaf matches by equality or a predicate; an object matches the named
 * fields; an array matches when some element matches; and a {@link Reflect.Type}
 * field is keyed by the type's kind, then matched field by field.
 *
 * @example Functions returning an `Element` reference
 * ```ts
 * Match.kind('function', { signatures: { return: { reference: { name: 'Element' } } } })
 * ```
 */
export const kind: {
  <K extends keyof Reflect.DeclarationMap>(kind: K, pattern?: DeclarationMatch<K>): Match
} = (kind, pattern): Match => match((d) => d.kind === kind && (pattern === undefined || matchRecord(pattern, d.raw)))

/** Every field the pattern names must match the value's corresponding field. */
const matchRecord = (pattern: object, value: any): boolean =>
  value != null && Object.entries(pattern).every(([k, m]) => matchValue(m, value[k]))

/** A {@link Reflect.Type} pattern is keyed by kind: select the type's kind, then match. */
const matchType = (pattern: any, value: Reflect.Type): boolean => {
  const sub = pattern[value.kind]
  return sub !== undefined && (typeof sub === 'function' ? sub(value) : matchRecord(sub, value))
}

/** Dispatch one matcher node: predicate, array (some), type (by kind), record, or leaf. */
const matchValue = (pattern: any, value: any): boolean =>
  typeof pattern === 'function'
    ? pattern(value)
    : Array.isArray(value)
      ? value.some((el) => matchValue(pattern, el))
      : isType(value)
        ? matchType(pattern, value)
        : value != null && typeof value === 'object'
          ? matchRecord(pattern, value)
          : pattern === value

export type DeclarationMatch<K extends keyof Reflect.DeclarationMap> = {
  [K2 in keyof Reflect.DeclarationMap[K]]?: Matcher<Reflect.DeclarationMap[K][K2]>
}

type Matcher<T> = T extends Reflect.Type
  ? {
      [K in keyof Reflect.TypeMap]?: M<
        { [K2 in keyof Reflect.TypeMap[K]]?: Matcher<Reflect.TypeMap[K][K2]> },
        Reflect.TypeMap[K]
      >
    }
  : T extends Array<infer U>
    ? M<Matcher<U>, U[]>
    : T extends Record<string, unknown>
      ? M<{ [K in keyof T]?: Matcher<T[K]> }>
      : M<T>

type M<T, M = T> = T | ((x: M) => boolean)
