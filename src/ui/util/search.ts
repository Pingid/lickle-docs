import { create, insert, search } from '@orama/orama'

import { type Types } from '../context/index.tsx'
import { type Kind } from './kind.ts'

export type SearchHit = { name: string; qualified: string; kind: Kind; slug: string; file: string }

export type SearchEngine = { query: (term: string, limit?: number) => Promise<SearchHit[]> }

/**
 * Build an in-browser Orama index over every declaration route in `project`.
 * Names are boosted above qualified paths so exact-name hits rank first;
 * `tolerance: 1` allows one-character typos. Each declaration is indexed once
 * — re-export routes share a declaration id, so they're de-duplicated here.
 * Markdown pages (no declaration) are skipped.
 */
export const createSearchEngine = async (project: Types.Project): Promise<SearchEngine> => {
  const db = await create({
    // `terms` holds the name/qualified split into sub-words so `provider`
    // matches `ProjectProvider` and `render error` matches `renderError`.
    schema: { name: 'string', qualified: 'string', kind: 'string', slug: 'string', file: 'string', terms: 'string' },
    components: { tokenizer: { stemming: false } },
  })

  const seen = new Set<number>()
  for (const route of project.routes.items) {
    if (route.kind !== 'doc' || seen.has(route.decl)) continue
    seen.add(route.decl)
    const decl = project.byId(route.decl)
    const kind = (decl?.kind ?? 'module') as Kind
    const name = decl?.name ?? route.title
    await insert(db, {
      name,
      qualified: route.title,
      kind,
      slug: route.slug,
      file: decl?.sources?.[0]?.file ?? '',
      terms: termsOf(name, route.title),
    })
  }

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
const splitWords = (input: string | undefined | null): string[] => {
  if (!input) return []
  return input
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
}
