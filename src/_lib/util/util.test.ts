import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { deepMerge } from './index.ts'

describe('deepMerge', () => {
  test('merges two objects', () => {
    const result = deepMerge({ a: 1, b: { c: 2 } }, { a: 3, b: { d: 4 } })
    assert.deepEqual(result, { a: 3, b: { c: 2, d: 4 } })
  })
  test('merges two objects with different types', () => {
    const result = deepMerge({ a: 1, b: { c: 2 } }, { a: '3', b: { d: 4 } })
    assert.deepEqual(result, { a: '3', b: { c: 2, d: 4 } })
  })
  test('merges two objects with different types', () => {
    const result = deepMerge({ a: 1, b: { c: 2 } }, { a: '3', b: { d: 4 } })
    assert.deepEqual(result, { a: '3', b: { c: 2, d: 4 } })
  })
})
