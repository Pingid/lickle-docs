import { type Accessor, createContext, createMemo, createResource, type ResourceReturn, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import { createHighlighterCore, type LanguageInput } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import githubLight from 'shiki/dist/themes/github-light.mjs'
import githubDark from 'shiki/dist/themes/github-dark.mjs'

export type CodeHighlighter = {
  available: Set<string>
  codeToHtml: (text: string, options: { lang: string }) => string
}

// The context stores the resource return directly
const HighlightingContext = createContext<ResourceReturn<CodeHighlighter>>()

export function LanguagesProvider(props: {
  langs: Accessor<{ name: string; import: LanguageInput }[]>
  children: JSX.Element
}) {
  const avaliable = createMemo<Set<string>>(() => new Set(props.langs().map((l) => l.name)))

  const resource = createResource(props.langs, async (langs) => {
    const h = await createHighlighterCore({
      engine: createOnigurumaEngine(() => import('shiki/wasm')),
      themes: [githubDark, githubLight],
      langs: langs.map((l) => l.import),
    })

    return {
      available: avaliable(),
      codeToHtml: (text: string, options: { lang: string }) =>
        h.codeToHtml(text, {
          themes: { light: 'github-light', dark: 'github-dark' },
          lang: langOf(options.lang, avaliable()),
        }),
    }
  })

  return <HighlightingContext.Provider value={resource}>{props.children}</HighlightingContext.Provider>
}

export const useHighlighter = () => {
  const resource = useContext(HighlightingContext)
  const h = resource?.[0]
  return createMemo<CodeHighlighter | undefined>(() => h?.())
}

// ---------------- LANGUAGE LOOKUP ----------------
const aliases: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
}

const has = (info: string, available: Set<string>) => {
  if (available.has(info)) return info
  if (aliases[info] && available.has(aliases[info])) return aliases[info]
  return undefined
}

const langOf = (info: string | undefined, available: Set<string>) => {
  if (!info) return 'text'

  const matched = has(info, available)
  if (matched) return matched
  const base = info.slice(0, -1) || 'text'

  if (available.has(base)) {
    console.warn(`Missing language: ${info}x, using instead ${base}`)
    return base
  }

  console.warn(`Missing language: ${info}, using instead text, add '${info}' to the languages config`)
  return info ?? 'text'
}
