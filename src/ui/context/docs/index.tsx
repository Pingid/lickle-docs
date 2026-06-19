import {
  createContext,
  createMemo,
  createResource,
  createSignal,
  useContext,
  type Accessor,
  type ParentComponent,
} from 'solid-js'

import { useLocation } from '../../util/router.tsx'

import type * as Reflect from './types.ts'

export type { Reflect }

/**
 * What {@link DocsProvider} accepts: a multi-version `DocsJson`, a single
 * `ProjectVersion` (wrapped as the only version), or an accessor of either
 * for data that loads asynchronously.
 */
export type DocsInput = MaybeAccessor<Reflect.DocsJson | Reflect.ProjectVersion | null>
const DocsContext = createContext<{
  docs: Accessor<Reflect.DocsJson | null>
  cache: Map<Reflect.DocsVersion, Reflect.ProjectVersion>
}>()

/**
 * Supply project data to the tree. Everything below — hooks, router, search,
 * every page — reads from this context, so it must wrap any use of the docs
 * UI. Pass the generated `project.json` directly, or a `DocsJson` describing
 * several versions; loaded versions are cached for the session.
 */
export const DocsProvider: ParentComponent<{ value: DocsInput }> = (p) => (
  <DocsContext.Provider value={{ docs: createMemo(() => resolveDocs(p.value)), cache: new Map() }}>
    {p.children}
  </DocsContext.Provider>
)

/**
 * Read the active docs.
 * @group hooks
 * */
export const useDocs = () => {
  const ctx = useContext(DocsContext)
  if (!ctx) throw new Error('useDocs must be used within a <DocsProvider>')
  const versions = () => ctx.docs()?.versions ?? []
  const active = (path: string) => resolveActive(path, versions())
  const name = () => ctx.docs()?.name ?? ''
  const links = () => ctx.docs()?.links ?? []
  return { versions, active, name, links }
}

/**
 * Read the active project json.
 * @group hooks
 * */
const useDocsProjectJson = (version: () => Reflect.DocsVersion | undefined) => {
  const ctx = useContext(DocsContext)

  const [resource] = createResource(version, (v) => delay(v ? (typeof v.get === 'function' ? v.get() : v.get) : null))

  const json = createMemo(() => {
    const r = resource()
    const v = version()
    if (!v) return null
    if (r && r?.version === v?.version) ctx?.cache.set(v, r)
    if (ctx?.cache.has(v)) return ctx.cache.get(v)!
    return null
  })

  const current = createMemo(() => resource() ?? null)

  const loading = createMemo(() => resource.loading)
  const error = createMemo(() => resource.error)

  return { json, loading, error, version, current }
}

/**
 * All versions of the active docs.
 * @group hooks
 * */
export const useDocVersions = (): Accessor<Reflect.DocsVersion[]> => useDocs().versions

/**
 * The version owning the current location.
 * @group hooks
 * */
export const useDocVersionsCurrent = (): Accessor<Reflect.DocsVersion | undefined> => {
  const docs = useDocs()
  const loc = useLocation()
  return createMemo(() => docs.active(loc.pathname))
}

/**
 * Project data for the version that owns the current URL. Returns resource
 * accessors — `json` (the loaded `ProjectVersion`, cached per version),
 * `current`, `loading`, `error` and `version` — so the layout can render a
 * shell while a version loads.
 * @group hooks
 */
export const useDocActiveProject = () => {
  const docs = useDocs()
  const loc = useLocation()
  return useDocsProjectJson(() => docs.active(loc.pathname))
}

/**
 * Load a version of the active docs.
 * @group hooks
 * */
export const useLoadVersion = () => {
  const [v, load] = createSignal<Reflect.DocsVersion | undefined>(undefined)
  const d = useDocsProjectJson(() => v())
  return { ...d, load }
}

const resolveDocs = (input: DocsInput): Reflect.DocsJson | null => {
  const s = typeof input === 'function' ? input() : input
  if (!s) return null
  if ('versions' in s) return s
  return { name: s.name, links: [], versions: [{ version: s.version ?? '', slug: '', get: s }] }
}

type MaybeAccessor<T> = (() => T) | T

const resolveActive = (path: string, versions: Reflect.DocsVersion[]): Reflect.DocsVersion | undefined => {
  const head = trim(path).split('/')[0] ?? ''
  return (
    versions.find((v) => v.slug !== '/' && trim(v.slug) === head) ?? versions.find((v) => v.slug === '/') ?? versions[0]
  )
}

const trim = (s: string) => s.replace(/^\/+|\/+$/g, '')

const delay = <T,>(x: T) => x
// const delay = <T,>(x: T) => new Promise<Awaited<T>>((resolve) => setTimeout(() => resolve(x as any), 3_000))
