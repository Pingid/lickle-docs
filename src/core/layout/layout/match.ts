import * as micromatch from 'micromatch'

import type { DeclarationFacade, DeclarationFacadeMap } from '../facade.ts'
import type * as Reflect from '../../reflect/types.ts'
import { isType } from '../../reflect/types.ts'
import type { Placement } from '../types.ts'

/** Predicate over a declaration, used by the matching presets. */
export type Match = {
  (d: DeclarationFacade, place?: Placement): boolean
  [matchSymbol]?: true
}
const matchSymbol = Symbol('Match')

export const is = <T>(x: T): x is T & Match => typeof x === 'function' && (x as any)[matchSymbol] === true

export const match = (m: Match): Match => {
  const fn: Match = (d, place) => m(d, place)
  fn[matchSymbol] = true
  return fn as Match
}

/** Match declarations all of `ms` accept. `all()` matches everything. */
export const all = (...ms: Match[]): Match => match((d, place) => ms.every((m) => m(d, place)))

/** Match declarations any of `ms` accept. `any()` matches nothing. */
export const any = (...ms: Match[]): Match => match((d, place) => ms.some((m) => m(d, place)))

/** Match declarations none of `ms` accept. */
export const not = (...ms: Match[]): Match => match((d, place) => ms.every((m) => !m(d, place)))

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

/** Match declarations by file path patterns. */
export const file = (...patterns: string[]): Match =>
  match((d) =>
    patterns.some((pattern) =>
      micromatch.some(
        d.raw.sources.map((x) => x.file),
        pattern,
      ),
    ),
  )

/**
 * Match declarations by their assigned bucket (see `Place.bucket`). `null`
 * matches the unbucketed node (no group). Reads the node's canonical
 * `Place.group`, so it sees whatever earlier `bucket` layers assigned.
 *
 * @example Keep components/hooks as pages, inline the rest
 * ```ts
 * Place.visibility(Match.not(Match.bucket('components', 'hooks')), { inline: true })
 * ```
 */
export const bucket = (...buckets: (string | null)[]): Match =>
  match((_, place) => {
    if (!place?.page) return false
    const name = place.page.group?.name
    return buckets.some((b) => (b === null ? !name : b === name))
  })

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
