import { type Accessor, createContext, createMemo, useContext } from 'solid-js'
import type { CodeHighlightOptions } from './dep/highlight.ts'

import { useProject } from '../project/index.tsx'

export type MarkupContext = {
  highlight: (options: CodeHighlightOptions) => string
  markdown: (text: string, lookup: (name: string) => string) => string
}
export const MarkupContext = createContext<Accessor<MarkupContext | undefined>>()

export const useMarkup = (): Accessor<MarkupContext | undefined> => {
  const ctx = useContext(MarkupContext)
  if (!ctx) throw new Error('useMarkup must be used within a <MarkupProvider>')
  return ctx
}

export const useRenderMarkdown = (text: string) => {
  const markup = useMarkup()
  const project = useProject()
  return createMemo(() => markup()?.markdown(text, (name) => project().routeByName(name)?.slug ?? name))
}
