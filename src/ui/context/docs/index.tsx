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

import * as Types from './types.ts'

export type { Types }

export type DocsInput = MaybeAccessor<Types.DocsJson | Types.ProjectJson | null>
const DocsContext = createContext<{
  docs: Accessor<Types.DocsJson | null>
  cache: Map<Types.DocsVersion, Types.ProjectJson>
}>()

export const DocsProvider: ParentComponent<{ value: DocsInput }> = (p) => (
  <DocsContext.Provider value={{ docs: createMemo(() => resolveDocs(p.value)), cache: new Map() }}>
    {p.children}
  </DocsContext.Provider>
)

export const useDocs = () => {
  const ctx = useContext(DocsContext)
  if (!ctx) throw new Error('useDocs must be used within a <DocsProvider>')
  const versions = () => ctx.docs()?.versions ?? []
  const active = (path: string) => resolveActive(path, versions())
  return { versions, active }
}

const useDocsProjectJson = (version: () => Types.DocsVersion | undefined) => {
  const ctx = useContext(DocsContext)

  const [resource] = createResource(version, (v) => delay(v ? (typeof v.get === 'function' ? v.get() : v.get) : null))

  const json = createMemo(() => {
    const r = resource()
    const v = version()
    if (!v) return null
    if (r && r?.version === v?.version) {
      ctx?.cache.set(v, r)
      return r
    }
    if (ctx?.cache.has(v)) return ctx.cache.get(v)!
    return null
  })

  const current = createMemo(() => resource() ?? null)

  const loading = createMemo(() => resource.loading)
  const error = createMemo(() => resource.error)

  return { json, loading, error, version, current }
}

/** All versions of the active docs. */
export const useDocVersions = (): Accessor<Types.DocsVersion[]> => useDocs().versions

/** The version owning the current location. */
export const useDocActiveVersion = (): Accessor<Types.DocsVersion | undefined> => {
  const docs = useDocs()
  const loc = useLocation()
  return createMemo(() => docs.active(loc.pathname))
}

/** The version owning the current location. */
export const useDocActiveProject = () => {
  const docs = useDocs()
  const loc = useLocation()
  return useDocsProjectJson(() => docs.active(loc.pathname))
}

export const useProjectName = () => {
  const docs = useDocs()
  const active = useDocActiveProject()
  const doc = useDocsProjectJson(() => docs.versions()[0])
  return createMemo(() => active.json()?.name ?? doc.json()?.name)
}

export const useLoadVersion = () => {
  const [v, load] = createSignal<Types.DocsVersion | undefined>(undefined)
  const d = useDocsProjectJson(() => v())
  return { ...d, load }
}

const resolveDocs = (input: DocsInput): Types.DocsJson | null => {
  const s = typeof input === 'function' ? input() : input
  if (!s) return null
  if ('versions' in s) return s
  return { versions: [{ version: s.version ?? '', slug: '', alias: s.name, get: s }] }
}

type MaybeAccessor<T> = (() => T) | T

const resolveActive = (path: string, versions: Types.DocsVersion[]): Types.DocsVersion | undefined => {
  const head = trim(path).split('/')[0] ?? ''
  return (
    versions.find((v) => v.slug !== '/' && trim(v.slug) === head) ?? versions.find((v) => v.slug === '/') ?? versions[0]
  )
}

const trim = (s: string) => s.replace(/^\/+|\/+$/g, '')

const delay = <T,>(x: T) => x
// const delay = <T,>(x: T) => new Promise<Awaited<T>>((resolve) => setTimeout(() => resolve(x as any), 3_000))
