import { createContext, createMemo, Show, useContext } from 'solid-js'
import type { Accessor, Component } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { Dynamic } from 'solid-js/web'

import type { Types } from '../context/index.ts'
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
  const merged = createMemo<Components>(() => ({ ...outer(), ...window.lickle.components[0](), ...props.value }))
  return <ComponentsCtx.Provider value={merged}>{props.children}</ComponentsCtx.Provider>
}

/** Read the active (already-merged) component registry. */
export const useComponents = (): Accessor<Components> => useContext(ComponentsCtx)

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

type WithDefault<P extends Record<string, any>> = P & { Default: Component<P> }

export type DeclarationProps<K extends keyof Types.DeclarationMap> = WithDefault<{
  decl: Types.DeclarationMap[K]
}>

type PageProps = { decl: Types.Declaration; route: Types.RouteNode<'declaration' | 'module'> }

export type SlotComponent<K extends keyof Components> = Components[K]
/**
 * Slot override signatures. Every slot receives `Default` typed to the
 * stock component's props so the override can decorate (`<Default {...p} />`
 * plus extras) instead of replacing wholesale.
 */
export interface Components {
  home?: Component<WithDefault<{}>>
  layout?: Component<WithDefault<{ children: JSX.Element }>>
  header?: Component<WithDefault<{ onMenu?: () => void; onSearch?: () => void }>>
  sidebar?: Component<WithDefault<{ onNavigate?: () => void; class?: string }>>

  // Page slots
  page?: Component<WithDefault<PageProps>>
  'page.markdown'?: Component<WithDefault<{ route: Types.RouteNode<'markdown'> }>>
  'page.header'?: Component<WithDefault<PageProps>>
  'page.header.breadcrumb'?: Component<WithDefault<{ id: number }>>
  'page.source'?: Component<WithDefault<{ sources?: Types.Source[] }>>
  'page.references'?: Component<WithDefault<{ id: number }>>

  // Declaration page slots
  declaration?: Component<WithDefault<{ decl: Types.Declaration }>>
  'declaration.function'?: Component<DeclarationProps<'function'>>
  'declaration.variable'?: Component<DeclarationProps<'variable'>>
  'declaration.type-alias'?: Component<DeclarationProps<'type-alias'>>
  'declaration.class'?: Component<DeclarationProps<'class'>>
  'declaration.interface'?: Component<DeclarationProps<'interface'>>
  'declaration.enum'?: Component<DeclarationProps<'enum'>>
  'declaration.module'?: Component<WithDefault<{ decl: Types.Module }>>
  'declaration.namespace'?: Component<DeclarationProps<'namespace'>>

  comment?: Component<WithDefault<{ comment?: Types.Comment; class?: string }>>
  'comment.parameters'?: Component<WithDefault<{ tags: Types.CommentTagMap['@param'][] }>>
  'comment.properties'?: Component<WithDefault<{ tags: Types.CommentTagMap['@property'][] }>>

  tag?: Component<WithDefault<{ tag: Types.CommentTag }>>
  'tag.returns'?: Component<WithDefault<{ tag: t.Compute<Types.CommentTagMap['@returns']> }>>
  'tag.throws'?: Component<WithDefault<{ tag: Types.CommentTagMap['@throws'] }>>
  'tag.type'?: Component<WithDefault<{ tag: Types.CommentTagMap['@type'] }>>
  'tag.satisfies'?: Component<WithDefault<{ tag: Types.CommentTagMap['@satisfies'] }>>
  'tag.example'?: Component<WithDefault<{ tag: Types.CommentTagMap['@example'] }>>
  'tag.see'?: Component<WithDefault<{ tag: Types.CommentTagMap['@see'] }>>
  'tag.template'?: Component<WithDefault<{ tag: Types.CommentTagMap['@template'] }>>
  'tag.augments'?: Component<WithDefault<{ tag: Types.CommentTagMap['@augments'] }>>
  'tag.implements'?: Component<WithDefault<{ tag: Types.CommentTagMap['@implements'] }>>
  'tag.*'?: Component<WithDefault<{ tag: Types.CommentTag }>>
}
