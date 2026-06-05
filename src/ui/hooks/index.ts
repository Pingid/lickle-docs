import { createMemo, type Accessor } from 'solid-js'

import { createSearchEngine, type SearchEngine } from '../util/search.ts'
import { useDeclarationId, useMarkup, useProject, type Types } from '../context/index.tsx'
import { commentSummaryText } from '../util/comment.ts'
import { docReferenced } from '../util/route.ts'
import { withBaseUrl } from '../util/base.ts'

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
  const route = project.routes.get({ id })
  const refs = route ? (docReferenced(route)?.referenced ?? []) : []

  const seen = new Set<number>()
  const out: ReferenceRow[] = []
  for (const ref of refs) {
    if (ref.target === id || seen.has(ref.target)) continue
    seen.add(ref.target)
    const refRoute = project.routes.get({ id: ref.target })
    const decl = project.byId(ref.target)
    if (!refRoute || !decl) continue
    const qualified = ref.alias || refRoute.title
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
    out += slug ? `[${display}](${withBaseUrl(slug)})` : display
  }
  return out
}
