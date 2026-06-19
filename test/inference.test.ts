import { test, expect } from 'vitest'

import { scanFixture, byName, typeOf } from './fixture.ts'
import type * as T from '../src/core/reflect/types.ts'

test('infers primitive and literal variable types', () => {
  const idx = scanFixture(`
    export const n = 42
    export const s = 'hi'
    export const b = true
    export const big = 10n
  `)
  expect((typeOf(idx, 'n') as T.Type<'literal'>).value).toBe(42)
  expect((typeOf(idx, 's') as T.Type<'literal'>).value).toBe('hi')
  expect((typeOf(idx, 'b') as T.Type<'literal'>).value).toBe(true)
  expect((typeOf(idx, 'big') as T.Type<'literal'>).value).toBe(10n)
})

test('infers arrays, unions, and nested object literals', () => {
  const idx = scanFixture(`
    export const arr = [1, 2, 3]
    export const u = Math.random() > 0.5 ? 1 : 'one'
    export const obj = { x: 1, nested: { z: true } }
  `)
  const arr = typeOf(idx, 'arr') as T.Type<'array'>
  expect(arr.kind).toBe('array')
  expect((arr.elementType as T.Type<'intrinsic'>).name).toBe('number')

  const u = typeOf(idx, 'u') as T.Type<'union'>
  expect(u.kind).toBe('union')
  expect(u.types.length).toBe(2)

  const obj = typeOf(idx, 'obj') as T.Type<'record'>
  expect(obj.kind).toBe('record')
  const props = obj.members.filter((m) => m.kind === 'property') as T.Part<'property'>[]
  expect(props.map((p) => p.name)).toEqual(['x', 'nested'])
  const nested = props.find((p) => p.name === 'nested')!.type as T.Type<'record'>
  expect(nested.kind).toBe('record')
})

test('infers function return types', () => {
  const idx = scanFixture(`export function add(a: number, b: number) { return a + b }`)
  const fn = byName<'function'>(idx, 'add')
  expect((fn.signatures[0]!.return as T.Type<'intrinsic'>).name).toBe('number')
})

test('inferred references resolve to internal ids and stdlib', () => {
  const idx = scanFixture(`
    export class Foo { count = 0 }
    export const foo = new Foo()
    export const when = new Date()
  `)
  const foo = typeOf(idx, 'foo') as T.Type<'reference'>
  expect(foo.kind).toBe('reference')
  expect(foo.name).toBe('Foo')
  expect(foo.target.type).toBe('internal')
  expect((foo.target as Extract<T.TypeReferenceTarget, { type: 'internal' }>).id).toBe(byName(idx, 'Foo').id)

  const when = typeOf(idx, 'when') as T.Type<'reference'>
  expect(when.target.type).toBe('external')
  expect((when.target as Extract<T.TypeReferenceTarget, { type: 'external' }>).external).toBe('stdlib')
})

test('falls back to a text node for unstructurable inferred types', () => {
  const idx = scanFixture(`export function keysOf<T>(x: T) { return null as unknown as keyof T }`)
  const ret = byName<'function'>(idx, 'keysOf').signatures[0]!.return
  // `keyof T` over a free type parameter has no structured form.
  expect(ret.kind).toBe('unknown')
  expect((ret as T.Type<'unknown'>).text).toBe('keyof T')
})

test('infers tuples with readonly, labels, optionals and rest', () => {
  const idx = scanFixture(`
    export const t = [1, 'a'] as const
    export function pair(...args: [first: number, second?: string]) { return args }
    export function rest(...args: [number, ...string[]]) { return args }
  `)
  const t = typeOf(idx, 't') as T.Type<'type-operator'>
  expect(t.kind).toBe('type-operator')
  expect(t.operator).toBe('readonly')
  const tuple = t.target as T.Type<'tuple'>
  expect(tuple.kind).toBe('tuple')
  expect(tuple.elements.map((e) => (e.type as T.Type<'literal'>).value)).toEqual([1, 'a'])

  const pair = byName<'function'>(idx, 'pair').signatures[0]!.return as T.Type<'tuple'>
  expect(pair.kind).toBe('tuple')
  expect(pair.elements.map((e) => e.name)).toEqual(['first', 'second'])
  expect(pair.elements[1]!.optional).toBe(true)

  const rest = byName<'function'>(idx, 'rest').signatures[0]!.return as T.Type<'tuple'>
  expect(rest.elements[1]!.rest).toBe(true)
  expect(rest.elements[1]!.type.kind).toBe('array')
})

test('infers function-valued properties and shorthand methods', () => {
  const idx = scanFixture(`
    export const api = {
      get: (id: string) => id.length,
      m(x: number) { return x },
    }
  `)
  const api = typeOf(idx, 'api') as T.Type<'record'>
  expect(api.kind).toBe('record')
  const get = api.members.find((m) => m.kind === 'property' && m.name === 'get') as T.Part<'property'>
  const fn = get.type as T.Type<'function-type'>
  expect(fn.kind).toBe('function-type')
  expect(fn.signatures[0]!.params[0]!.name).toBe('id')
  expect((fn.signatures[0]!.params[0]!.type as T.Type<'intrinsic'>).name).toBe('string')
  expect((fn.signatures[0]!.return as T.Type<'intrinsic'>).name).toBe('number')
  const m = api.members.find((x) => x.kind === 'method') as T.Part<'method'>
  expect(m.name).toBe('m')
  expect((m.signatures[0]!.return as T.Type<'intrinsic'>).name).toBe('number')
})

