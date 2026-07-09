import type ts from 'typescript6'

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
export interface UserConfig extends Partial<Omit<Config, 'versions' | 'pageSources' | 'includeFile'>> {
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
   * Decide whether a source file is scanned at all — the coarse, file-level
   * gate, applied before any declaration is read. Receives the file and the
   * default verdict (from `tsconfig` include/exclude and the `exclude` globs);
   * return the final verdict.
   *
   * `file.relative` is project-relative and POSIX-separated — the same path
   * `Match.file` globs and the same one a declaration's source line shows — so
   * a pattern written for one works in the other. `file.source` is the
   * `ts.SourceFile` escape hatch for anything the path can't express.
   *
   * For *declaration*-level decisions use a `Place.filter` layer in `layout`
   * instead; this hook cannot see declarations.
   *
   * @example Hide an internal directory
   * ```ts
   * include: (file, keep) => (file.relative.startsWith('src/internal/') ? false : keep)
   * ```
   */
  include?: (file: SourceRef, defaultValue: boolean) => boolean

  /**
   * The resolved file gate: `include` composed over the tsconfig's
   * include/exclude, the `exclude` globs and a `node_modules` guard. Produced by
   * `populate`; a config never sets this.
   */
  includeFile: (sf: ts.SourceFile) => boolean

  /**
   * The whole page-generation policy, as one composed {@link Layout}. Placement,
   * bucketing (`Place.bucket`), bucket order (`Place.bucketOrder`), sibling
   * order (`Place.order`), virtual folders (`Place.folder`), **filtering** and
   * aliases are all layers composed with `Place.compose` — there are no separate
   * fields. Predicates come from `Match`, per-declaration values from `Select`.
   *
   * Defaults to `Layout.defaultLayout` (drop unexposed and `@internal`, then
   * bucket by kind). Supplying a layout replaces that default *entirely*,
   * filtering included — compose `Place.defaultFilter` in to keep it, or leave
   * it out to document declarations the public API doesn't expose.
   *
   * @example
   * ```ts
   * layout: Place.compose(
   *   Place.defaultFilter,
   *   Place.bucket(Select.kind),
   *   Place.bucket(Select.tag('@group')),
   *   Place.order('Getting started', 'Configuration'),
   * )
   * ```
   */
  layout?: Layout.Layout
  /**
   * A pass over every placement once the layout has decided them all — the seam
   * for choices that depend on the whole set rather than one declaration.
   *
   * @example Inline any bucket with fewer than three members
   * ```ts
   * refine: (nodes) => {
   *   const counts = new Map<string, number>()
   *   for (const n of nodes) {
   *     const g = n.placement.page?.group?.name
   *     if (g) counts.set(g, (counts.get(g) ?? 0) + 1)
   *   }
   *   for (const n of nodes) {
   *     const g = n.placement.page?.group?.name
   *     if (g && counts.get(g)! < 3 && n.placement.page) n.placement.page.render = 'inline'
   *   }
   * }
   * ```
   */
  refine?: Layout.Refine
  /**
   * The `pages` entries resolved into concrete sources — globs expanded,
   * frontmatter applied, markdown read, component modules identified. Produced
   * by `populate`; a config never sets this.
   */
  pageSources: Layout.ContentSource[]
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
   * How much of the program to read.
   *
   * - `'all'` (default) — every file the tsconfig includes and `include` accepts.
   * - `'reachable'` — start at the entrypoints and follow imports, so files
   *   nothing exports are never scanned. Faster on large repos, and it makes
   *   `exclude` largely unnecessary.
   */
  scan?: 'all' | 'reachable'
  /**
   * Standalone pages shown alongside the generated API pages. Defaults to
   * `README.md` as the home page.
   *
   * Each entry is either a glob string or a {@link Page} object:
   *
   * - `'./docs/guides/**\/*.md'` — every match becomes a page. The title comes
   *   from YAML frontmatter, else the first `# heading`, else the filename; the
   *   folder defaults to the file's directory relative to the glob's fixed
   *   prefix, so the directory layout becomes the sidebar layout.
   * - `{ glob, group?, folder? }` — the same, with control over how the matches
   *   attach: `group` puts a plain heading above them, `folder: false` keeps
   *   them flat. See {@link GlobEntry}.
   * - `{ title, content }` — one explicit page. `content` may be a path to a
   *   `.md` file, a path to a `.tsx`/`.jsx` module default-exporting a SolidJS
   *   component, or inline markdown.
   *
   * Frontmatter keys (`title`, `slug`, `folder`, `group`, `order`) override the
   * derived values, so a single glob plus per-file frontmatter covers most
   * sites without listing pages here at all.
   *
   * @example
   * ```ts
   * pages: [
   *   { title: 'Overview', content: './README.md', slug: '/' },
   *   { glob: './docs/guides/*.md', group: 'Guides', folder: false },
   *   { title: 'Playground', content: './docs/playground.tsx', group: 'Guides' },
   * ]
   * ```
   */
  pages?: PageEntry[]
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
  /**
   * Public URL the docs are published under, e.g. `https://example.com/docs`.
   * Used to make links in `llms.txt` absolute; without it they are
   * root-relative, which is fine for a reader that already knows the origin and
   * useless for one that doesn't.
   */
  site?: string
  /**
   * The plain-text view of the site, for language models: `/llms.txt` (an
   * index), `/llms-full.txt` (every page in one file) and a `.md` beside every
   * page. Enabled by default; pass `false` to emit none of it, or an object to
   * choose which parts.
   *
   * @example
   * ```ts
   * llms: { full: false }  // index and per-page markdown, no single-file dump
   * ```
   */
  llms?: boolean | LlmsSettings
  /** Previously published versions, resolved from {@link UserConfig.versions}. */
  versions?: ConfigVersion[]
}

