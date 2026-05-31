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
  /** Files to exclude from the project (micromatch glob patterns) */
  exclude?: string[]
  /** Document every declaration, not just the exported public API. Default false. */
  full?: boolean
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
