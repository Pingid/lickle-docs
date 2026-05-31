import { test } from 'node:test'
import assert from 'node:assert/strict'

import { scanFixture, byName } from './fixture.ts'
import type * as T from '../src/core/reflect/types.ts'

const alias = (code: string, name: string): T.Type => byName<'type-alias'>(scanFixture(code), name).type

test('scans conditional types with infer', () => {
  const t = alias(`export type C<T> = T extends Array<infer U> ? U : never`, 'C') as T.Type<'conditional'>
  assert.equal(t.kind, 'conditional')
  assert.equal(t.extends.kind, 'reference')
  const infer = (t.extends as T.Type<'reference'>).args![0] as T.Type<'infer'>
  assert.equal(infer.kind, 'infer')
  assert.equal(infer.name, 'U')
})

test('scans indexed-access and mapped types', () => {
  const access = alias(`export type A<T> = T[keyof T]`, 'A') as T.Type<'indexed-access'>
  assert.equal(access.kind, 'indexed-access')

  const mapped = alias(`export type M<T> = { readonly [K in keyof T]?: T[K] }`, 'M') as T.Type<'mapped'>
  assert.equal(mapped.kind, 'mapped')
  assert.equal(mapped.readonly, true)
  assert.equal(mapped.optional, true)
  assert.equal(mapped.typeParameter.name, 'K')
})

test('scans query, template-literal, and import types', () => {
  const idx = scanFixture(`
    export const v = 1
    export type Q = typeof v
    export type Tmpl<T extends string> = \`a-\${T}-b\`
    export type I = import('typescript').Node
  `)
  assert.equal((byName<'type-alias'>(idx, 'Q').type as T.Type<'query'>).kind, 'query')
  const tmpl = byName<'type-alias'>(idx, 'Tmpl').type as T.Type<'template-literal'>
  assert.equal(tmpl.kind, 'template-literal')
  assert.equal(tmpl.head, 'a-')
  assert.equal((byName<'type-alias'>(idx, 'I').type as T.Type<'import-type'>).kind, 'import-type')
})

test('scans type predicates and the this type', () => {
  const idx = scanFixture(`
    export function isStr(x: unknown): x is string { return typeof x === 'string' }
    export class B { self(): this { return this } }
  `)
  const pred = byName<'function'>(idx, 'isStr').signatures[0]!.return as T.Type<'predicate'>
  assert.equal(pred.kind, 'predicate')
  assert.equal(pred.parameter, 'x')

  const self = byName<'class'>(idx, 'B').methods[0]!.signatures[0]!.return as T.Type<'intrinsic'>
  assert.equal(self.kind, 'intrinsic')
  assert.equal(self.name, 'this')
})

test('type parameters render as plain references, not anonymous', () => {
  const idx = scanFixture(`export type Id<T> = T`)
  const t = byName<'type-alias'>(idx, 'Id').type as T.Type<'reference'>
  assert.equal(t.kind, 'reference')
  assert.equal(t.type, 'external')
  assert.equal((t as Extract<T.Type<'reference'>, { type: 'external' }>).external, 'type-parameter')
})
