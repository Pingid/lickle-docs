import { create, insert, search } from '@orama/orama'
import { createMemo, createResource } from 'solid-js'

import { commentToMarkdown } from '../../util/markdown.ts'
import type { Reflect } from '../../context/docs/index.tsx'
import * as DocRouter from '../router/index.ts'
import { useProject } from '../project/index.ts'

/**
 * Full-text search over every declaration page — names, owning module and
 * doc comments. The index (Orama) builds lazily on the client, once per
 * version; before it is ready the returned engine answers with no hits.
 * Powers the `⌘K` search palette.
 * @group hooks
 */
export const useSearch = (): (() => SearchEngine) => {
  const project = useProject()
  const routes = DocRouter.use()
  const [engine] = createResource(
    () => [routes(), project()] as const,
    ([routes, project]) => {
      const router = routes
      const byId = project?.byId
      if (!router || !byId) return undefined
      const existing = INSTANCE.get(router)
      if (existing) return existing
      const engine = createSearchEngine(router, byId)
      INSTANCE.set(router, engine)
      return engine
    },
    // Search is client-only; skip building on the server so the engine's
    // `query` function is never serialized into the hydration payload.
    { ssrLoadFrom: 'initial' },
  )
  return createMemo(() => engine() ?? { query: async () => [] })
}

const INSTANCE = new WeakMap<DocRouter.ClientRouter, Promise<SearchEngine>>()

/** One search result: the declaration's name, kind, page slug, source file and owning module. */
export type SearchHit = { name: string; kind: Reflect.Any['kind']; slug: string; file: string; module: string }

/** A queryable search index. `limit` defaults to 20 hits. */
export type SearchEngine = { query: (term: string, limit?: number) => Promise<SearchHit[]> }

const createSearchEngine = async (
  router: DocRouter.ClientRouter,
  byId: (id: number) => Reflect.Declaration | undefined,
): Promise<SearchEngine> => {
  const db = await create({
    schema: { name: 'string', kind: 'string', slug: 'string', file: 'string', module: 'string', comment: 'string' },
    components: { tokenizer: { stemming: false } },
  })

  for (const route of router.items) {
    if (route.kind === 'doc') {
      const decl = byId(route.decl)
      const kind = decl?.kind ?? 'module'

      // Owning module from the slug hierarchy. Multi-exposed declarations
      // have bare slugs, so the lookup misses and they index without a module.
      const parentSlug = route.slug.split('/').slice(0, -1).join('/')
      const parent = parentSlug ? router.get({ slug: parentSlug }) : undefined

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
