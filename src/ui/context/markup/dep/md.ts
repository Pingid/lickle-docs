import { Marked, type RendererObject } from 'marked'

import { withBaseUrl } from '../../../util/base.ts'

export const buildMarkdown = (highlight: (p: { text: string; lang: string }) => string) => {
  const m = new Marked({ gfm: true, breaks: false })
  return (x: string, lookup: (raw: string) => string | undefined) =>
    m.use({ renderer: createRenderer(highlight, lookup) }).parse(x, { async: false })
}

const createRenderer = (
  highlight: (p: { text: string; lang: string }) => string,
  lookup: (raw: string) => string | undefined,
): RendererObject => ({
  code({ text, lang }) {
    if (lang && lang !== 'text') {
      try {
        return highlight({ text, lang: lang })
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
})

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ID = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/
