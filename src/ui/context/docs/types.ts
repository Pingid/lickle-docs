/**
 * Every type the UI consumes, in one namespace. Three families:
 *
 * - **Datasets** — `DocsJson` describes a site (name, links, versions);
 *   each `DocsVersion` loads a `ProjectVersion`, the generated data for one
 *   release.
 * - **Reflection** — `Declaration`, `Type`, `Part` and `Comment` model the
 *   scanned source: what each page documents.
 * - **Site** — `PageNode` and `SidebarNode` model the rendered pages and the
 *   navigation tree.
 */
import type { Link, ProjectVersion } from '../../../core/config/types.ts'

export type { GroupedItems, SidebarNode, PageNode, DocPage } from '../../../core/layout/types.ts'

export type * from '../../../core/reflect/types.ts'
export type * from '../../../core/config/types.ts'

type MaybeGetter<T> = (() => Promise<T> | T) | T

/** A documentation site: its name, header links and available versions. The shape `DocsProvider` accepts. */
export interface DocsJson {
  /** Project name shown in the header. */
  name: string
  /** Navigation links shown in the header. */
  links: Link[]
  /** The versions the site can display. The first acts as the default. */
  versions: DocsVersion[]
}

/** One selectable version of the docs and how to obtain its data. */
export interface DocsVersion {
  /** Version label, e.g. `1.2.0`. */
  version: string
  /** URL prefix the version is served under; `''` or `/` for the default version. */
  slug: string
  /** Display name in the version switcher. Defaults to the version. */
  alias?: string
  /** The version's `ProjectVersion` data — inline, or a (possibly async) loader for lazy fetching. */
  get: MaybeGetter<ProjectVersion>
}
