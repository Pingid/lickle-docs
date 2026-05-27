import type { Highlighter } from 'shiki'
import { Marked } from 'marked'

let highlighterPromise: Promise<Highlighter> | null = null

const LANGS = ['ts', 'tsx', 'js', 'jsx', 'json', 'bash', 'html', 'css', 'md']

export const getHighlighter = (): Promise<Highlighter> => {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((s) =>
      s.createHighlighter({ themes: ['github-light', 'github-dark'], langs: LANGS }),
    )
  }
  return highlighterPromise
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const langOf = (info: string | undefined) => {
  const raw = (info ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (!raw) return 'text'
  if (LANGS.includes(raw)) return raw
  if (raw === 'sh' || raw === 'zsh') return 'bash'
  if (raw === 'typescript') return 'ts'
  if (raw === 'javascript') return 'js'
  return 'text'
}

/** Lookup for inline-code auto-linking. Receives the raw `code` text, returns a slug or undefined. */
export type CodespanLookup = (raw: string) => string | undefined

const ID = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/

const buildMarked = (h: Highlighter | null, lookup?: CodespanLookup) => {
  const m = new Marked({
    gfm: true,
    breaks: false,
    renderer: {
      code({ text, lang }) {
        const language = langOf(lang)
        if (h && language !== 'text') {
          try {
            return h.codeToHtml(text, {
              lang: language,
              themes: { light: 'github-light', dark: 'github-dark' },
              defaultColor: false,
            })
          } catch {
            /* fall through */
          }
        }
        return `<pre class="codeblock"><code>${escape(text)}</code></pre>`
      },
      codespan({ text }) {
        if (lookup && ID.test(text)) {
          const slug = lookup(text)
          if (slug) return `<a href="/r/${slug}" class="codelink"><code>${text}</code></a>`
        }
        return `<code>${text}</code>`
      },
    },
  })
  return m
}

export const renderMarkdown = async (src: string, lookup?: CodespanLookup): Promise<string> => {
  const h = await getHighlighter().catch(() => null)
  return buildMarked(h, lookup).parse(src) as string
}

export const renderMarkdownSync = (src: string, lookup?: CodespanLookup): string => {
  return buildMarked(null, lookup).parse(src) as string
}
