import type { Layout } from './types.ts'

export const compose = (...layouts: Layout[]): Layout =>
  layouts.reduce<Layout>(
    (below, layout) => (p, cx) => layout(p, { ...cx, default: () => below(p, cx) ?? cx.default() }),
    (_, cx) => cx.default(),
  )
