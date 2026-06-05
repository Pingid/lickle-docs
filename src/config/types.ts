import type { RouteProvider } from '../core/project/index.ts'

/** Configuration used for generating the project json */
export interface UserConfig {
  /** The name of the project. default is the package name from package.json */
  name: string
  /** The version of the project. default is the package version from package.json */
  version?: string
  /** tsconfig.json file path, default is tsconfig.json in the project root */
  tsconfig?: string
  /** Source directory, default to tsconfig.json `rootDir` or src */
  srcDir?: string
  /** Entrypoints — relative source paths reachable from `main` / `exports`. */
  entrypoints?: Entry[]
  /** Files to exclude from the project (micromatch glob patterns) */
  exclude?: string[]
  /** Document every declaration, not just the exported public API. Default false. */
  full?: boolean

  /** Pages to include in the project. Default is the README file. */
  pages?: Page[]
  /** Links for the project. defaults to package.json repository url */
  links?: Link[]
  /** Repository information */
  repository?: Repo

  /**
   * Path to custom components file
   *
   * @example './docs/components.tsx'
   *
   * ```tsx
   * import { defineComponents } from '@lickle/docs/ui'
   *
   * export default defineComponents({
   *   'tag.example': (props) => <LiveExample {...props} run={(code, host) => run(transform(code), host)} />
   * })
   * ```
   * */
  components?: string
  /** Languages used in example code blocks and markdown for syntax highlighting. Defaults to ['ts'] */
  languages?: string[]

  /**
   * Customise the route tree: naming, nav visibility, grouping, and child
   * shape (filter / reorder / relocate / group). Build one with
   * `createRouteProvider`, or compose the stock presets (`groupByKind`,
   * `sortAlphabetically`, `hide`, …) with `compose`. Code config only.
   */
  provider?: RouteProvider
}

export interface Page {
  /** Page title */
  title: string
  /** Page path */
  slug?: string
  /** Page content */
  content: string
}

export interface Entry {
  /** Label used in the navigation */
  as: string
  /** File path or array of file paths, ['./src/index.ts'] */
  path: string
}

export interface Link {
  /** Label used in the navigation */
  label: string
  /** URL */
  href: string
}

export interface Repo {
  /** Repository URL */
  url: string
  /** Repository commit */
  rev?: string
  /** Repository file URL template with {PATH} {LINE} {COLUMN} to link to the source code */
  fileUrl?: string
}

import { v, type Valid } from '@lickle/is'

// ---------------- Validation ----------------
const repo = v.struct.match<Repo>({
  url: v.string,
  rev: v.or(v.string, v.undefined),
  fileUrl: v.or(v.string, v.undefined),
})

const page = v.struct.match<Page>({
  title: v.string,
  slug: v.or(v.string, v.undefined),
  content: v.string,
})

const entry = v.struct.match<Entry>({
  as: v.string,
  path: v.string,
})

const any: Valid<any, unknown> = (v) => ({ ok: true, value: v })

export const schema = v.struct.match<UserConfig>({
  name: v.string,
  version: v.or(v.string, v.undefined),
  links: v.or(v.array(v.struct({ label: v.string, href: v.string })), v.undefined),
  tsconfig: v.or(v.string, v.undefined),
  repository: v.or(repo, v.undefined),
  srcDir: v.or(v.string, v.undefined),
  entrypoints: v.or(v.array(entry), v.undefined),
  pages: v.or(v.array(page), v.undefined),
  components: v.or(v.string, v.undefined),
  exclude: v.or(v.array(v.string), v.undefined),
  full: v.or(v.boolean, v.undefined),
  languages: v.or(v.array(v.string), v.undefined),
  provider: any,
})

export const validate = (v: unknown): UserConfig => {
  const result = schema(v)
  if (result.ok) return result.value
  throw new Error(result.error)
}
