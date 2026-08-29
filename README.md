# @lickle/docs

Generate a documentation site from your TypeScript source. Reflects over your code with the TypeScript compiler, reads your TSDoc, renders a fast searchable site. No hand-written API pages.

> Early development (`0.0.0-dev.x`); APIs and output may change.

---

## Quick start

```bash
pnpm add -D @lickle/docs
npx ldocs dev
```

You don't need config. Name, version and entry points come from `package.json`,
repository links from git, the home page from `README.md`.

Build it:

```bash
npx ldocs build --static
```

Output goes to `docs/dist`. `--static` pre-renders every route; without it you
get a single-page app.

**Only seeing the home page?** Entry points resolve from `exports` / `main`,
mapped back to source through your tsconfig's `outDir` → `rootDir`. Name them
yourself if that doesn't fit:

```ts
entrypoints: [{ as: '.', path: './src/index.ts' }]
```

## Document your code

API pages come from TSDoc on your exports. Nothing else to maintain.

````ts
/**
 * Add two numbers.
 *
 * @example
 * ```ts
 * add(1, 2) // => 3
 * ```
 */
export const add = (a: number, b: number): number => a + b
````

`@param`, `@returns`, `@throws`, `@see` and `@deprecated` all render. A leading
comment at the top of a file becomes that module's banner. Backticked names link
themselves: `` `add` `` points at `add`'s page.

