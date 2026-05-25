import { Marked } from 'marked'

import type { Highlighter } from './shiki.ts'
import { langOf } from './util.ts'
import { withBaseUrl } from '../../util/base.ts'

export const buildMarked = (h: Highlighter | undefined, lookup?: (raw: string) => string | undefined) => {
  const m = new Marked({
    gfm: true,
    breaks: false,
    renderer: {
      code({ text, lang }) {
        const language = langOf(lang)
        if (h && language !== 'text') {
          try {
            return h.codeToHtml({ text, lang: language })
          } catch {
            /* fall through */
          }
        }
        return `<pre class="codeblock"><code>${escape(text)}</code></pre>`
      },
      codespan({ text }) {
        if (lookup && ID.test(text)) {
          const slug = lookup(text)
          if (slug) return `<a href="${withBaseUrl(slug)}" class="codelink"><code>${text}</code></a>`
        }
        return `<code>${text}</code>`
      },
    },
  })
  return m
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ID = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/
