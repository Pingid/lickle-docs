import { create, insert, search } from '@orama/orama'

import { nameOf } from '../../core/client.ts'

import type { Project } from '../context/project.tsx'
import { type Kind } from './kind.ts'

export type SearchHit = { name: string; qualified: string; kind: Kind; slug: string }

export type SearchEngine = { query: (term: string, limit?: number) => Promise<SearchHit[]> }

/**
 * Build an in-browser Orama index over every routable reflection in `bag`.
 * Names are boosted above qualified paths so exact-name hits rank first;
 * `tolerance: 1` allows one-character typos.
 */
export const createSearchEngine = async (bag: Project): Promise<SearchEngine> => {
  const db = await create({
    schema: { name: 'string', qualified: 'string', kind: 'string', slug: 'string' },
    components: { tokenizer: { stemming: false } },
  })
  for (const r of bag.routables) {
    const slug = bag.slugById.get(r.id)
    if (!slug) continue
    const name = nameOf(r)
    await insert(db, {
      name,
      qualified: bag.qualifiedNameById.get(r.id) ?? name,
      kind: r.kind as Kind,
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
