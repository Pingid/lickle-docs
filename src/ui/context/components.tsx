import { createContext, createMemo, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import type { Component } from 'solid-js'

import type * as docs from '../../core/client.ts'

const ComponentsCtx = createContext<Components>({})

/**
 * Provide a component registry to descendants. When nested inside another
 * `<ComponentsProvider>` the inner value is deep-merged onto the outer one,
 * so a wrapper preset can establish defaults that an app extends without
 * losing the outer's entries.
 */
export const ComponentsProvider = (props: { value?: Components; children: JSX.Element }) => {
  const outer = useContext(ComponentsCtx)
  const merged = createMemo<Components>(() => deepMerge(outer ?? {}, props.value ?? {}))
  return <ComponentsCtx.Provider value={merged()}>{props.children}</ComponentsCtx.Provider>
}

/** Read the active (already-merged) component registry. */
export const useComponents = (): Components => useContext(ComponentsCtx)

/**
 * Build a slot dispatcher in one line: look up the override under `key`,
 * forward `Default` so it can decorate, otherwise render the default. The
 * override and default share the same prop shape — that's what the
 * `WithDefault<P>` wrapper in {@link Slots} pins down.
 */
export const createSlot =
  <K extends keyof Components, P extends Omit<Params<Components[K]>[0], 'Default'>>(
    key: K,
    Default: Component<P>,
  ): Component<P> =>
  (props) => {
    const slots = useComponents()
    const Override = slots?.[key] as Component<P & { Default: Component<P> }> | undefined
    return Override ? <Override {...(props as P)} Default={Default} /> : <Default {...props} />
  }
type Params<T> = T extends (...args: infer P) => any ? P : never

type WithDefault<P extends Record<string, any>> = P & { Default: Component<P> }

export type DeclarationProps<K extends keyof docs.DeclarationMap> = WithDefault<{
  decl: docs.DeclarationMap[K]
}>

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
  page?: Component<WithDefault<{ decl: docs.Declaration }>>
  'page.header'?: Component<WithDefault<{ decl: docs.Declaration }>>
  'page.header.breadcrumb'?: Component<WithDefault<{ id: number }>>
  'page.source'?: Component<WithDefault<{ sources?: docs.Source[] }>>
  'page.references'?: Component<WithDefault<{ id: number }>>

  // Declaration page slots
  declaration?: Component<WithDefault<{ decl: docs.Declaration }>>
  'declaration.function'?: Component<DeclarationProps<'function'>>
  'declaration.variable'?: Component<DeclarationProps<'variable'>>
  'declaration.type-alias'?: Component<DeclarationProps<'type-alias'>>
  'declaration.class'?: Component<DeclarationProps<'class'>>
  'declaration.interface'?: Component<DeclarationProps<'interface'>>
  'declaration.enum'?: Component<DeclarationProps<'enum'>>
  'declaration.module'?: Component<DeclarationProps<'module'>>
  'declaration.namespace'?: Component<DeclarationProps<'namespace'>>
  'declaration.exports'?: Component<DeclarationProps<'exports'>>

  comment?: Component<WithDefault<{ comment?: docs.Comment; class?: string }>>
  'comment.parameters'?: Component<WithDefault<{ tags: docs.CommentTagMap['@param'][] }>>
  'comment.properties'?: Component<WithDefault<{ tags: docs.CommentTagMap['@property'][] }>>

  tag?: Component<WithDefault<{ tag: docs.CommentTag }>>
  'tag.returns'?: Component<WithDefault<{ tag: docs.CommentTagMap['@returns'] }>>
  'tag.throws'?: Component<WithDefault<{ tag: docs.CommentTagMap['@throws'] }>>
  'tag.type'?: Component<WithDefault<{ tag: docs.CommentTagMap['@type'] }>>
  'tag.satisfies'?: Component<WithDefault<{ tag: docs.CommentTagMap['@satisfies'] }>>
  'tag.example'?: Component<WithDefault<{ tag: docs.CommentTagMap['@example'] }>>
  'tag.see'?: Component<WithDefault<{ tag: docs.CommentTagMap['@see'] }>>
  'tag.template'?: Component<WithDefault<{ tag: docs.CommentTagMap['@template'] }>>
  'tag.augments'?: Component<WithDefault<{ tag: docs.CommentTagMap['@augments'] }>>
  'tag.implements'?: Component<WithDefault<{ tag: docs.CommentTagMap['@implements'] }>>
  'tag.*'?: Component<WithDefault<{ tag: docs.CommentTag }>>
}

/**
 * Recursive merge that bottoms out on functions, arrays, and primitives.
 * The right-hand value wins at every leaf; nested plain objects (the four
 * registry buckets and their per-key sub-records) are walked.
 */
const isPlain = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function'

const deepMerge = <T,>(a: T, b: T): T => {
  if (!isPlain(a) || !isPlain(b)) return b ?? a
  const out: Record<string, unknown> = { ...a }
  for (const k of Object.keys(b)) {
    const av = (a as Record<string, unknown>)[k]
    const bv = (b as Record<string, unknown>)[k]
    out[k] = av !== undefined && bv !== undefined ? deepMerge(av as any, bv as any) : (bv ?? av)
  }
  return out as T
}
