import type { Components } from '../ui/index.ts'
import { reflect } from '../core/index.ts'

export interface UserConfig {
  /** The name of the project. default is the package name from package.json */
  name: string
  /** The version of the project. default is the package version from package.json */
  version?: string
  /** The readme of the project. default is the README.md file in the project root */
  readme?: string
  /** structure of pages and navigation, defaults to package.json exports */
  pages?: Page[]
  /** structure of pages and navigation, defaults to package.json exports */
  entrypoints?: Entry[]
  /** Links for the project. defaults to package.json repository url */
  links?: { label: string; href: string }[]
  /** tsconfig.json file path, default is tsconfig.json in the project root */
  tsconfig?: string
  /** package.json file path, default is package.json in the project root */
  packageJson?: string
  /**
   * Pattern with {PATH} {LINE} {COLUMN} to link to the source code
   * @example https://github.com/me/project/blob/123.../{PATH}#L{LINE}
   * */
  sourceLink?: string

  /** Working directory where json doc is generated */
  workdir?: string

  components?: Components
}

export type Page = {
  /** Label used in the navigation */
  label: string
  /** File path or array of file paths, ['./README.md'] */
  content: string | string[]
  /** Slug of the page, used in the URL */
  slug?: string
}

export type Entry = {
  /** Label used in the navigation */
  label: string
  /** File path or array of file paths, ['./src/index.ts'] */
  content: string
  /** Slug of the page, used in the URL */
  slug?: string
}

export type NewProjectConfig = {
  /** The name of the project. default is the package name from package.json */
  name: string
  /** The version of the project. default is the package version from package.json */
  version?: string
  /** structure of pages and navigation, defaults to package.json exports */
  pages: Page[]
  /** structure of pages and navigation, defaults to package.json exports */
  entrypoints: Entry[]
  /** Links for the project. defaults to package.json repository url */
  links: { label: string; href: string }[]
  /** Pattern with {PATH} {LINE} {COLUMN} to link to the source code */
  sourceLink: string
  /** Working directory where json doc is generated */
  workdir: string
  /** Flat list of every declaration in the project, source order. */
  declarations: reflect.resolve.Declaration[]
  /** Top-level module ids — one per scanned source file. */
  children: number[]
}
