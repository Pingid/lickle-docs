import { createHighlighterCore, type CodeToHastOptions } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

import githubLight from 'shiki/themes/github-light.mjs'
import githubDark from 'shiki/themes/github-dark.mjs'

import { extractCodeBlocks } from '../util.ts'
import { languages } from './languages.ts'

const h = await createHighlighterCore({
  engine: createJavaScriptRegexEngine(),
  themes: [githubDark, githubLight],
  langs: languages.map((l) => l.import),
})

export type CodeHighlightOptions = {
  text: string
  lang?: string
  structure?: 'inline' | 'classic'
  ignoreFenced?: boolean
}

export type Highlighter = { codeToHtml: (options: CodeHighlightOptions) => string }

export const highlight = (options: CodeHighlightOptions) => {
  const opts = {
    lang: options.lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
    structure: options.structure,
  } as const

  const codeToHtml = (text: string, options: CodeToHastOptions) => {
    try {
      return h.codeToHtml(text, { ...options, lang: langOf(options.lang) })
    } catch (err) {
      console.error('[Highlight] failed to highlight', err)
      return text
    }
  }

  if (!options.ignoreFenced) {
    const extracted = extractCodeBlocks(options.text)?.[0]
    if (extracted) {
      if (!h || !extracted) return ''
      const text = extracted.code ?? options.text
      const lang = extracted.lang ?? options.lang ?? 'ts'
      return codeToHtml(text, { ...opts, lang })
    }
  }
  return codeToHtml(options.text, { ...opts, lang: options.lang ?? 'text' })
}

// ---------------- LANGUAGE LOOKUP ----------------
const langs = new Set(languages.map((l) => l.name))
const aliases: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
}

const has = (info: string) => {
  if (langs.has(info)) return info
  if (aliases[info] && langs.has(aliases[info])) return aliases[info]
  return undefined
}

export const langOf = (info: string | undefined) => {
  if (!info) return 'text'

  const matched = has(info)
  if (matched) return matched

  const base = info.slice(0, -1) || 'text'
  if (langs.has(base)) {
    console.warn(`Missing language: ${info}x, using instead ${base}`)
    return base
  }

  console.warn(`Missing language: ${info}, using instead text, add '${info}' to the languages config`)
  return info ?? 'text'
}
