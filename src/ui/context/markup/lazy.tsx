import { createMemo, createResource } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import { MarkupContext } from './context.ts'

const load = Promise.all([import('./dep/highlight.ts'), import('./dep/md.ts')]).then(([highlight, markdown]) => ({
  highlight,
  markdown,
}))

export const LazyMarkupProvider = (props: { children: JSX.Element }) => {
  const [data] = createResource(() => load)

  const ctx = createMemo<MarkupContext | undefined>(() => {
    const h = data()
    if (!h) return undefined
    return { highlight: h.highlight.highlight, markdown: h.markdown.buildMarkdown(h.highlight.highlight) }
  })

  return <MarkupContext.Provider value={ctx}>{props.children}</MarkupContext.Provider>
}
