import { createMemo, type Accessor } from 'solid-js'

import { createSearchEngine, type SearchEngine } from '../util/search.ts'
import { useProject, type Types } from '../context/index.ts'
import { commentSummaryText } from '../util/comment.ts'

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
  const project = useProject()
  return {
    byId: (id: number): string | undefined => project().routeForId(id)?.slug,
    byName: (name: string): string | undefined => project().routeByName(name)?.slug,
  }
}

// ============================================================================
// REFERENCES
// "Used in" rows, materialized from each page's `referencedIn` id list.
// ============================================================================

export interface ReferenceRow {
  decl: Types.Declaration
  slug: string
  /** Everything before the final dot of the qualified name. Empty for top-level symbols. */
  module: string
  name: string
  qualified: string
  summary: string
}

export const useReferences = (id: () => number): Accessor<ReferenceRow[]> => {
  const project = useProject()
  return createMemo(() => buildReferenceRows(project(), id()))
}

const buildReferenceRows = (project: Types.Project, id: number): ReferenceRow[] => {
  const route = project.routeForId(id)
  if (!route || route.page.kind === 'markdown') return []

  const seen = new Set<number>()
  const out: ReferenceRow[] = []
  for (const refId of route.page.referencedIn) {
    if (refId === id || seen.has(refId)) continue
    seen.add(refId)
    const refRoute = project.routeForId(refId)
    const decl = project.byId(refId)
    if (!refRoute || refRoute.page.kind === 'markdown' || !decl) continue
    const qualified = refRoute.page.qualified
    const dot = qualified.lastIndexOf('.')
    out.push({
      decl,
      slug: refRoute.slug,
      module: dot < 0 ? '' : qualified.slice(0, dot),
      name: dot < 0 ? qualified : qualified.slice(dot + 1),
      qualified,
      summary: commentSummaryText(decl.comment),
    })
  }
  return out.sort((a, b) => a.qualified.localeCompare(b.qualified))
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

export const useCommentMarkdown = (comment: () => Types.Comment) => {
  const slugs = useSlugFor()
  const slugOf = (name: string) => slugs.byName(name)
  return createMemo(() => commentToMarkdown(comment(), slugOf))
}

const commentToMarkdown = (comment: Types.Comment, slugOf: (name: string) => string | undefined): string => {
  let out = ''
  for (const p of comment.parts) {
    if (p.kind === 'text') {
      out += p.text
      continue
    }
    const label = p.text ?? p.target
    const slug = slugOf(p.target)
    const display = p.style === 'code' ? `\`${label}\`` : label
    out += slug ? `[${display}](/${slug})` : display
  }
  return out
}
