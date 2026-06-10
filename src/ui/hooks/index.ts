import { createMemo, type Accessor } from 'solid-js'
import { useParams } from '@solidjs/router'

import { useHighlighter } from '../context/highlight/index.tsx'
import { useMarkdown } from './markdown/index.ts'

import { commentToMarkdown } from '../util/markdown.ts'
import type { Types } from '../context/index.tsx'

import { useDocRouter } from './router/index.ts'
import { useProject } from './project/index.ts'

export * from './project/index.ts'
export * from './search/index.ts'
export * from './router/index.ts'

export const useRoute = () => {
  const params = useParams()
  const router = useDocRouter()
  return createMemo(() => router()?.get({ slug: params['slug'] ?? '' }))
}

export const useDeclaration = (): Accessor<Types.Declaration | undefined> => {
  const route = useRoute()
  const project = useProject()
  return createMemo(() => {
    const r = route()
    if (!r) return undefined
    if (r.kind === 'doc') return project()?.byId(r.decl)
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
  const router = useDocRouter()
  const d = useDeclaration()
  return {
    byId: (id: number): string | undefined => router()?.get({ id })?.slug,
    byName: (name: string): string | undefined => {
      const decl = project()?.byName(name, d()?.id)
      if (!decl) return undefined
      return router()?.get({ id: decl.id })?.slug
    },
  }
}

export const useCodeHighlighter = () => useHighlighter()

export const useCodeHighlight = (text: string, lang: string) => {
  const highlighter = useCodeHighlighter()
  return createMemo(() => highlighter()?.codeToHtml(text, { lang }))
}

export const useRenderMarkdown = (text: string) => {
  const markup = useMarkdown()
  const slugs = useSlugFor()
  return createMemo(() => markup()(text, (name) => slugs.byName(name) ?? name))
}

export const useCommentMarkdown = (comment: () => Types.Comment | undefined) => {
  const slugs = useSlugFor()
  const slugOf = (name: string) => slugs.byName(name)
  return createMemo(() => {
    const c = comment()
    return c ? commentToMarkdown(c, slugOf) : ''
  })
}
