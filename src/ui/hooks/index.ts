import { createMemo, type Accessor } from 'solid-js'
import * as docs from '../../core/client.ts'

import { useProject, type Project, type RouteNode } from '../context/index.ts'
import { createSearchEngine, type SearchEngine } from '../util/search.ts'
import { commentSummaryText } from '../util/comment.ts'

// ============================================================================
// SELECTOR HOOKS
// Thin readers over the project bag. Components should reach for these instead
// of pulling `project` apart directly.
// ============================================================================

type Selector<T> = T | (() => T)
const evalSelector = <T>(s: Selector<T>): T => (typeof s === 'function' ? (s as () => T)() : s)

/**
 * Resolve a declaration by id or slug. Pass a function to participate in
 * Solid's reactive graph (e.g. `useReflection(() => params.slug)`).
 */
export const useReflection = (
  selector: Selector<number | string | undefined>,
): Accessor<docs.Declaration | undefined> => {
  const project = useProject()
  return createMemo(() => {
    const v = evalSelector(selector)
    if (v == null) return undefined
    return typeof v === 'number' ? project().byId(v) : project().bySlug(v)
  })
}

/**
 * Slug accessors keyed two ways. `byId` is the id-driven path used by render
 * code; `byName` powers `{@link Foo}` / `<code>Foo</code>` resolution.
 */
export const useSlugFor = () => {
  const project = useProject()
  return {
    byId: (id: number): string | undefined => project().routeForId(id)?.slug,
    byName: (name: string): string | undefined => indexOf(project() ?? []).slugByName.get(name),
  }
}

// ============================================================================
// DERIVED INDEX
// Name -> slug map, built once per project by walking the route tree.
// ============================================================================

type DerivedIndex = { slugByName: Map<string, string> }
const indexCache = new WeakMap<object, DerivedIndex>()

const indexOf = (project: Project): DerivedIndex => {
  const cached = indexCache.get(project)
  if (cached) return cached
  const slugByName = new Map<string, string>()
  const walk = (routes: RouteNode[]): void => {
    for (const r of routes) {
      if (r.page.kind !== 'markdown') {
        const name = project.byId(r.page.id)?.name
        if (name && !slugByName.has(name)) slugByName.set(name, r.slug)
        slugByName.set(r.page.qualified, r.slug)
      }
      walk(r.children)
    }
  }
  walk(project.routes)
  const idx = { slugByName }
  indexCache.set(project, idx)
  return idx
}

// ============================================================================
// REFERENCES
// "Used in" rows, materialized from each page's `referencedIn` id list.
// ============================================================================

export interface ReferenceRow {
  decl: docs.Declaration
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

const buildReferenceRows = (project: Project, id: number): ReferenceRow[] => {
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

const buildSearch = (project: Project): Promise<SearchEngine> => {
  const cached = searchCache.get(project)
  if (cached) return cached
  const p = createSearchEngine(project)
  searchCache.set(project, p)
  return p
}

export const useCommentMarkdown = (comment: () => docs.Comment) => {
  const slugs = useSlugFor()
  const slugOf = (name: string) => slugs.byName(name)
  return createMemo(() => commentToMarkdown(comment(), slugOf))
}

const commentToMarkdown = (comment: docs.Comment, slugOf: (name: string) => string | undefined): string => {
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
