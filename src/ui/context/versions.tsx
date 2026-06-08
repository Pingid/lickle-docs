import { createContext, createMemo, useContext } from 'solid-js'
import type { Accessor } from 'solid-js'

import type { ProjectJson } from '../../core/config/types.ts'
import { useLocation } from './router.tsx'

/**
 * A slugged source of a {@link ProjectJson}. `get` returns the json for that
 * version: the active build inlines it (sync), older versions `import()` it.
 */
export interface Version {
  /** The version of the project, e.g. `1.0.0`. */
  version: string
  /** Route prefix the version mounts under. `/` for the default version. */
  slug: string
  /** Optional display label, falls back to {@link Version.version}. */
  alias?: string
  /** Resolve the version's project json. */
  get(): ProjectJson | Promise<ProjectJson>
}

const VersionsCtx = createContext<Accessor<Version[]>>(() => [])
export const VersionsProvider = VersionsCtx.Provider

export const useProjectVersions = () => useContext(VersionsCtx)

const trim = (s: string) => s.replace(/^\/+|\/+$/g, '')

/**
 * Pick the version a path belongs to: the one whose slug matches the leading
 * segment, else the default (`/`), else the first. Pure — drives both the
 * active json (App) and the switcher's current marker (Header).
 */
export const resolveActive = (path: string, versions: Version[]): Version | undefined => {
  const head = trim(path).split('/')[0] ?? ''
  return (
    versions.find((v) => v.slug !== '/' && trim(v.slug) === head) ??
    versions.find((v) => v.slug === '/') ??
    versions[0]
  )
}

/** The version owning the current location. */
export const useActiveVersion = (): Accessor<Version | undefined> => {
  const versions = useProjectVersions()
  const loc = useLocation()
  return createMemo(() => resolveActive(loc.pathname, versions()))
}
