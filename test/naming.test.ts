import { test, expect } from 'vitest'

import { labelOf, pluralLabel, shortOf, isRoutable, groupOrder } from '../src/core/route/naming.ts'

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

test('groupOrder orders functions < variables < types, unknown last', () => {
  expect(groupOrder('functions')).toBeLessThan(groupOrder('variables'))
  expect(groupOrder('variables')).toBeLessThan(groupOrder('types'))
  expect(groupOrder('whatever')).toBe(groupOrder('also-unknown'))
  expect(groupOrder('types')).toBeLessThan(groupOrder('whatever'))
})

test('groupOrder is case- and whitespace-insensitive', () => {
  expect(groupOrder('  Functions ')).toBe(groupOrder('functions'))
  expect(groupOrder('TYPES')).toBe(groupOrder('types'))
})
