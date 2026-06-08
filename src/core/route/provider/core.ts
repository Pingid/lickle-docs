import type * as Reflect from '../../reflect/index.ts'
import { memo1 } from '../../../_lib/util/index.ts'

import type { DocRoute, Sidebar, DocLink } from '../types.ts'
import { createFacade, type DeclarationFacade } from './facade.ts'

/** A hook that can be used to customize page route generation. */
export type Hook<V> = (value: V, id: DeclarationFacade, cx: RouteContext) => V

/** Customize page route generation. */
export type Adapter = {
  alias?: Hook<string>
  slug?: Hook<string>
  sidebar?: Hook<Sidebar | undefined>
  declare?: Hook<DocRoute | undefined>
  links?: Hook<DocLink[]>
  referenced?: Hook<DocLink[]>
}

export type RouteContext = { docs: Reflect.Index; provider: Provider; name: string }

export type ContextOptions = {
  docs: Reflect.Index
  name: string
  adapter?: Adapter
}

export const makeContext = (opts: ContextOptions, provider: (cx: RouteContext) => Provider): RouteContext => {
  const cx = { ...opts, provider: {} as any }
  cx.provider = provider(cx)
  return cx
}

export type Provider = {
  alias(id: number): string
  slug(id: number): string
  declare(id: number): DocRoute | undefined
  sidebar(id: number): Sidebar | undefined
  links(id: number): DocLink[]
  referenced(id: number): DocLink[]
}

export const compose = (...adapters: (Adapter | undefined)[]): Adapter => adapters.reduce<Adapter>(merge, {})

const hooks = ['alias', 'slug', 'declare', 'sidebar', 'referenced', 'links'] as const
const merge = (a: Adapter | undefined, b: Adapter | undefined): Adapter => {
  if (!a) return b ?? {}
  if (!b) return a ?? {}
  const out: any = { ...a }
  for (const hook of hooks) {
    if (b[hook]) out[hook] = mergeHook((a as any)[hook], (b as any)[hook])
  }
  return out
}

const mergeHook = <V>(a?: Hook<V>, b?: Hook<V>): Hook<V> | undefined => {
  if (!a && !b) return undefined
  if (!a) return b
  if (!b) return a
  return (curr, id, cx) => b(a(curr, id, cx), id, cx)
}

export const provideAdapter = (cx: RouteContext, base: Provider, adapter?: Adapter): Provider => {
  if (!adapter) return base
  return Object.fromEntries(
    hooks.map((hook) => [hook, applyHook(cx, adapter?.[hook] as Hook<any>, base[hook])]),
  ) as Provider
}

const applyHook = <V>(cx: RouteContext, hook: Hook<V> | undefined, def: (id: number) => V): ((id: number) => V) => {
  if (!hook) return def
  return (id) => hook(def(id), createFacade(cx.docs, id), cx)
}

export const withMemo = (ad: Provider): Provider =>
  Object.fromEntries(hooks.map((hook) => [hook, memo1(ad[hook as keyof Provider])])) as Provider
