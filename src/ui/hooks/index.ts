import { createMemo, type Accessor } from 'solid-js'
import { useParams } from '@solidjs/router'

import { useHighlighter } from '../context/highlight/index.tsx'
import { useMarkdown } from './markdown/index.ts'

import { commentToMarkdown } from '../util/markdown.ts'
import type { Reflect } from '../context/index.tsx'

import { use } from './router/index.ts'
import { useProject } from './project/index.ts'

export * as DocRouter from './router/index.ts'
export * from './project/index.ts'
export * from './search/index.ts'

/**
 * The route matching the current URL, resolved through the active version's router.
 * @group hooks
 * */
export const useRoute = () => {
  const params = useParams()
  const router = use()
  return createMemo(() => router()?.get({ slug: params['slug'] ?? '' }))
}

/**
 * The declaration behind the current route — `undefined` on markdown pages and unmatched URLs.
 * @group hooks
 * */
export const useDeclaration = (): Accessor<Reflect.Declaration | undefined> => {
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
 * @group hooks
 */
export const useSlugFor = () => {
  const project = useProject()
  const router = use()
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

/**
 * The active highlighter from `LanguagesProvider` — `undefined` until its grammars finish loading.
 * @group hooks
 * */
export const useCodeHighlighter = () => useHighlighter()

/**
 * Highlighted HTML for a code string — `undefined` until the highlighter is ready.
 * @group hooks
 * */
export const useCodeHighlight = (text: string, lang: string) => {
  const highlighter = useCodeHighlighter()
  return createMemo(() => highlighter()?.codeToHtml(text, { lang }))
}

/**
 * Markdown → HTML through the site pipeline: highlighted code fences, backtick identifiers linked to declarations.
 * @group hooks
 * */
export const useRenderMarkdown = (text: string) => {
  const markup = useMarkdown()
  const slugs = useSlugFor()
  return createMemo(() => markup()(text, (name) => slugs.byName(name) ?? name))
}

/**
 * Flatten a structured doc comment to markdown, resolving `{@link Name}` references to page links.
 * @group hooks
 * */
export const useCommentMarkdown = (comment: () => Reflect.Comment | undefined) => {
  const slugs = useSlugFor()
  const slugOf = (name: string) => slugs.byName(name)
  return createMemo(() => {
    const c = comment()
    return c ? commentToMarkdown(c, slugOf) : ''
  })
}