`@internal` drops a declaration from the site. Every other tag means whatever
your [layout](#shaping-the-site) says — `Place.bucket(Select.tag('@group'))`
turns `@group Hooks` into a "Hooks" heading.

## Configure

Add `lickle.ts` (or `.js` / `.mjs` / `.json`) to the project root. Only `name`
is required.

```ts
import { defineConfig } from '@lickle/docs/config'

export default defineConfig({
  name: 'My Library',
  languages: ['ts', 'tsx', 'bash'],
})
```

`npx ldocs init` scaffolds one, plus a `docs/` folder with a starter guide and
a component override. It never overwrites — pass `--force` for that.

## Add guides

Each markdown file becomes a page. Title from the first `# heading`, order from
a `01-` filename prefix.

```ts
pages: [
  { title: 'Overview', content: './README.md', slug: '/' },
  { glob: './docs/guides/*.md', group: 'Guides', folder: false },
]
```

```
docs/guides/01-getting-started.md
docs/guides/02-configuration.md
```

gives you:

```
Overview               ← ungrouped pages lead
My Library             ← your API, generated
  functions            ← kinds become headings by default
    add
Guides                 ← a plain heading
  Getting started
  Configuration
```

Ungrouped entries come first: they have no heading to sit under. To reorder, see
[Shaping the site](#shaping-the-site).

Frontmatter overrides anything derived:

```md
---
title: Getting started
slug: start
order: 1
draft: true
---
```

## Publish

```bash
npx ldocs build --static --base my-lib
```

`--base` is the path you serve under. Set it for GitHub Pages project sites
(`https://you.github.io/my-lib/`), drop it at a domain root. Check the result
with `npx ldocs preview`.

---

Reference below.

---

## CLI

| Command | Flags |
| --- | --- |
| `ldocs dev` | Dev server with live reload. `--port`, `--base`, `--router hash\|browser`, `--dir` |
| `ldocs build` | `--static` (SSG), `--no-script` (no client JS), `--outDir` (default `docs/dist`), `--base`, `--router`, `--dir` |
| `ldocs preview` | Serve a built site. `--port`, `--base`, `--outDir` |
| `ldocs init` | Scaffold `lickle.ts` + `docs/`, skipping anything that exists. `--dir` (default `./docs`), `--config`, `--force` |
| `ldocs generate` | Emit the JSON reflection data. `--print`, `--file`, `--strict`, `--dir` |
| `ldocs why <query>` | Explain how a declaration or page ended up where it did |

`--dir` targets another project directory instead of the working directory.

## Configuration

| Field | Default | Notes |
| --- | --- | --- |
| `name` | `package.json` name | Shown in the header |
| `version` | `package.json` version, then the latest git tag | |
| `entrypoints` | `exports` / `main`, mapped to source via tsconfig `outDir` → `rootDir` | Each becomes a top-level module |
| `tsconfig` | `tsconfig.json` | Its `rootDir` becomes `srcDir` |
| `exclude` | `[]` | Micromatch globs of source files to omit |
| `include` | — | `(file, keep) => boolean`, the last word per file |
| `scan` | `'all'` | `'reachable'` walks out from the entrypoints instead |
| `pages` | `README.md` as the home page | Globs, glob options, or explicit entries |
| `links` | the repository URL | Header navigation |
| `repository` | git metadata | Drives the "view source" links |
| `languages` | `['ts']` | Shiki grammars for fenced code and `@example` |
| `components` | — | Path to a `defineComponents(...)` file |
| `layout` | bucket by kind | The whole page-generation policy — a `Page` tree, an `Outline`, or layers |
| `refine` | — | A pass over every placement once they are all decided |
| `transform` | — | Runs over each declaration after layout |
| `versions` | — | Glob of `project.json` files from earlier releases |
| `site` | — | Public URL; makes `llms.txt` links absolute |
| `llms` | `true` | The plain-text view for language models |

`defineConfig` also takes a function, sync or async:

```ts
export default defineConfig(async () => ({
  name: 'My Library',
  version: await readVersionFromChangelog(),
}))
```

## Pages

Three kinds of entry:

```ts
pages: [
  { title: 'Overview', content: './README.md', slug: '/' },  // one page
  './docs/guides/**/*.md',                                    // a glob
  { glob: './docs/api/*.md', group: 'Reference' },            // a glob with options
]
```

`content` takes a `.md` path, a `.tsx` path (see [Component pages](#component-pages)),
or inline markdown.

### Folders and groups

The sidebar has two shapes:

- a **folder** is a collapsible branch — for an API surface, mostly skipped;
- a **group** is a plain heading over a flat list — for guides, all visible.

A glob entry picks between them:

| Setting | Result |
| --- | --- |
| *(bare glob)* | folder derived from the directory structure below the glob's fixed prefix |
| `folder: false` | flat — no folder, not even a derived one |
| `folder: 'Guides'` | rooted there, with derived subdirectories appended |
| `group: 'Guides'` | a plain heading above the matches |

`Place.folder` and `Place.bucket` do the same two jobs for API pages.

### Titles and order

Titles come from frontmatter, else the first `# heading`, else the filename.
Frontmatter (`title`, `slug`, `folder`, `group`, `order`, `draft`) wins over
anything derived. `draft: true` keeps a page out of the build.

Order is two-level: an entry's position in `pages` picks its block of the
sidebar; frontmatter `order:`, a `01-` prefix, or match position orders pages
inside that block.

## Shaping the site

The layout is the whole page-generation policy — which declarations get pages,
what they're called, where they live, how the sidebar groups them. Filtering,
folders and ordering are all part of it, not separate fields.

Say it as a **tree** when you know what the sidebar should look like — the
nesting of the definition is the nesting of the site:

```ts
import { defineConfig, Place, Match, Select, Page } from '@lickle/docs/config'

export default defineConfig({
  name: 'My Library',
  layout: Place.compose(
    Place.defaultFilter, // exposed, minus @internal
    Page.roots(
      Page.nav('Overview', Match.file('README.md')),
      Page.section('Guides', Page.children(Match.file('docs/guides/**'))),
      Page.nav('API', Match.file('src/core.ts'), Page.bucket(Select.tag('@group'))),
      Page.nav('String', Match.file('src/string.ts'), Page.bucket(Select.tag('@group')), Page.inline),
    ),
  ),
})
```

A `nav` is a row (the source its `Match` names, renamed to the label), a
`section` is a heading, a `folder` collapses, `children` gathers a set, and the
modifiers — `bucket`, `inline`, `order`, `depth`, `layer` — apply to everything
beneath their node. The tree is the whole sidebar: what it doesn't reach keeps
its page but gets no row. It compiles to the layers below, so `ldocs why`
still attributes every decision.

Or as a flat **list** (`Outline.of`), where the first section to match a source
claims it and each section says how deep it expands:

```ts
Place.compose(
  Place.defaultFilter,
  Outline.of(
    { name: 'Guides', include: Match.file('docs/guides/**'), order: ['Getting started'] },
    { name: 'API', include: Match.isEntry(), depth: 2, beyond: 'inline' },
    { name: 'types', include: Match.kinds('interface', 'type-alias'), nav: false },
    { name: /.+/ }, // then everything else
  ),
)
```

Or say it as **layers** when you're refining one thing:

```ts
Place.compose(
  Place.defaultFilter,
  Place.bucket(Select.kind),                      // bucket by kind
  Place.bucket(Select.tag('@group')),             // …unless @group says otherwise
  Place.bucketOrder('components', 'hooks', /.*/), // order the buckets
  Place.order('Getting started', /^Config/),      // order within a bucket
  Place.folder(Match.kinds('type-alias'), 'Types'),
  Place.pagesFor(Match.bucket('components', 'hooks')), // the rest reads inline
  Place.qualify(Match.all(), false),                   // flat sidebar labels
)
```

| Namespace | Answers | Example |
| --- | --- | --- |
| `Match` | *which* — a yes/no predicate | `Match.kinds('interface')` |
| `Select` | *what* — a value per declaration | `Select.tag('@group')` |
| `Place` | *do* — a layer that refines placement | `Place.folder(…, 'Types')` |
| `Outline` | *shape* — the sidebar as an ordered list | `Outline.of({ name: 'API', … })` |
| `Page` | *shape* — the sidebar as a nested tree | `Page.roots(Page.nav('API', …))` |

Two rules explain most surprises:

1. **Later layers win.** `compose` applies left to right; a second `Place.bucket`
   overrides the first. (Inside an outline or a page tree it's the other way
   round — the *first* part to name a source claims it, as an ordered list reads.)
2. **A layout replaces the default entirely**, filtering included.

Anywhere a preset takes a string it takes a `Select`:

```ts
Place.folder(Match.all(), Select.dir())        // mirror the source tree
Place.rename(Match.all(), Select.tag('@name')) // rename from a doc tag
Place.bucket(Select.first(Select.tag('@group'), Select.kind))
```

`Place.within(match, …layers)` scopes rules to part of the site, and
`Match.under` turns "this entrypoint" into "this entrypoint's subtree":

```ts
Place.within(Match.under(Match.name('experimental')), Place.depth(1))
```

Layers see one source at a time — including what the export graph says about it,
so `Match.depth`, `Match.members` and `Match.under` all work per-source. For
decisions that need the whole set — "inline any bucket with fewer than three
members" — use `refine`.

### Pages, inline, or neither

| | |
| --- | --- |
| `Place.inline(match)` | full docs on the parent's page, no route |
| `Place.hide(match)` | no route, still resolvable for `{@link}` |
| `Place.pagesFor(match)` | these keep pages, every other declaration inlines |
| `Place.depth(n, { beyond })` | expand `n` levels; past that, `'nav'` \| `'inline'` \| `'hidden'` |

Depth counts re-export hops from an entrypoint — the same number the sidebar
nests by, so `Place.depth(1)` is "entrypoints and their members, nothing deeper".
`Place.pagesFor` never inlines a module or namespace, since those are what the
inlined members render *on*.

### What gets documented

Four fields narrow the output, at three stages. Only the last two see
declarations:

| Stage | Field | Sees | Use it for |
| --- | --- | --- | --- |
| Scan | `exclude` | file paths | dropping whole directories |
| Scan | `include(file, keep)` | one file at a time | what a glob can't express |
| Layout | `Place.filter(match)` | declarations and pages | removing a declaration entirely |
| Layout | `Place.hide` / `Place.inline` | declarations and pages | hiding a page, or folding it onto its parent |

Every path is project-relative and POSIX-separated — the same string
`Match.file` globs, `include` gets as `file.relative`, and a source line shows.

`Place.filter` removes a declaration outright, breaking `{@link}` references to
it. To only drop it from the sidebar, use `Place.visibility`.

The default layout is `Place.compose(Place.defaultFilter, Place.bucket(Select.kind))`.
Compose `Place.defaultFilter` back in to keep stock filtering; leave it out to
document unexposed declarations.

### Why is this page here?

A layout is a stack of small functions, so an unexpected slug is hard to
attribute by reading the config. `ldocs why` re-runs the same layout with
tracing on:

```bash
npx ldocs why UserConfig
```

```
interface UserConfig
  src/core/config/types.ts

  default  / → UserConfig  nav×2
  Place.bucket         / → UserConfig  bucket=interfaces  nav×2
  Outline.section(types) / → UserConfig  bucket=types  nav×2
  Place.bucketOrder    / → UserConfig  bucket=types#5  nav×2
  Place.visibility     / → UserConfig  bucket=types#5  nav=none

  result   / → UserConfig  bucket=types#5  nav=none
  slug     userconfig
```

Each line is the innermost layer that produced that state: a `Place.bucket`
fallback assigned `interfaces`, the outline's `types` section took it over, and
the section's `nav: false` dropped the row. Nested wrappers that only pass the
same result upward are left out.

Slug collisions are warnings, resolved deterministically. Since that rewrites
URLs, make it fatal with `npx ldocs generate --strict`.

## Component pages

A `.tsx` file that default-exports a SolidJS component becomes a real page —
routed, in the sidebar, pre-rendered by `--static`. It runs inside the docs
providers, so everything from `@lickle/docs/ui` works:

```tsx
import { createSignal } from 'solid-js'
import { type PageProps, useProject } from '@lickle/docs/ui'

export default function Playground(props: PageProps) {
  const project = useProject()
  const [n, setN] = createSignal(0)
  return (
    <article>
      <h1>{props.route.title}</h1>
      <p>{project()?.declarations.length} declarations documented.</p>
      <button onClick={() => setN(n() + 1)}>clicked {n()} times</button>
    </article>
  )
}
```

```ts
pages: [{ title: 'Playground', content: './docs/playground.tsx' }]
```

Each one is its own chunk, so interactive pages cost nothing elsewhere.

## Custom components

Point `components` at a file that default-exports `defineComponents(...)`.
Override a slot, defer the rest to the stock renderer:

```tsx
import { defineComponents, LiveExample } from '@lickle/docs/ui'

const run = (code: string, host: HTMLElement) => new Function('host', code)(host)

export default defineComponents({
  tag: (props) =>
    props.tag.kind === '@example' ? (
      <LiveExample tag={props.tag} run={run} transform={{}} />
    ) : (
      <props.Default {...props} />
    ),
})
```

The UI is SolidJS, styled with Tailwind via `@lickle/docs/theme.css`.

## llms.txt

A plain-text view of the site for language models, following
[llmstxt.org](https://llmstxt.org):

- **`/llms.txt`** — an index: name, summary, then one section per top-level
  sidebar group listing every page with a one-line description.
- **`/llms-full.txt`** — every page's markdown in one file.
- **`/<slug>.md`** — each page on its own, which is what the index links to.

All three come from the same serializer as the "copy as markdown" button. `ldocs
build` writes them; `ldocs dev` serves them, so you can `curl` them while you
write.

On by default. Set `site` so links come out absolute — a model may have fetched
the file with no idea where it came from:

```ts
export default defineConfig({
  name: 'My Library',
  site: 'https://example.com/docs',
  llms: { full: false }, // index and per-page markdown, no single-file dump
})
```

`llms: false` emits none of it.

## License

[MIT](https://github.com/Pingid/lickle-docs) © Dan Beaven