/** Which parts of the `llms.txt` output to emit. */
export interface LlmsSettings {
  /** The `/llms.txt` index. Default `true`. */
  index?: boolean
  /** The `/llms-full.txt` single-file dump. Default `true`. */
  full?: boolean
  /** A `.md` beside every page. Default `true`. */
  pages?: boolean
  /** Summary blockquote under the title. Defaults to the home page's first paragraph. */
  description?: string
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

/** One `pages` entry: an explicit page, a bare glob, or a glob with options. */
export type PageEntry = Page | GlobEntry | string

/**
 * A glob of page files plus how they attach to the sidebar. The bare-string
 * form (`'./docs/**\/*.md'`) is this with everything defaulted.
 *
 * The `folder` / `group` distinction is the sidebar's two shapes: a **folder**
 * is a collapsible branch, a **group** is a plain heading above a flat run of
 * items. Guides usually want a group; an API surface usually wants folders.
 */
export interface GlobEntry {
  /** Glob (or globs) of files to include as pages. */
  glob: string | string[]
  /**
   * Collapsible folder these pages nest under.
   *
   * - omitted — derived from the directory structure below the glob's fixed
   *   prefix, so the filesystem layout becomes the sidebar layout;
   * - `false` — no folder, so the pages sit flat wherever they attach;
   * - a string — that folder, with any derived subdirectories appended under it.
   */
  folder?: string | false
  /** Sidebar bucket: a plain, non-collapsible heading above these pages. */
  group?: string
  /** Starting slot for these pages *within* this entry's block; matches take successive slots. */
  order?: number
}

/** A standalone page — markdown, or a SolidJS component module. */
export interface Page {
  /** Page title shown in the sidebar. */
  title: string
  /** URL path of the page. Defaults to a slug derived from the title; `/` is the home page. */
  slug?: string
  /**
   * Path to a markdown file, path to a `.tsx`/`.jsx`/`.ts`/`.js` module that
   * default-exports a SolidJS component, or inline markdown.
   */
  content: string
  /** Virtual sidebar folder to nest this page under, e.g. `'Guides'` (a `/` nests). Home (`slug: '/'`) ignores it. */
  folder?: string
  /** Sidebar bucket under its parent, e.g. `'Guides'`. */
  group?: string
  /** Sort position among its siblings (lower first); ties fall back to title. */
  order?: number
}

/** A source file as `Config.include` sees it. */
export interface SourceRef {
  /** Absolute path on disk. */
  path: string
  /** Project-relative, POSIX-separated path — what `Match.file` globs. */
  relative: string
  /** The TypeScript source file, for checks the path can't express. */
  source: ts.SourceFile
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
