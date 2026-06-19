import { createHash } from 'node:crypto'

import type { DeepMerge } from '../t.ts'

type Fn = (...args: any[]) => any

/** Cache on the first argument */
export const memo1 = <F extends Fn>(fn: F): F => {
  const cache = new Map<any, ReturnType<F>>()
  return ((...args: any[]) => {
    const key = args[0]
    if (cache.has(key)) return cache.get(key)!
    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as F
}

/** Cache on the first argument */
export const memo = <F extends Fn>(fn: F): F => {
  let called = false
  let result: any
  return ((...args: any[]) => {
    if (!called) return (result = fn(...args))
    return result
  }) as F
}

/** Serialise overlapping async invocations; if a call arrives mid-run, replay once. */
export const serial = (fn: () => Promise<any>) => {
  let busy = false
  let queued = false
  const run = async (): Promise<void> => {
    if (busy) return void (queued = true)
    busy = true
    try {
      await fn()
    } catch (e) {
      console.error('[build]', e)
    }
    busy = false
    if (queued) {
      queued = false
      await run()
    }
  }
  return run
}

export const deepMerge = <T, U>(a: T, b: U): DeepMerge<T, U> => {
  if (!isObject(a) || !isObject(b)) return b as any
  const result = { ...a } as any
  for (const key in b) {
    if (Object.prototype.hasOwnProperty.call(b, key)) {
      if (key === '__proto__' || key === 'constructor') continue
      const valA = result[key]
      const valB = b[key]
      if (isObject(valA) && isObject(valB)) result[key] = deepMerge(valA, valB)
      else result[key] = valB
    }
  }

  return result
}
const isObject = (obj: any): obj is Record<string, any> =>
  obj !== null && typeof obj === 'object' && !Array.isArray(obj)

export const hash = (str: string) => createHash('sha256').update(str).digest('hex')
