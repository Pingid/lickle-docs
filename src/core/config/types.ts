import type ts from 'typescript'

import type { Reflect, Layout } from '../index.ts'

/**
 * One generated documentation dataset: the resolved site graph for a single
 * project version, plus its metadata. Produced by the CLI (`ldocs json` writes
 * it to `docs/project.json`) and consumed by `DocsProvider` on the client.
 */
export interface ProjectVersion {
  /** Project name shown in the header. */
  name: string
  /** Version label this dataset documents. */
  version: string
  /** Repository links used for "view source" anchors. */
  repository?: Repo
  /** URL prefixes applied per page kind: `doc` for declaration pages, `page` for markdown pages. */
  prefix: Layout.RoutePrefix
  /** The rendered pages: one entry per declaration page and markdown page. */
  pages: Layout.PageNode[]
  /** The server-built navigation tree; the client renders it directly. */
  sidebar: Layout.GroupedItems<Layout.SidebarNode>[]
  /** Secondary URLs that redirect to a canonical page (`redirect`-mode aliases). */
  redirects: Layout.Redirect[]
  /** Flat list of every declaration in the project, source order. */
  declarations: Reflect.Declaration[]
}

/**
 * The shape accepted by `defineConfig`. `name` is the only required field;
 * every other field is optional and falls back to `package.json`, git
 * metadata or conventional files. Resolved into a {@link Config} before
 * generation.
 */
export interface UserConfig extends Partial<Omit<Config, 'versions'>> {
  /** Project name shown in the header. Defaults to the `package.json` name. */
  name: string
  /**
   * Glob of `project.json` files for previously published versions
   * (each emitted by `ldocs json`). Matched files appear in the header's
   * version switcher alongside the current build.
   *
   * @example
   * ```ts
   * export default defineConfig({ name: 'My Library', versions: './docs/version/*.json' })
   * ```
   */
  versions?: string
}

/**
 * The fully-resolved configuration used during generation: {@link ConfigJson}
 * plus the fields that cannot be serialized (functions).
 */
export interface Config extends ConfigJson {
  /**
   * Decide whether declarations from a source file are documented. Receives
   * the file and the default verdict (from `tsconfig` include/exclude and the
   * `exclude` globs); return the final verdict.
   *
   * @example Hide an internal directory
   * ```ts
   * include: (sf, keep) => (sf.fileName.includes('/internal/') ? false : keep)
   * ```
   */
  include: (sf: ts.SourceFile, defaultValue: boolean) => boolean

  /** Filter declarations to include */
  filter?: Layout.Filter
  /**
   * The whole page-generation policy, as one composed {@link Layout}. Placement,
   * grouping (`Layout.grouping`), virtual folders (place under `{ virtual }`
   * parents), filtering and aliases are all layers composed with
   * `Layout.compose` — there are no separate fields. Defaults to grouping by kind.
   *
   * @example
   * ```ts
   * layout: Layout.compose(
   *   Layout.filter((d) => !d.tags.has('@internal') && d.exposure.is()),
   *   Layout.grouping(Layout.composeGroups(Layout.groupByKind, Layout.groupByTag('@group'))),
   * )
   * ```
   */
  layout?: Layout.Layout
  /**
   * Content transforms run over each declaration after layout has read it —
   * kept separate from `layout` so placement stays pure.
   *
   * @example
   * ```ts
   * transform: Transform.stripTags('@group')
   * ```
   */
  transform?: Layout.Transform
}

/** The serializable part of the configuration. */
export interface ConfigJson {
  /** Project name shown in the header. Defaults to the `package.json` name. */
  name: string
  /** Version label. Defaults to the `package.json` version, then the latest git tag. */
  version?: string
  /** Path to the `tsconfig.json` to compile with. Defaults to `tsconfig.json` in the project root. */
  tsconfig?: string
  /** Source root directory. Defaults to the tsconfig `rootDir`, then `src`. */
  srcDir: string
  /**
   * Files to document, each becoming a top-level module in the sidebar.
   * Defaults to the source files reachable from `package.json` `main` /
   * `exports`.
   */
  entrypoints: Entry[]
  /** Micromatch globs of source files to omit from the docs. */
  exclude: string[]
  /**
   * Markdown pages to include alongside the generated API pages. Defaults to
   * `README.md` as the home page. `content` may be a path to a markdown file
   * or inline markdown.
   */
  pages?: Page[]
  /** Navigation links shown in the header. Defaults to the repository URL. */
  links: Link[]
  /** Repository links used for "view source" anchors. Defaults to git metadata. */
  repository?: Repo
  /**
   * Path to a component-overrides file. The file default-exports
   * `defineComponents({ ... })` from `@lickle/docs/ui`; the CLI loads it and
   * mounts the overrides into the site.
   */
  components?: string
  /**
   * Shiki grammar names loaded for syntax highlighting, applied to fenced
   * code in markdown and `@example` blocks. Defaults to `['ts']`.
   */
  languages?: string[]
  /** Previously published versions, resolved from {@link UserConfig.versions}. */
  versions?: ConfigVersion[]
}

/** A previously published version, resolved from the `versions` glob. */
export interface ConfigVersion {
  /** Path to the version's `project.json` file. */
  path: string
  /** Version label, read from the file. */
  version: string
  /** Display name in the version switcher. Defaults to the version. */
  alias?: string
  /** URL prefix the version is served under, e.g. `v1-0-0`. */
  slug: string
}

/** A standalone markdown page. */
export interface Page {
  /** Page title shown in the sidebar. */
  title: string
  /** URL path of the page. Defaults to a slug derived from the title; `/` is the home page. */
  slug?: string
  /** Path to a markdown file, or inline markdown. */
  content: string
  /** Virtual sidebar folder to nest this page under, e.g. `'Guides'` (a `/` nests). Home (`slug: '/'`) ignores it. */
  folder?: string
  /** Sidebar bucket under its parent, e.g. `'Guides'`. */
  group?: string
  /** Sort position among its siblings (lower first); ties fall back to title. */
  order?: number
}

/** A source file documented as a top-level module. */
export interface Entry {
  /** Label used in the navigation, e.g. the export path `./config`. */
  as: string
  /** Source file path, e.g. `./src/index.ts`. */
  path: string
}

/** A navigation link shown in the header. */
export interface Link {
  /** Label used in the navigation. */
  label: string
  /** URL the link points at. */
  href: string
}

/** Repository metadata for linking pages back to source. */
export interface Repo {
  /** Repository URL. */
  url: string
  /** Commit the docs were generated from. */
  rev?: string
  /** File URL template with `{PATH}` `{LINE}` `{COLUMN}` placeholders, used to link declarations to source. */
  fileUrl?: string
}
