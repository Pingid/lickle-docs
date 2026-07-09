# @lickle/docs

Generate a documentation site from your TypeScript source. `@lickle/docs` reflects over your code with the TypeScript compiler, reads your TSDoc/JSDoc, and renders a fast, searchable site — no hand-written API pages.

> Early development (`0.0.0-dev.x`); APIs and output may change.

## Install

```bash
pnpm add -D @lickle/docs
```

## Quick start

```bash
npx ldocs dev    # dev server with live reload
npx ldocs build  # build for production
npx ldocs init   # scaffold lickle.ts + docs/ with a component example
```

## CLI

- `ldocs init` — scaffold config and `docs/`. `--dir` (default `./docs`), `--config` (default `./lickle.ts`), `--force`.
- `ldocs dev` — dev server with live reload. `--port`, `--base`, `--router hash|browser`.
- `ldocs build` — build into the output dir. `--static` (SSG), `--no-script` (no client JS, static only), `--router`, `--base`, `--outDir` (default `docs/dist`).
- `ldocs preview` — serve a built site. `--port`, `--base`.
- `ldocs generate` — emit the JSON reflection data. `--print` shows the route tree, `--file` sets the output path, `--strict` fails on any warning.
- `ldocs why <query>` — explain how a declaration or page ended up where it did.

### Debugging a layout

A composed layout is a stack of small functions, so an unexpected slug is hard
to attribute by reading the config. `ldocs why` re-runs the same layout with
tracing on and prints every layer that changed the outcome:

```bash
npx ldocs why UserConfig
```

```
interface UserConfig
  src/core/config/types.ts

  default  / → UserConfig  nav×2
  Place.bucket         / → UserConfig  bucket=interfaces  nav×2
  Place.bucket         / → UserConfig  bucket=types  nav×2
  Place.bucketOrder    / → UserConfig  bucket=types#3  nav×2
  Place.visibility     / → UserConfig  bucket=types#3  nav=none

  result   / → UserConfig  bucket=types#3  nav=none
  slug     userconfig
```

## Configuration

Optional — defaults come from `package.json`, git, and your `README.md`. To customize, add a `lickle.ts` (or `.js`/`.mjs`/`.json`) to the project root:

```ts
import { defineConfig } from '@lickle/docs/config'

export default defineConfig({
  name: 'My Library',
  pages: [{ title: 'Overview', content: './README.md' }],
  components: './docs/index.tsx',
})
```

Useful fields:

- `name` / `version` — defaults to `package.json` (version falls back to the latest git tag).
- `entrypoints` — files to document (defaults to those reachable from `main` / `exports`).
- `pages` — standalone pages: globs, `{ glob, group?, folder? }` options, `{ title, content }` objects, or a mix (see below).
- `components` — path to a custom components file (see below).
- `languages` — Shiki languages to load (default `['ts']`).
- `links` — navigation links (default: repository URL).
- `exclude` — micromatch globs to omit.
- `scan` — `'all'` (default) or `'reachable'` to walk out from the entrypoints instead of reading every file.
- `site` — public URL the docs are published under; makes `llms.txt` links absolute.
- `llms` — the plain-text view for language models (see below). On by default.
- `layout` — the whole page-generation policy, including filtering (see below).
- `refine` — a pass over every placement once they are all decided.

### What gets documented

Four things narrow the output, at three different stages. Only the last two see
declarations:

| Stage | Field | Sees | Use it for |
| --- | --- | --- | --- |
| Scan | `exclude` | file paths | dropping whole directories |
| Scan | `include(file, keep)` | one file at a time | anything a glob can't express |
| Layout | `Place.filter(match)` | declarations and pages | removing a declaration entirely |
| Layout | `Place.visibility(match, …)` | declarations and pages | hiding a page but keeping `{@link}` resolvable |

Every path in the table is **project-relative and POSIX-separated** — the same
string `Match.file` globs, `include` receives as `file.relative`, and a
declaration's source line shows. A pattern written for one works in the other.

`Place.filter` removes a declaration outright, so `{@link}` references to it
break. When you only want it out of the sidebar, reach for `Place.visibility`
instead.

Filtering is a *layer*, not a separate field. The default layout is
`Place.compose(Place.defaultFilter, Place.bucket(Select.kind))`; supplying your
own `layout` replaces that entirely, so compose `Place.defaultFilter` back in to
keep the stock behaviour — or leave it out to document declarations the public
API doesn't expose:

```ts
layout: Place.compose(
  Place.defaultFilter,                        // exposed, minus @internal
  Place.bucket(Select.kind),                  // bucket by kind
  Place.bucket(Select.tag('@group')),         // …unless @group says otherwise
  Place.bucketOrder('components', 'hooks', /.*/), // order the buckets
  Place.order('Getting started', /^Config/),  // order siblings within a bucket
  Place.folder(Match.kinds('type-alias'), 'Types'),
)
```

`Match` builds the predicates, `Select` derives per-declaration values, and
anywhere a preset takes a string it also takes a `Select`:

