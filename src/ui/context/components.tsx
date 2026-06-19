import { createContext, createMemo, Show, useContext } from 'solid-js'
import type { Accessor, Component } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { Dynamic } from 'solid-js/web'

import * as DocRouter from '../hooks/router/index.ts'
import type { Reflect } from '../context/index.tsx'
import type { t } from '../../_lib/index.ts'

const ComponentsCtx = createContext<Accessor<Components>>(() => ({}))

/**
 * Provide a component registry to descendants. When nested inside another
 * `<ComponentsProvider>` the inner value is shallow-merged onto the outer one,
 * so a wrapper preset can establish defaults that an app extends without
 * losing the outer's entries.
 */
export const ComponentsProvider = (props: { value?: Components; children: JSX.Element }) => {
  const outer = useContext(ComponentsCtx)
  const merged = createMemo<Components>(() => ({ ...outer(), ...props.value }))
  return <ComponentsCtx.Provider value={merged}>{props.children}</ComponentsCtx.Provider>
}

/**
 * Read the active (already-merged) component registry.
 * @group hooks
 * */
export const useComponents = (): Accessor<Components> => useContext(ComponentsCtx)

export const withComponents = (c: Components) => (props: { children: JSX.Element }) => (
  <ComponentsProvider value={c}>{props.children}</ComponentsProvider>
)

/**
 * Build a slot dispatcher in one line: look up the override under `key`,
 * forward `Default` so it can decorate, otherwise render the default. The
 * override and default share the same prop shape — that's what the
 * `WithDefault<P>` wrapper in {@link Components} pins down.
 */
export const createSlot =
  <K extends keyof Components>(
    key: K,
    Default: Component<t.Compute<Omit<Params<Components[K]>[0], 'Default'>>>,
  ): Component<t.Compute<Omit<Params<Components[K]>[0], 'Default'>>> =>
  (props) => {
    const slots = useComponents()
    const override = createMemo(() => slots()[key] as Component<any> | undefined)
    return (
      <Show when={override()} fallback={<Default {...(props as any)} />} keyed>
        {(Override) => <Dynamic component={Override} {...(props as any)} Default={Default} />}
      </Show>
    )
  }
type Params<T> = T extends (...args: infer P) => any ? P : never

/** The override signature of a single slot — see {@link Components} for the slot map. */
export type SlotComponent<K extends keyof Components> = Components[K]

/**
 * The named slots of the site, with their override signatures. Every slot
 * receives `Default` — the stock component, typed to the same props — so an
 * override can decorate (`<Default {...props} />` plus extras) or replace
 * wholesale. Build a registry with {@link defineComponents}.
 *
 * Layout slots: `layout` wraps everything below the header; `header` and
 * `sidebar` replace the chrome; `home` replaces the landing page.
 *
 * Page slots: `page` renders a whole route; `page.header` the title block of
 * a declaration page; `declaration` a declaration's body; `comment` a JSDoc
 * block; `tag` a single JSDoc tag (the hook for `LiveExample`).
 */
export interface Components {
  /** The landing page. */
  home?: WithDefault<{}>
  /** Page chrome around the content: header, sidebar, search palette. */
  layout?: WithDefault<{ children: JSX.Element; loading: Accessor<boolean> }>
  /** Top bar: project name, version switcher, search trigger, links, theme toggle. */
  header?: WithDefault<{ onMenu?: () => void; onSearch?: () => void }>
  /** Navigation tree. `onNavigate` closes the mobile drawer after a click. */
  sidebar?: WithDefault<{ onNavigate?: () => void; class?: string }>

  // Page slots
  /** A whole route: declaration page or markdown page. */
  page?: WithDefault<{ route: DocRouter.PageNode }>
  /** Title block of a declaration page: breadcrumb, name, kind, source link. */
  'page.header'?: WithDefault<{ decl: Reflect.Declaration; route: DocRouter.PageNode }>

  // Declaration page slots
  /** A declaration's body — signatures, members, doc comment. */
  declaration?: WithDefault<{ decl: Reflect.Declaration }>
  /** A JSDoc block: summary markdown plus its tags. */
  comment?: WithDefault<{ comment?: Reflect.Comment; class?: string }>
  /** A single JSDoc tag (`@example`, `@returns`, …). Override to render custom tags. */
  tag?: WithDefault<{ tag: Reflect.CommentTag }>
}

type WithDefault<P extends Record<string, any>> = Component<P & { Default: Component<P> }>

/**
 * Declare slot overrides with type checking. Default-export the result from
 * the file the config's `components` field points at; the CLI loads it and
 * mounts the overrides via `ComponentsProvider`. Slots you omit keep the
 * stock renderer.
 *
 * Each override receives the stock component as `Default`, so it can wrap
 * instead of reimplement.
 *
 * @example Badge deprecated declarations, defer everything else
 * ```tsx
 * import { defineComponents } from '@lickle/docs/ui'
 *
 * export default defineComponents({
 *   declaration: (props) => (
 *     <>
 *       {props.decl.comment?.tags?.some((t) => t.tag === '@deprecated') && <strong>Deprecated</strong>}
 *       <props.Default {...props} />
 *     </>
 *   ),
 * })
 * ```
 */
export const defineComponents = <C extends Components>(components: C) => components
