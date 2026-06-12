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
  expect(foo.type).toBe('internal')
  expect(foo.targetId).toBe(byName(idx, 'Foo').id)

  const when = typeOf(idx, 'when') as T.Type<'reference'>
  expect(when.type).toBe('external')
  expect((when as Extract<T.Type<'reference'>, { type: 'external' }>).external).toBe('stdlib')
})

test('falls back to a text node for exotic inferred types', () => {
  const idx = scanFixture(`export const t = [1, 'a'] as const`)
  const t = typeOf(idx, 't')
  // Tuples are not structured — they surface as the checker's string form.
  expect(t.kind).toBe('unknown')
  expect((t as T.Type<'unknown'>).text).toMatch(/readonly \[/)
})
