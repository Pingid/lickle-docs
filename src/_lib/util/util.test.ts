import { describe, test, expect } from 'vitest'

import { deepMerge } from './index.ts'

describe('deepMerge', () => {
  test('merges two objects', () => {
    const result = deepMerge({ a: 1, b: { c: 2 } }, { a: 3, b: { d: 4 } })
    expect(result).toEqual({ a: 3, b: { c: 2, d: 4 } })
  })
  test('merges two objects with different types', () => {
    const result = deepMerge({ a: 1, b: { c: 2 } }, { a: '3', b: { d: 4 } })
    expect(result).toEqual({ a: '3', b: { c: 2, d: 4 } })
  })
})
