import { createMemo, type Accessor } from 'solid-js'
import { Marked, type Tokens } from 'marked'

import { useHighlighter } from '../../context/index.tsx'
import { withBaseUrl } from '../../util/base.ts'

export type MarkdownParser = (x: string, lookup: (raw: string) => string | undefined) => string
const M = new Marked({ gfm: true, breaks: false })

/**
 * @group hooks
 * */
export const useMarkdown = (): Accessor<MarkdownParser> => {
  const highligher = useHighlighter()
  const code = createMemo(() => {
    const hltr = highligher()
    const highlight = (x: { text: string; lang: string }) => hltr?.codeToHtml(x.text, { lang: x.lang }) ?? x.text
    return codeBlockRenderer(hltr?.available ?? new Set(), highlight)
  })

  const parser = createMemo(() => {
    return (x: string, lookup: (raw: string) => string | undefined) =>
      M.use({ renderer: { code: code(), codespan: codespanRenderer(lookup) } }).parse(x, { async: false })
  })

  return parser
}

const codespanRenderer = (lookup: (raw: string) => string | undefined) => (c: Tokens.Codespan) => {
  if (lookup && ID.test(c.text)) {
    const slug = lookup(c.text)
    if (slug) return `<a href="${withBaseUrl(slug)}" class="codelink"><code>${c.text}</code></a>`
  }
  return `<code>${c.text}</code>`
}

const codeBlockRenderer =
  (available: Set<string>, highlight: (p: { text: string; lang: string }) => string) => (c: Tokens.Code) => {
    if (c.lang && available.has(c.lang)) {
      try {
        return highlight({ text: c.text, lang: c.lang })
      } catch {
        /* fall through */
      }
    }
    return `<pre class="codeblock"><code>${escape(c.text)}</code></pre>`
  }

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ID = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/
