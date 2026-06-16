import type { t } from '../../../_lib/index.ts'
import type * as T from '../types.ts'

export interface Builder<I, D = {}> {
  add: (d: T.Declaration) => void
  build: (deps: D) => I
}

type Infer<I extends Builder<any, any>> = I extends Builder<infer I, infer D> ? { deps: D; idx: I } : never

export const combine = <const B extends Builder<any, any>[]>(
  builders: B,
): Builder<
  t.UnionToIntersection<Infer<B[number]>['idx']>,
  t.UnionToIntersection<Exclude<Infer<B[number]>['deps'], Infer<B[number]>['idx']>>
> => ({
  add: (d) => builders.forEach((b) => b.add(d)),
  build: (deps) => {
    const idx = deps as any
    for (const b of builders) Object.assign(idx, b.build(idx))
    return idx
  },
})
