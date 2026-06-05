import { createContext, createMemo, Show, useContext } from 'solid-js'
import type { Accessor, Component } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { Dynamic } from 'solid-js/web'

import type { Types } from '../context/index.tsx'
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

/** Read the active (already-merged) component registry. */
export const useComponents = (): Accessor<Components> => useContext(ComponentsCtx)

export const withComponents = (c: Components) => (props: { children: JSX.Element }) => (
  <ComponentsProvider value={c}>{props.children}</ComponentsProvider>
)

/**
 * Build a slot dispatcher in one line: look up the override under `key`,
 * forward `Default` so it can decorate, otherwise render the default. The
 * override and default share the same prop shape — that's what the
 * `WithDefault<P>` wrapper in {@link Slots} pins down.
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

export type SlotComponent<K extends keyof Components> = Components[K]

/**
 * Slot override signatures. Every slot receives `Default` typed to the
 * stock component's props so the override can decorate (`<Default {...p} />`
 * plus extras) instead of replacing wholesale.
 */
export interface Components {
  home?: WithDefault<{}>
  layout?: WithDefault<{ children: JSX.Element }>
  header?: WithDefault<{ onMenu?: () => void; onSearch?: () => void }>
  sidebar?: WithDefault<{ onNavigate?: () => void; class?: string }>

  // Page slots
  'page.doc'?: WithDefault<{ decl: Types.Declaration; route: Types.RouteNode<'doc'> }>
  'page.doc.header'?: WithDefault<{ decl: Types.Declaration; route: Types.RouteNode<'doc'> }>
  'page.markdown'?: WithDefault<{ route: Types.RouteNode<'markdown'> }>

  // Declaration page slots
  declaration?: WithDefault<{ decl: Types.Declaration }>
  comment?: WithDefault<{ comment?: Types.Comment; class?: string }>
  tag?: WithDefault<{ tag: Types.CommentTag }>
}

type WithDefault<P extends Record<string, any>> = Component<P & { Default: Component<P> }>

export const defineComponents = <C extends Components>(components: C) => components
