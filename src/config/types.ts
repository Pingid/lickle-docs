/** Configuration used for generating the project json */
export interface ConfigJson {
  /** The name of the project. default is the package name from package.json */
  name: string
  /** The version of the project. default is the package version from package.json */
  version?: string
  /** README file path, default is README.md in the project root shown as home page */
  readme?: string
  /** Links for the project. defaults to package.json repository url */
  links?: Link[]
  /** tsconfig.json file path, default is tsconfig.json in the project root */
  tsconfig?: string
  /** Repository information */
  repository?: Repo
  /** Source directory, default to tsconfig.json `rootDir` or src */
  srcDir?: string
  /** Entrypoints — relative source paths reachable from `main` / `exports`. */
  entrypoints?: Entry[]
  /** Pages to include in the project. Default is the README file. */
  pages?: Page[]
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
  /** Files to exclude from the project (micromatch glob patterns) */
  exclude?: string[]
  /** Document every declaration, not just the exported public API. Default false. */
  full?: boolean
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

import { v } from '@lickle/is'

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

export const schema = v.struct.match<ConfigJson>({
  name: v.string,
  version: v.or(v.string, v.undefined),
  readme: v.or(v.string, v.undefined),
  links: v.or(v.array(v.struct({ label: v.string, href: v.string })), v.undefined),
  tsconfig: v.or(v.string, v.undefined),
  repository: v.or(repo, v.undefined),
  srcDir: v.or(v.string, v.undefined),
  entrypoints: v.or(v.array(entry), v.undefined),
  pages: v.or(v.array(page), v.undefined),
  components: v.or(v.string, v.undefined),
  exclude: v.or(v.array(v.string), v.undefined),
  full: v.or(v.boolean, v.undefined),
})

export const validate = (v: unknown): ConfigJson => {
  const result = schema(v)
  if (result.ok) return result.value
  throw new Error(result.error)
}
