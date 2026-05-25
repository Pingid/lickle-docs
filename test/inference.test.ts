import { test } from 'node:test'
import assert from 'node:assert/strict'

import { scanFixture, byName, typeOf } from './fixture.ts'
import type * as T from '../src/core/reflect/types.ts'

test('infers primitive and literal variable types', () => {
  const idx = scanFixture(`
    export const n = 42
    export const s = 'hi'
    export const b = true
    export const big = 10n
  `)
  assert.equal((typeOf(idx, 'n') as T.Type<'literal'>).value, 42)
  assert.equal((typeOf(idx, 's') as T.Type<'literal'>).value, 'hi')
  assert.equal((typeOf(idx, 'b') as T.Type<'literal'>).value, true)
  assert.equal((typeOf(idx, 'big') as T.Type<'literal'>).value, 10n)
})

test('infers arrays, unions, and nested object literals', () => {
  const idx = scanFixture(`
    export const arr = [1, 2, 3]
    export const u = Math.random() > 0.5 ? 1 : 'one'
    export const obj = { x: 1, nested: { z: true } }
  `)
  const arr = typeOf(idx, 'arr') as T.Type<'array'>
  assert.equal(arr.kind, 'array')
  assert.equal((arr.elementType as T.Type<'intrinsic'>).name, 'number')

  const u = typeOf(idx, 'u') as T.Type<'union'>
  assert.equal(u.kind, 'union')
  assert.equal(u.types.length, 2)

  const obj = typeOf(idx, 'obj') as T.Type<'record'>
  assert.equal(obj.kind, 'record')
  assert.deepEqual(
    obj.properties.map((p) => p.name),
    ['x', 'nested'],
  )
  const nested = obj.properties.find((p) => p.name === 'nested')!.type as T.Type<'record'>
  assert.equal(nested.kind, 'record')
})

test('infers function return types', () => {
  const idx = scanFixture(`export function add(a: number, b: number) { return a + b }`)
  const fn = byName<'function'>(idx, 'add')
  assert.equal((fn.signatures[0]!.return as T.Type<'intrinsic'>).name, 'number')
})

test('inferred references resolve to internal ids and stdlib', () => {
  const idx = scanFixture(`
    export class Foo { count = 0 }
    export const foo = new Foo()
    export const when = new Date()
  `)
  const foo = typeOf(idx, 'foo') as T.Type<'reference'>
  assert.equal(foo.kind, 'reference')
  assert.equal(foo.name, 'Foo')
  assert.equal(foo.type, 'internal')
  assert.equal(foo.targetId, byName(idx, 'Foo').id)

  const when = typeOf(idx, 'when') as T.Type<'reference'>
  assert.equal(when.type, 'external')
  assert.equal((when as Extract<T.Type<'reference'>, { type: 'external' }>).external, 'stdlib')
})

test('falls back to a text node for exotic inferred types', () => {
  const idx = scanFixture(`export const t = [1, 'a'] as const`)
  const t = typeOf(idx, 't')
  // Tuples are not structured — they surface as the checker's string form.
  assert.equal(t.kind, 'unknown')
  assert.match((t as T.Type<'unknown'>).text, /readonly \[/)
})
