import { create, insert, search } from '@orama/orama'

import * as docs from '../../core/client.ts'

import { type Kind } from './kind.ts'

export type SearchHit = { name: string; qualified: string; kind: Kind; slug: string; file: string }

export type SearchEngine = { query: (term: string, limit?: number) => Promise<SearchHit[]> }

/**
 * Build an in-browser Orama index over every routed page in `project`.
 * Names are boosted above qualified paths so exact-name hits rank first;
 * `tolerance: 1` allows one-character typos. Each declaration is indexed once
 * — re-export routes share a declaration id, so they're de-duplicated here.
 */
export const createSearchEngine = async (project: docs.Project): Promise<SearchEngine> => {
  const db = await create({
    // `terms` holds the name/qualified split into sub-words so `provider`
    // matches `ProjectProvider` and `render error` matches `renderError`.
    schema: { name: 'string', qualified: 'string', kind: 'string', slug: 'string', file: 'string', terms: 'string' },
    components: { tokenizer: { stemming: false } },
  })

  const seen = new Set<number>()
  const walk = async (routes: docs.RouteNode[]): Promise<void> => {
    for (const r of routes) {
      if (r.page.kind !== 'markdown' && !seen.has(r.page.id)) {
        seen.add(r.page.id)
        const decl = project.byId(r.page.id)
        const kind = (decl?.kind ?? 'module') as Kind
        await insert(db, {
          name: r.label,
          qualified: r.page.qualified,
          kind,
          slug: r.slug,
          file: decl?.sources?.[0]?.file ?? '',
          terms: termsOf(r.label, r.page.qualified),
        })
      }
      await walk(r.children)
    }
  }
  await walk(project.routes)

  return {
    query: async (term, limit = 20) => {
      const t = term.trim()
      if (!t) return []
      const res = await search(db, {
        term: t,
        properties: ['name', 'qualified', 'terms'],
        boost: { name: 3, qualified: 2, terms: 1 },
        tolerance: 1,
        limit,
      })
      return res.hits.map((h) => h.document as unknown as SearchHit)
    },
  }
}

/** Sub-words of the indexed strings, so partial / multi-word queries match. */
const termsOf = (...sources: string[]): string => {
  const words = new Set<string>()
  for (const s of sources) for (const w of splitWords(s)) words.add(w)
  return [...words].join(' ')
}

/**
 * Split an identifier into lowercase words on separators and case boundaries:
 * `getHTMLParser` -> `get html parser`, `render-error` -> `render error`,
 * `a.b_c` -> `a b c`.
 */
const splitWords = (input: string): string[] =>
  input
    .split(/[\s._/\\-]+/)
    .flatMap((part) =>
      part
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/([A-Za-z])([0-9])/g, '$1 $2')
        .split(/\s+/),
    )
    .map((w) => w.toLowerCase())
    .filter(Boolean)
