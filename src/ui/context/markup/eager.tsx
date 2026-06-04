import type { JSX } from 'solid-js/jsx-runtime'
import { createMemo } from 'solid-js'

import { highlight } from './dep/highlight.ts'
import { MarkupContext } from './context.ts'
import { buildMarkdown } from './dep/md.ts'

export const EagerMarkupProvider = (props: { children: JSX.Element }) => {
  const ctx = createMemo<MarkupContext>(() => ({ highlight: highlight, markdown: buildMarkdown(highlight) }))
  return <MarkupContext.Provider value={ctx}>{props.children}</MarkupContext.Provider>
}
