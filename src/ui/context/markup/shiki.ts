import type { HighlighterCore } from 'shiki/core'

import { extractCodeBlocks } from './util.ts'

export type CodeToHtmlOptions = {
  text: string
  lang?: string
  structure?: 'inline' | 'classic'
  markdown?: boolean
}

export type Highlighter = { codeToHtml: (options: CodeToHtmlOptions) => string }

export const highlighter = async (): Promise<Highlighter> => {
  const h = await getHighlighter()
  const codeToHtml = (options: CodeToHtmlOptions) => {
    const opts = {
      lang: options.lang ?? 'ts',
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      structure: options.structure,
    } as const

    if (options.markdown) {
      const extracted = extractCodeBlocks(options.text)?.[0]
      if (extracted) {
        if (!h || !extracted) return ''
        const text = extracted.code ?? options.text
        const lang = extracted.lang ?? options.lang ?? 'ts'
        return h.codeToHtml(text, { ...opts, lang: lang })
      }
    }
    return h.codeToHtml(options.text, opts)
  }
  return { codeToHtml }
}

/**
 * Fine-grained Shiki bundle: only the langs/themes below are emitted as chunks.
 * Importing the default `shiki` entry would code-split every grammar and theme.
 */
export const getHighlighter = (): Promise<HighlighterCore> => {
  if (!highlighterPromise) highlighterPromise = buildHighlighter()
  return highlighterPromise
}
let highlighterPromise: Promise<HighlighterCore> | null = null

const buildHighlighter = (): Promise<HighlighterCore> => {
  return Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
    import('shiki/themes/github-light.mjs'),
    import('shiki/themes/github-dark.mjs'),
    Promise.all([
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/tsx.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/jsx.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/html.mjs'),
      import('shiki/langs/css.mjs'),
      import('shiki/langs/markdown.mjs'),
    ]),
  ]).then(([core, js, light, dark, langs]) =>
    core.createHighlighterCore({
      engine: js.createJavaScriptRegexEngine(),
      themes: [light.default, dark.default],
      langs: langs.map((m) => m.default),
    }),
  )
}
