type Fn = (...args: any[]) => any
export const memo = <F extends Fn>(fn: F): F => {
  const cache = new Map<string, ReturnType<F>>()
  return ((...args: any[]) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) return cache.get(key)!
    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as F
}

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
