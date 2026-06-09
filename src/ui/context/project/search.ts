import { create, insert, search } from '@orama/orama'

import { commentToMarkdown } from '../../util/markdown.ts'
import * as Types from './types.ts'

export type SearchHit = { name: string; kind: Types.Any['kind']; slug: string; file: string; module: string }

export type SearchEngine = { query: (term: string, limit?: number) => Promise<SearchHit[]> }

export const createSearchEngine = async (
  router: Types.ClientRouter,
  byId: (id: number) => Types.Declaration | undefined,
): Promise<SearchEngine> => {
  const db = await create({
    schema: { name: 'string', kind: 'string', slug: 'string', file: 'string', module: 'string', comment: 'string' },
    components: { tokenizer: { stemming: false } },
  })

  for (const route of router.items) {
    if (route.kind === 'doc') {
      const decl = byId(route.decl)
      const kind = decl?.kind ?? 'module'

      const parent = route.sidebar?.parent ? router.get({ slug: route.sidebar.parent }) : undefined

      const module = parent?.title
      const source = decl?.sources.map((s) => (decl.kind === 'module' ? `${s.file}` : `${s.file}:${s.line}`))?.[0]

      const cmt = decl?.comment ? commentToMarkdown(decl.comment, (name) => router.get({ slug: name })?.slug) : ''

      await insert(db, {
        name: route.title,
        qualified: route.title,
        kind,
        slug: route.slug,
        file: source,
        module,
        comment: cmt,
      })
    }
  }

  return {
    query: async (term, limit = 20) => {
      const t = term.trim()
      if (!t) return []
      const res = await search(db, {
        term: t,
        properties: ['name', 'module', 'comment'],
        boost: { name: 1, module: 1 },
        tolerance: 1,
        limit,
      })
      return res.hits.map((h) => h.document as unknown as SearchHit)
    },
  }
}

// /**
//  * Split an identifier into lowercase words on separators and case boundaries:
//  * `getHTMLParser` -> `get html parser`, `render-error` -> `render error`,
//  * `a.b_c` -> `a b c`.
//  */
// const splitWords = (input: string | undefined | null): string[] => {
//   if (!input) return []
//   return input
//     .split(/[\s._/\\-]+/)
//     .flatMap((part) =>
//       part
//         .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
//         .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
//         .replace(/([A-Za-z])([0-9])/g, '$1 $2')
//         .split(/\s+/),
//     )
//     .map((w) => w.toLowerCase())
//     .filter(Boolean)
// }
