import { createContext, createMemo, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import type { Components } from './types.js'

const ComponentsCtx = createContext<Components>({})

/**
 * Provide a component registry to descendants. When nested inside another
 * `<ComponentsProvider>` the inner value is deep-merged onto the outer one,
 * so a wrapper preset can establish defaults that an app extends without
 * losing the outer's entries.
 */
export const ComponentsProvider = (props: { value?: Components; children: JSX.Element }) => {
  const outer = useContext(ComponentsCtx)
  const merged = createMemo<Components>(() => deepMerge(outer, props.value ?? {}))
  return <ComponentsCtx.Provider value={merged()}>{props.children}</ComponentsCtx.Provider>
}

/** Read the active (already-merged) component registry. */
export const useComponents = (): Components => useContext(ComponentsCtx)

/**
 * Recursive merge that bottoms out on functions, arrays, and primitives.
 * The right-hand value wins at every leaf; nested plain objects (the four
 * registry buckets and their per-key sub-records) are walked.
 */
const isPlain = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function'

const deepMerge = <T,>(a: T, b: T): T => {
  if (!isPlain(a) || !isPlain(b)) return b ?? a
  const out: Record<string, unknown> = { ...a }
  for (const k of Object.keys(b)) {
    const av = (a as Record<string, unknown>)[k]
    const bv = (b as Record<string, unknown>)[k]
    out[k] = av !== undefined && bv !== undefined ? deepMerge(av as any, bv as any) : (bv ?? av)
  }
  return out as T
}
