import type ts from 'typescript'

import type { Router, Reflect } from '../index.ts'

export interface ProjectVersion {
  /** The name of the version. */
  name: string
  /** The version of the project. */
  version: string
  /** Repository information */
  repository?: Repo
  /** Routes of the project. */
  routes: Router.Route[]
  /** Flat list of every declaration in the project, source order. */
  declarations: Reflect.Declaration[]
}

/** Configuration used for generating the project json */
export interface UserConfig extends Partial<Omit<Config, 'routes' | 'versions'>> {
  /** The name of the project. default is the package name from package.json */
  name: string
  /** Path or glob to project json files */
  versions?: string
}

// Non serializable config
export interface Config extends ConfigJson {
  /** Filter function to include or exclude files from the project */
  include: (sf: ts.SourceFile, defaultValue: boolean) => boolean
  /** Route generation adapter */
  provider?: Router.Adapter
}

/** Configuration used for generating the project json */
export interface ConfigJson {
  /** The name of the project. default is the package name from package.json */
  name: string
  /** The version of the project. default is the package version from package.json */
  version?: string
  /** tsconfig.json file path, default is tsconfig.json in the project root */
  tsconfig?: string
  /** Source directory, default to tsconfig.json `rootDir` or src */
  srcDir: string
  /** Entrypoints — relative source paths reachable from `main` / `exports`. */
  entrypoints: Entry[]
  /** Files to exclude from the project (micromatch glob patterns) */
  exclude: string[]
  /** Pages to include in the project. Default is the README file. */
  pages?: Page[]
  /** Links for the project. defaults to package.json repository url */
  links: Link[]
  /** Repository information */
  repository?: Repo
  /** Path to custom components file */
  components?: string
  /** Languages used in example code blocks and markdown for syntax highlighting. Defaults to ['ts'] */
  languages?: string[]
  /** Path to versions file */
  versions?: ConfigVersion[]
}

export interface ConfigVersion {
  /** The path to the project json file. */
  path: string
  /** The version of the project. */
  version: string
  /** Load the project json file. */
  alias?: string
  /** The slug of the version. */
  slug: string
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
