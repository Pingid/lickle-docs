import type {
  Layout,
  PageSource,
  ContentSource,
  Redirect,
  PageNode,
  DocPage,
  SiteGraph,
  Refine,
  TraceEntry,
} from './types.ts'
import type * as Reflect from '../reflect/index.ts'
import { createDeclarationFacade } from './facade.ts'
import { buildTree, placeOne } from './tree.ts'
import { toPages, pageSlug } from './pages.ts'
import { Place, Select } from './layout/index.ts'
import type { Transform } from './transform.ts'
import type { Diagnostic } from '../diagnostic/types.ts'

export type * from './types.ts'
export type { DeclarationFacade, ModuleFacade } from './facade.ts'
export type { Transform } from './transform.ts'
export type { LayoutRouter } from './client.ts'
export { createLayoutRouter } from './client.ts'

/**
 * The zero-config policy: drop what the public API doesn't expose (and anything
 * `@internal`), then bucket by kind. Exported so a config can build on it —
 * `Place.compose(Layout.defaultLayout, …)` — instead of restating it.
 */
export const defaultLayout: Layout = Place.compose(Place.defaultFilter, Place.bucket(Select.kind))

export type ContextOptions = {
  docs: Reflect.Index
  name: string
  /**
   * The whole placement policy, as one composed {@link Layout}. Defaults to
   * {@link defaultLayout}.
   *
   * Filtering lives here too, as `Place.defaultFilter` or a `Place.filter`
   * layer — there is no separate filter option, so what a config leaves out is
   * genuinely left out. Supplying a layout therefore means owning the filtering
   * as well; compose `Place.defaultFilter` in to keep the stock behaviour.
   */
  layout?: Layout
  /** Whole-set pass run after the layout has placed every source in isolation. */
  refine?: Refine
  /** Content transform run over each declaration after layout (e.g. `Transform.stripTags`). */
  transform?: Transform
  /** Emit a diagnostic. */
  emit: (d: Diagnostic) => void
}

export const builder = (opts: ContextOptions) => {
  const sources: PageSource[] = []
  const baseCx = { docs: opts.docs, name: opts.name }
  // The layout IS the policy — placement, bucketing and filtering in one
  // composed function, so every decision is visible in the config.
  const layout: Layout = opts.layout ?? defaultLayout

  return {
    declare: (decl: Reflect.Declaration) => {
      const facade = createDeclarationFacade(opts.docs, decl.id)
      if (facade) sources.push({ kind: 'doc', decl: facade })
    },
    page: (p: ContentSource) => {
      sources.push(p)
    },
    /** Every source the builder will place — what `ldocs why` searches. */
    sources: (): readonly PageSource[] => sources,
    /**
     * Re-run the layout for one source with tracing on, reporting each layer
     * that changed the outcome. Uses the same code path as the build, so the
     * explanation can't drift from the result.
     */
    explain: (source: PageSource): { trace: TraceEntry[]; placement: ReturnType<typeof placeOne> } => {
      const trace: TraceEntry[] = []
      // Attribution is settled inside `Place.compose` (see `Place.label`'s
      // `transparent`), so what arrives here is already one entry per change.
      const placement = placeOne(source, layout, baseCx, (e) => trace.push(e))
      return { trace, placement }
    },
    build: (): SiteGraph => {
      const { resolved, sidebar, aliases } = buildTree(sources, layout, baseCx, opts.emit, opts.refine)
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
