import { createMemo, type Accessor } from 'solid-js'
import * as docs from '../../core/client.ts'

import { createSearchEngine, type SearchEngine } from '../util/search.ts'
import { useProject, type Project } from '../context/project.tsx'
import { commentSummaryText } from '../util/comment.ts'
import type { NavGroup } from '../strategies/index.ts'
import { isRoutable } from '../util/kind.ts'

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
    const id = typeof v === 'number' ? v : project.idBySlug.get(v)
    return id != null ? project.declarationsById.get(id) : undefined
  })
}

/**
 * Slug accessors keyed two ways. `byId` is the id-driven path used by render
 * code; `byName` powers `{@link Foo}` / `<code>Foo</code>` resolution.
 */
export const useSlugFor = () => {
  const project = useProject()
  return {
    byId: (id: number) => project.slugById.get(id),
    byName: (name: string) => project.slugByName.get(name),
  }
}

/** Sidebar groups produced by the active `NavStrategy`. */
export const useNavGroups = (): NavGroup[] => useProject().navGroups

// ============================================================================
// REFERENCES
// Materializes "used by" rows for a declaration. The shape is committed
// public contract; renderers are free to project / re-sort it.
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
  return createMemo(() => buildReferenceRows(project, id()))
}

const buildReferenceRows = (project: docs.Project, id: number): ReferenceRow[] => {
  const target = project.declarationsById.get(id)
  if (!target) return []
  const referencedBy = docs.queriesOf(target)?.referencedBy
  if (!referencedBy) return []

  const seen = new Set<number>()
  const out: ReferenceRow[] = []
  for (const ref of referencedBy()) {
    const ancestor = routableAncestor(ref.$.enclosingDeclaration)
    if (!ancestor || ancestor.id === id) continue
    if (seen.has(ancestor.id)) continue
    seen.add(ancestor.id)
    const slug = project.slugById.get(ancestor.id)
    if (!slug) continue
    const name = docs.nameOf(ancestor)
    const qualified = project.qualifiedNameById.get(ancestor.id) ?? name
    const dot = qualified.lastIndexOf('.')
    out.push({
      decl: ancestor,
      slug,
      module: dot < 0 ? '' : qualified.slice(0, dot),
      name: dot < 0 ? qualified : qualified.slice(dot + 1),
      qualified,
      summary: commentSummaryText(ancestor.comment),
    })
  }
  return out.sort((a, b) => a.qualified.localeCompare(b.qualified))
}

/**
 * Climb `$.module` until a routable declaration appears. The reference's
 * enclosing decl is usually that already, but references that bubble up
 * through type-aliases or method bodies need an extra step.
 */
const routableAncestor = (decl: docs.Declaration): docs.Declaration | undefined => {
  let cur: docs.Declaration | undefined = decl
  while (cur) {
    if (isRoutable(cur.kind)) return cur
    cur = docs.queriesOf(cur)?.module
  }
  return undefined
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
  const bag = useProject()
  return () => buildSearch(bag)
}

const buildSearch = (bag: Project): Promise<SearchEngine> => {
  const cached = searchCache.get(bag.project)
  if (cached) return cached
  const p = createSearchEngine(bag)
  searchCache.set(bag.project, p)
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
    out += slug ? `[${display}](/r/${slug})` : display
  }
  return out
}
