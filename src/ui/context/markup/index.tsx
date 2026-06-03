import { createContext, createMemo, createResource, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import type { Marked } from 'marked'

import { highlighter, type Highlighter, type CodeToHtmlOptions } from './shiki.ts'
import { useProject } from '../project/index.tsx'
import { buildMarked } from './markdown.ts'
import { isServer } from 'solid-js/web'

export * from './util.ts'

export type { Highlighter, CodeToHtmlOptions }

const H = highlighter()

type MarkupContext = {
  promise: Promise<Highlighter>
  highlighter: () => Highlighter | undefined
  marked: () => Marked | undefined
}
const Context = createContext<MarkupContext>()

export const MarkupProvider = (props: { children: JSX.Element }) => {
  if (isServer) {
    return (
      <Context.Provider
        value={{
          promise: Promise.resolve({ codeToHtml: () => '' } as Highlighter),
          highlighter: () => ({ codeToHtml: () => '' }) as Highlighter,
          marked: () => ({ parse: () => '' }) as any as Marked,
        }}
      >
        {props.children}
      </Context.Provider>
    )
  }
  const project = useProject()
  const lookup = (name: string) => project().routeByName(name)?.slug
  const [h] = createResource(async () => await H)
  const marked = createMemo(() => buildMarked(h(), lookup))
  return <Context.Provider value={{ promise: H, highlighter: () => h(), marked }}>{props.children}</Context.Provider>
}

export const useMarkup = (): MarkupContext => {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useMarkup must be used within a <MarkupProvider>')
  return ctx
}

export const useCodeToHtml = (p: { code: string; lang?: string; structure?: 'inline' | 'classic' }) => {
  const markup = useMarkup()
  return createMemo(() => markup.highlighter()?.codeToHtml({ ...p, text: p.code, markdown: true }))
}
