import { createMemo } from 'solid-js'

import { useDeclarationId, useMarkup, useProject, type Types } from '../context/index.tsx'
import { createSearchEngine, type SearchEngine } from '../util/search.ts'
import { commentToMarkdown } from '../util/markdown.ts'

// ============================================================================
// SELECTOR HOOKS
// Thin readers over the project bag. Components should reach for these instead
// of pulling `project` apart directly.
// ============================================================================

/**
 * Slug accessors keyed two ways. `byId` is the id-driven path used by render
 * code; `byName` powers `{@link Foo}` / `<code>Foo</code>` resolution (short
 * names and qualified names both resolve via the project's name index).
 */
export const useSlugFor = () => {
  const id = useDeclarationId()
  const project = useProject()
  return {
    byId: (id: number): string | undefined => project().routes.get({ id })?.slug,
    byName: (name: string): string | undefined => {
      const decl = project().byName(name, id())
      if (!decl) return undefined
      return project().routes.get({ id: decl.id })?.slug
    },
  }
}

// ============================================================================
// SEARCH
// `createSearchEngine` is async (Orama indexing). Cached per project so the
// palette pays the cost once per session, even if it opens and closes.
// ============================================================================

const searchCache = new WeakMap<object, Promise<SearchEngine>>()

/**
 * Returns a thunk that builds (or returns the cached) search engine for the
 * current project. Callers wrap the thunk in their own resource/effect.
 */
export const useSearch = (): (() => Promise<SearchEngine>) => {
  const project = useProject()
  return () => buildSearch(project())
}

const buildSearch = (project: Types.Project): Promise<SearchEngine> => {
  const cached = searchCache.get(project)
  if (cached) return cached
  const p = createSearchEngine(project)
  searchCache.set(project, p)
  return p
}

export const useRenderMarkdown = (text: string) => {
  const markup = useMarkup()
  const slugs = useSlugFor()
  return createMemo(() => markup()?.markdown(text, (name) => slugs.byName(name) ?? name))
}

export const useCommentMarkdown = (comment: () => Types.Comment) => {
  const slugs = useSlugFor()
  const slugOf = (name: string) => slugs.byName(name)
  return createMemo(() => commentToMarkdown(comment(), slugOf))
}
