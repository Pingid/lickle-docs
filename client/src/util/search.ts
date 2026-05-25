import { create, insert, search } from '@orama/orama'

import { effectiveKind } from './kind.js'
import type { ReflectionIndex } from './reflection.js'

export type SearchHit = { name: string; qualified: string; kind: number; slug: string }

export type SearchEngine = { query: (term: string, limit?: number) => Promise<SearchHit[]> }

/**
 * Build an in-browser Orama index over every routable reflection in `idx`.
 * Names are boosted above qualified paths so exact-name hits rank first;
 * `tolerance: 1` allows one-character typos.
 */
export const createSearchEngine = async (idx: ReflectionIndex): Promise<SearchEngine> => {
  const db = await create({
    schema: { name: 'string', qualified: 'string', kind: 'number', slug: 'string' },
    components: { tokenizer: { stemming: false } },
  })
  for (const r of idx.routables) {
    const slug = idx.slugById.get(r.id)
    if (!slug) continue
    await insert(db, {
      name: r.name,
      qualified: idx.qualifiedNameById.get(r.id) ?? r.name,
      kind: effectiveKind(r),
      slug,
    })
  }
  return {
    query: async (term, limit = 20) => {
      const t = term.trim()
      if (!t) return []
      const res = await search(db, {
        term: t,
        properties: ['name', 'qualified'],
        boost: { name: 2 },
        tolerance: 1,
        limit,
      })
      return res.hits.map((h) => h.document as unknown as SearchHit)
    },
  }
}
