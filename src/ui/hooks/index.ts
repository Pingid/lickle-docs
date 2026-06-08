import { useParams } from '@solidjs/router'
import { createMemo } from 'solid-js'

import { useMarkup, useProject, type Types } from '../context/index.tsx'
import { commentToMarkdown } from '../util/markdown.ts'

export const useRoute = () => {
  const params = useParams()
  const project = useProject()
  return createMemo(() => project().routes.get({ slug: params['slug'] ?? '' }))
}

export const useDeclaration = () => {
  const route = useRoute()
  const project = useProject()
  return createMemo(() => {
    const r = route()
    if (!r) return undefined
    if (r.kind === 'doc') return project().byId(r.decl)
    return undefined
  })
}

/**
 * Slug accessors keyed two ways. `byId` is the id-driven path used by render
 * code; `byName` powers `{@link Foo}` / `<code>Foo</code>` resolution (short
 * names and qualified names both resolve via the project's name index).
 */
export const useSlugFor = () => {
  const project = useProject()
  const d = useDeclaration()
  return {
    byId: (id: number): string | undefined => project().routes.get({ id })?.slug,
    byName: (name: string): string | undefined => {
      const decl = project().byName(name, d()?.id)
      if (!decl) return undefined
      return project().routes.get({ id: decl.id })?.slug
    },
  }
}

/**
 * Returns a thunk that builds (or returns the cached) search engine for the
 * current project. Callers wrap the thunk in their own resource/effect.
 */
export const useSearch = (): (() => Promise<Types.SearchEngine>) => {
  const project = useProject()
  return () => project().search
}

export const useRenderMarkdown = (text: string) => {
  const markup = useMarkup()
  const slugs = useSlugFor()
  return createMemo(() => markup()?.markdown(text, (name) => slugs.byName(name) ?? name))
}

export const useCommentMarkdown = (comment: () => Types.Comment | undefined) => {
  const slugs = useSlugFor()
  const slugOf = (name: string) => slugs.byName(name)
  return createMemo(() => {
    const c = comment()
    return c ? commentToMarkdown(c, slugOf) : ''
  })
}

export const useVersions = (): (() => { version: string; alias?: string; href: string }[]) => () => []
