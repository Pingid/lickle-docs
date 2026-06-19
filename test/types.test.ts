import { test, expect } from 'vitest'

import type * as T from '../src/core/reflect/types.ts'
import { scanFixture, byName } from './fixture.ts'

const alias = (code: string, name: string): T.Type => byName<'type-alias'>(scanFixture(code), name).type

test('scans conditional types with infer', () => {
  const t = alias(`export type C<T> = T extends Array<infer U> ? U : never`, 'C') as T.Type<'conditional'>
  expect(t.kind).toBe('conditional')
  expect(t.extends.kind).toBe('reference')
  const infer = (t.extends as T.Type<'reference'>).args![0] as T.Type<'infer'>
  expect(infer.kind).toBe('infer')
  expect(infer.name).toBe('U')
})

test('scans indexed-access and mapped types', () => {
  const access = alias(`export type A<T> = T[keyof T]`, 'A') as T.Type<'indexed-access'>
  expect(access.kind).toBe('indexed-access')

  const mapped = alias(`export type M<T> = { readonly [K in keyof T]?: T[K] }`, 'M') as T.Type<'mapped'>
  expect(mapped.kind).toBe('mapped')
  expect(mapped.readonly).toBe(true)
  expect(mapped.optional).toBe(true)
  expect(mapped.typeParameter.name).toBe('K')
})

test('scans query, template-literal, and import types', () => {
  const idx = scanFixture(`
    export const v = 1
    export type Q = typeof v
    export type Tmpl<T extends string> = \`a-\${T}-b\`
    export type I = import('typescript').Node
  `)
  expect((byName<'type-alias'>(idx, 'Q').type as T.Type<'query'>).kind).toBe('query')
  const tmpl = byName<'type-alias'>(idx, 'Tmpl').type as T.Type<'template-literal'>
  expect(tmpl.kind).toBe('template-literal')
  expect(tmpl.head).toBe('a-')
  expect((byName<'type-alias'>(idx, 'I').type as T.Type<'import-type'>).kind).toBe('import-type')
})

test('scans type predicates and the this type', () => {
  const idx = scanFixture(`
    export function isStr(x: unknown): x is string { return typeof x === 'string' }
    export class B { self(): this { return this } }
  `)
  const pred = byName<'function'>(idx, 'isStr').signatures[0]!.return as T.Type<'predicate'>
  expect(pred.kind).toBe('predicate')
  expect(pred.parameter).toBe('x')

  const method = byName<'class'>(idx, 'B').members.find((m) => m.kind === 'method') as T.Part<'method'>
  const self = method.signatures[0]!.return as T.Type<'intrinsic'>
  expect(self.kind).toBe('intrinsic')
  expect(self.name).toBe('this')
})

test('type parameters render as plain references, not anonymous', () => {
  const idx = scanFixture(`export type Id<T> = T`)
  const t = byName<'type-alias'>(idx, 'Id').type as T.Type<'reference'>
  expect(t.kind).toBe('reference')
  expect(t.target.type).toBe('external')
  expect((t.target as Extract<T.TypeReferenceTarget, { type: 'external' }>).external).toBe('type-parameter')
})
