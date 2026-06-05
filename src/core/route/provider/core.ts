import type { ModuleRef, Route, Sidebar } from '../types.ts'
import type * as reflect from '../../reflect/index.ts'
import { memo1 } from '../../../_lib/util/index.ts'

/** A hook that can be used to customize page route generation. */
export type Hook<V> = (value: V, id: number, cx: RouteContext) => V

/** Customize page route generation. */
export type Adapter = {
  alias?: Hook<string>
  title?: Hook<string>
  slug?: Hook<string>
  route?: Hook<Route | undefined>
  sidebar?: Hook<Sidebar | undefined>
  modules?: Hook<ModuleRef[]>
}

export type RouteContext = { docs: reflect.Index; provider: Provider }

export type ContextOptions = { docs: reflect.Index; adapter?: Adapter }

export const makeContext = (opts: ContextOptions, provider: (cx: RouteContext) => Provider): RouteContext => {
  let id = 0
  const cx = { docs: opts.docs, provider: {} as any, id: () => id++ }
  cx.provider = provider(cx)
  return cx
}

export type Provider = {
  alias: (id: number) => string
  title: (id: number) => string
  slug: (id: number) => string
  route: (id: number) => Route | undefined
  sidebar: (id: number) => Sidebar | undefined
  modules: (id: number) => ModuleRef[]
}

export const compose = (...adapters: (Adapter | undefined)[]): Adapter => adapters.reduce<Adapter>(merge, {})

const hooks = ['alias', 'title', 'slug', 'route', 'sidebar', 'modules'] as const
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
    hooks.map((hook) => [hook, applyHook(adapter?.[hook] as Hook<any>, base[hook], cx)]),
  ) as Provider
}

const applyHook = <V>(hook: Hook<V> | undefined, def: (id: number) => V, cx: RouteContext): ((id: number) => V) => {
  if (!hook) return def
  return (id) => hook(def(id), id, cx)
}

export const withMemo = (ad: Provider): Provider =>
  Object.fromEntries(hooks.map((hook) => [hook, memo1(ad[hook as keyof Provider])])) as Provider
