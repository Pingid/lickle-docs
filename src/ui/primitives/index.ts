/**
 * Presentational components with no context dependency.
 *
 * Everything here takes plain data and renders it — no provider, no router, no
 * project. That's the whole distinction from `components/`, whose members read
 * the site's context to decide *what* to render and then hand it to a
 * primitive to render it. `Breadcrumb` is `Crumbs` plus a router lookup;
 * `Sidebar` is `NavTree` plus one; `CopyPageButton` is `Menu` plus the
 * markdown pipeline.
 *
 * Two things follow from that split. Overriding a slot no longer means
 * rebuilding markup from raw elements — reach for the primitive the stock
 * renderer uses. And every primitive can be previewed from a literal, which
 * is why each one below carries a runnable `@example`.
 */
export * from './layout.tsx'
export * from './text.tsx'
export * from './control.tsx'
export * from './list.tsx'
export * from './nav.tsx'
export * from './icons.tsx'
export * from './link.tsx'