```ts
Place.folder(Match.all(), Select.dir())        // mirror the source tree
Place.rename(Match.all(), Select.tag('@name')) // rename from a doc tag
Place.bucket(Select.first(Select.tag('@group'), Select.kind))
```

Layers see one source at a time. For a decision that depends on everything else
— "inline any bucket with fewer than three members" — use `refine`, which runs
once with every placement in hand.

## Pages

`pages` accepts globs and explicit entries side by side:

```ts
pages: [
  { title: 'Overview', content: './README.md', slug: '/' },
  { glob: './docs/guides/*.md', group: 'Guides', folder: false },
  { title: 'Playground', content: './docs/playground.tsx', group: 'Guides' },
]
```

### Folders vs groups

The sidebar has two shapes, and picking the right one is most of the layout:

- a **folder** is a collapsible branch — good for an API surface, where the
  contents are many and mostly skipped;
- a **group** is a plain heading above a flat run of items — good for guides,
  where the whole list should be visible at a glance.

`Place.folder` and a page's `folder` produce the first; `Place.bucket` and a
page's `group` produce the second. The config above yields:

```
Overview
Guides                 ← heading, always expanded
  Getting started
  Configuring the site
  Playground
API                    ← heading
  › config             ← collapsible
  › ui
```

with the API section coming from the layout:

```ts
Place.bucket(Match.isEntry(), 'API'),
Place.bucketOrder('Guides', 'API', /.*/),
```

The unnamed bucket (`Overview` here) always leads, since it has no heading to
sit under.

### Globs

A bare glob string derives everything from the filesystem; the object form
controls how the matches attach:

| Field | Effect |
| --- | --- |
| *(bare string)* | folder derived from the directory structure below the glob's fixed prefix |
| `folder: false` | flat — no folder, not even a derived one |
| `folder: 'X'` | rooted at `X`, with derived subdirectories appended |
| `group: 'X'` | a plain heading above the matches |

Titles come from YAML frontmatter, else the first `# heading`, else the
filename. Ordering is two-level: an entry's position in `pages` decides which
block of the sidebar its pages occupy, and frontmatter `order` / a `01-`
filename prefix / match position orders them within that block. Frontmatter
overrides all of it:

```md
---
title: Getting started
slug: start
folder: Guides
group: Basics
order: 1
draft: false
---
```

`draft: true` keeps a page out of the build.

### Component pages

Point a page at a `.tsx` file that default-exports a SolidJS component and it
renders as a real page — routed, in the sidebar, and pre-rendered by `--static`
like any other. It runs inside the docs providers, so the hooks and components
from `@lickle/docs/ui` all work inside it:

```tsx
import { createSignal } from 'solid-js'
import { type PageProps, useProject } from '@lickle/docs/ui'

export default function Playground(props: PageProps) {
  const project = useProject()
  const [n, setN] = createSignal(0)
  return (
    <article>
      <h1>{props.route.title}</h1>
      <button onClick={() => setN(n() + 1)}>clicked {n()} times</button>
    </article>
  )
}
```

Each component page is bundled as its own chunk, so interactive pages cost
nothing on the pages that don't use them.

## llms.txt

The site also ships a plain-text view for language models, following the
[llmstxt.org](https://llmstxt.org) convention:

- **`/llms.txt`** — an index: the project name, a summary, then one section per
  top-level sidebar group listing every page as a link with a one-line
  description. Small enough to fetch as an opening move.
- **`/llms-full.txt`** — every page's markdown in one file.
- **`/<slug>.md`** — each page on its own, so a link found in `llms.txt` can be
  followed to just that page.

All three come from the same serializer behind the "copy as markdown" button, so
what a model reads is what a human would copy. They are written into the output
directory by `ldocs build` and served by `ldocs dev`, so `curl
localhost:5173/llms.txt` works while you write.

It is on by default. Set `site` so the links come out absolute — a model may
have fetched the file with no idea where it came from:

```ts
export default defineConfig({
  name: 'My Library',
  site: 'https://example.com/docs',
  llms: { full: false }, // index and per-page markdown, no single-file dump
})
```

Pass `llms: false` to emit none of it.

## Custom components & live examples

Point `components` at a file that default-exports `defineComponents(...)`. Override the `tag` slot for runnable `@example` blocks and defer the rest to the stock renderer:

```tsx
import { defineComponents, LiveExample } from '@lickle/docs/ui'

const run = (code: string, host: HTMLElement) => new Function('host', code)(host)

export default defineComponents({
  tag: (props) =>
    props.tag.tag === '@example' ? (
      <LiveExample tag={props.tag} run={run} transform={{}} />
    ) : (
      <props.Default {...props} />
    ),
})
```

The UI is SolidJS, styled with Tailwind via `@lickle/docs/theme.css`.

## Documenting your code

Docs come from standard TSDoc/JSDoc on exported declarations. `@module` sets a module banner; `@example` blocks render as examples (runnable when you opt in via custom components).

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

## License

[MIT](https://github.com/Pingid/lickle-docs) © Dan Beaven
