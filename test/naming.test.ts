import { test, expect } from 'vitest'

import { labelOf, pluralLabel, shortOf, isRoutable, kindOrder } from '../src/core/naming.ts'

test('labelOf maps kinds to display labels, unknown to "symbol"', () => {
  expect(labelOf('type-alias')).toBe('type')
  expect(labelOf('function')).toBe('function')
  expect(labelOf('record')).toBe('object')
  expect(labelOf('widget')).toBe('symbol')
})

test('pluralLabel pluralises known kinds and falls back to labelOf + "s"', () => {
  expect(pluralLabel('function')).toBe('functions')
  expect(pluralLabel('type-alias')).toBe('types')
  expect(pluralLabel('class')).toBe('classes')
  expect(pluralLabel('widget')).toBe('symbols')
})

test('shortOf returns a glyph for known kinds, "·" otherwise', () => {
  expect(shortOf('function')).toBe('ƒ')
  expect(shortOf('type-alias')).toBe('T')
  expect(shortOf('widget')).toBe('·')
})

test('isRoutable is true for routable declaration kinds only', () => {
  for (const kind of ['module', 'namespace', 'class', 'interface', 'function', 'variable', 'enum', 'type-alias'])
    expect(isRoutable(kind), kind).toBe(true)
  for (const kind of ['property', 'export', 'method', 'parameter']) expect(isRoutable(kind), kind).toBe(false)
})

test('kindOrder orders function < variable < type-alias, unlisted kinds last', () => {
  expect(kindOrder('function')).toBeLessThan(kindOrder('variable'))
  expect(kindOrder('variable')).toBeLessThan(kindOrder('type-alias'))
  expect(kindOrder('record')).toBe(kindOrder('unknown'))
  expect(kindOrder('type-alias')).toBeLessThan(kindOrder('record'))
})