test('infers curried return types as function types', () => {
  const idx = scanFixture(`export const add = (a: number) => (b: number) => a + b`)
  const ret = byName<'function'>(idx, 'add').signatures[0]!.return as T.Type<'function-type'>
  expect(ret.kind).toBe('function-type')
  expect(ret.signatures[0]!.params[0]!.name).toBe('b')
  expect((ret.signatures[0]!.return as T.Type<'intrinsic'>).name).toBe('number')
})

test('instantiates generic signatures from the checker', () => {
  const idx = scanFixture(`
    declare function wrap<T>(x: T): () => T
    export const g = wrap(42)
  `)
  const g = typeOf(idx, 'g') as T.Type<'function-type'>
  expect(g.kind).toBe('function-type')
  // The checker's instantiated return, not the declaration's `T`.
  expect((g.signatures[0]!.return as T.Type<'intrinsic'>).name).toBe('number')
})

test('terminates on self-referential inferred types', () => {
  const idx = scanFixture(`export const f = () => f`)
  const ret = byName<'function'>(idx, 'f').signatures[0]!.return as T.Type<'function-type'>
  expect(ret.kind).toBe('function-type')
  // Only the cyclic occurrence degrades to text.
  expect(ret.signatures[0]!.return.kind).toBe('unknown')
})

test('collapses boolean literal pairs in inferred unions', () => {
  const idx = scanFixture(`export const flag = [true, undefined][0]`)
  const u = typeOf(idx, 'flag') as T.Type<'union'>
  expect(u.kind).toBe('union')
  expect(u.types.map((x) => (x as T.Type<'intrinsic'>).name).sort()).toEqual(['boolean', 'undefined'])
})

test('keeps readonly on inferred readonly arrays', () => {
  const idx = scanFixture(`export function ro(xs: readonly number[]) { return xs }`)
  const ret = byName<'function'>(idx, 'ro').signatures[0]!.return as T.Type<'type-operator'>
  expect(ret.kind).toBe('type-operator')
  expect(ret.operator).toBe('readonly')
  expect(ret.target.kind).toBe('array')
})

test('infers type parameters as type-parameter references', () => {
  const idx = scanFixture(`export function first<T>(xs: T[]) { return xs[0] }`)
  const ret = byName<'function'>(idx, 'first').signatures[0]!.return as T.Type<'reference'>
  expect(ret.kind).toBe('reference')
  expect(ret.name).toBe('T')
  expect(ret.target.type).toBe('external')
  expect((ret.target as Extract<T.TypeReferenceTarget, { type: 'external' }>).external).toBe('type-parameter')
})

test('infers enum members and widened enums as references', () => {
  const idx = scanFixture(`
    export enum Color { Red, Green }
    export const r = Color.Red
    export let w = Color.Red
  `)
  const r = typeOf(idx, 'r') as T.Type<'reference'>
  expect(r.kind).toBe('reference')
  expect(r.name).toBe('Color.Red')
  expect(r.target.type).toBe('internal')
  expect((r.target as Extract<T.TypeReferenceTarget, { type: 'internal' }>).id).toBe(byName(idx, 'Color').id)

  const w = typeOf(idx, 'w') as T.Type<'reference'>
  expect(w.kind).toBe('reference')
  expect(w.name).toBe('Color')
  expect(w.target.type).toBe('internal')
})

test('infers index signatures in anonymous records', () => {
  const idx = scanFixture(`
    export const m = {} as { [k: string]: number }
    export const mixed = {} as { a: 1; [k: string]: number }
  `)
  const m = typeOf(idx, 'm') as T.Type<'record'>
  expect(m.kind).toBe('record')
  const sig = m.members[0] as T.Part<'index-signature'>
  expect(sig.kind).toBe('index-signature')
  expect(sig.parameter.name).toBe('k')
  expect((sig.parameter.type as T.Type<'intrinsic'>).name).toBe('string')
  expect((sig.type as T.Type<'intrinsic'>).name).toBe('number')

  const mixed = typeOf(idx, 'mixed') as T.Type<'record'>
  expect(mixed.members.map((x) => x.kind).sort()).toEqual(['index-signature', 'property'])
})

test('infers anonymous class expressions as construct signatures', () => {
  const idx = scanFixture(`export const Maker = class { x = 1 }`)
  const maker = typeOf(idx, 'Maker') as T.Type<'function-type'>
  expect(maker.kind).toBe('function-type')
  expect(maker.signatures[0]!.construct).toBe(true)
  expect(maker.signatures[0]!.return.kind).toBe('record')
})

test('structures DAG-shared anonymous types at every occurrence', () => {
  const idx = scanFixture(`
    const inner = { x: 1 }
    export const o = { a: inner, b: inner }
  `)
  const o = typeOf(idx, 'o') as T.Type<'record'>
  const members = o.members.filter((m) => m.kind === 'property') as T.Part<'property'>[]
  expect(members.map((m) => m.type.kind)).toEqual(['record', 'record'])
})
