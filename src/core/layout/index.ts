import type { Layout, PageSource, Redirect, PageNode, DocPage, SiteGraph, Filter } from './types.ts'
import type * as Reflect from '../reflect/index.ts'
import { createFacade } from './facade.ts'
import { buildTree } from './tree.ts'
import { toPages, pageSlug } from './pages.ts'
import { grouping } from './presets.ts'
import { groupByKind } from './group.ts'
import type { Transform } from './transform.ts'
import type { Diagnostic } from '../diagnostic/types.ts'

export type * from './types.ts'
export type { DeclarationFacade, ModuleFacade } from './facade.ts'
export type { Transform } from './transform.ts'
export type { LayoutRouter } from './client.ts'
export { createLayoutRouter } from './client.ts'
export { compose } from './layout.ts'
export * from './presets.ts'
export { effectiveNav } from './tree.ts'
export { groupBy, groupByKind, groupByTag, composeGroups, groupItems, is, type GroupBy } from './group.ts'
export { defaultLayout } from './default.ts'

export type ContextOptions = {
  docs: Reflect.Index
  name: string
  /** Filter declarations to include */
  filter?: Filter
  /** The whole placement policy, as one composed {@link Layout}. Defaults to grouping by kind. */
  layout?: Layout
  /** Content transform run over each declaration after layout (e.g. `Transform.stripTags`). */
  transform?: Transform
  /** Emit a diagnostic. */
  emit: (d: Diagnostic) => void
}

export const builder = (opts: ContextOptions) => {
  const sources: PageSource[] = []
  const baseCx = { docs: opts.docs, name: opts.name }
  // The layout IS the policy. Zero-config still groups by kind for a sensible
  // default; provide a layout and you compose whatever grouping you want.
  const layout: Layout = opts.layout ?? grouping(groupByKind)
  const filter: Filter = opts.filter ?? ((d) => d.exposure.is() && !d.tags.has('@internal'))

  return {
    declare: (decl: Reflect.Declaration) => {
      const facade = createFacade(opts.docs, decl.id)
      if (facade && filter(facade)) sources.push({ kind: 'doc', decl: facade })
    },
    markdown: (p: {
      title: string
      slug?: string
      content: string
      folder?: string
      group?: string
      order?: number
    }) => {
      sources.push({
        kind: 'markdown',
        title: p.title,
        content: p.content,
        slug: p.slug,
        folder: p.folder,
        group: p.group,
        order: p.order,
      })
    },
    build: (): SiteGraph => {
      const { resolved, sidebar, aliases } = buildTree(sources, layout, baseCx, opts.emit)
      const pages = toPages(resolved)

      // Aliases → render-mode pages (cloned from the canonical, so they share
      // its content) and redirect-mode slug pairs.
      const byDecl = new Map(pages.filter((p): p is DocPage => p.kind === 'doc').map((p) => [p.decl, p]))
      const bySlug = new Map<string, PageNode>(pages.map((p) => [p.slug, p]))
      const redirects: Redirect[] = []
      for (const a of aliases) {
        const canonical = a.target !== undefined ? byDecl.get(a.target) : bySlug.get(pageSlug(a.canonical))
        const from = pageSlug(a.slug)
        if (!canonical || from === canonical.slug) continue
        if (a.mode === 'render') pages.push({ ...canonical, slug: from })
        else redirects.push({ from, to: canonical.slug })
      }

      // Content transform runs AFTER layout has read the comments (e.g. grouping
      // by @group), so stripping tags can't hide them from the grouping.
      const declarations = resolved
        .filter((r) => r.id !== null && r.source.kind === 'doc')
        .map((r) => (r.source as Extract<PageSource, { kind: 'doc' }>).decl.raw)
      if (opts.transform) for (const d of declarations) opts.transform(d)

      return { pages, sidebar, redirects, declarations }
    },
  }
}
