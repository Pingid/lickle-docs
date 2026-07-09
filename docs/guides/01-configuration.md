---
title: Configuration
slug: configuration
---

# Configuration

Configuration is optional. With no config file at all, `ldocs` reads
`package.json` for the project name, version and entrypoints, git for the
repository links, and `README.md` for the home page — enough for a working site.

To customise, add a `lickle.ts` (or `.js`, `.mjs`, `.json`) to the project root
and default-export `defineConfig`:

```ts
import { defineConfig } from '@lickle/docs/config'

export default defineConfig({
  name: 'My Library',
})
```

`defineConfig` also accepts a function, sync or async, for anything computed at
load time:

```ts
export default defineConfig(async () => ({
  name: 'My Library',
  version: await readVersionFromChangelog(),
}))
```

## Project identity

| Field | Default |
| --- | --- |
| `name:` | the `package.json` name |
| `version:` | the `package.json` version, then the latest git tag |
| `repository:` | git remote, resolved to a commit-pinned file URL |
| `links:` | a single "Repository" link |
| `languages:` | `['ts']` — Shiki grammars loaded for fenced code and `@example` blocks |

`repository` is what turns each declaration's source line into a link, so it is
worth setting explicitly if your package lives in a monorepo subdirectory.

## What gets scanned

Four fields decide which source the reflection sees, from coarsest to finest:

```ts
export default defineConfig({
  name: 'My Library',
  tsconfig: './tsconfig.build.json',
  entrypoints: [{ as: '.', path: './src/index.ts' }],
  exclude: ['src/internal/**'],
  include: (file, keep) => (file.relative.endsWith('.test.ts') ? false : keep),
})
```

- `tsconfig` — the project to compile. Defaults to `tsconfig.json` in the root;
  its `rootDir` becomes `srcDir` and its `include`/`exclude` are honoured.
- `entrypoints` — the files documented as top-level modules. Defaults to the
  sources reachable from `package.json` `main` / `exports`, so a well-described
  package needs nothing here.
- `exclude` — micromatch globs to omit.
- `include` — the last word, per file. It receives the default verdict and
  returns the final one.

Every path is **project-relative and POSIX-separated**. `file.relative` is the
same string `Match.file` globs and the same one a declaration's source line
shows, so a pattern written for one works in the other. `file.source` is the
`ts.SourceFile` if you need something a path can't express.

### Scanning less

By default every file the tsconfig includes is read, and unexposed declarations
are dropped later during layout. On a large repo it is cheaper to start at the
entrypoints and follow imports:

```ts
export default defineConfig({
  name: 'My Library',
  scan: 'reachable',
})
```

Files nothing exports are then never read at all, which also makes `exclude`
largely unnecessary.

Note that `include` and `exclude` are *file*-level. To drop a particular
declaration, use a `Place.filter` layer in `layout` — see
[Layout recipes](/layout-recipes).

## Pages

`pages` accepts globs and explicit entries side by side:

```ts
export default defineConfig({
  name: 'My Library',
  pages: [
    { title: 'Overview', content: './README.md', slug: '/' },
    { glob: './docs/guides/*.md', group: 'Guides', folder: false },
    { title: 'Playground', content: './docs/playground.tsx' },
  ],
})
```

An entry is one of three things:

- **a glob** — every match becomes a page;
- **`{ title, content }`** — one page, where `content` is a path to a `.md`
  file, a path to a `.tsx` module, or inline markdown;
- **`{ glob, group?, folder?, order? }`** — a glob plus how its matches attach.

### Folders and groups

The sidebar has two shapes and choosing between them is most of the layout work:

- a **folder** is a collapsible branch — right for an API surface, where there
  is a lot and most of it is skipped;
- a **group** is a plain heading over a flat list — right for guides, where the
  whole list should be visible.

A glob's `folder:` controls the first and `group:` the second:

| Setting | Result |
| --- | --- |
| *(bare glob string)* | folder derived from the directory structure below the glob's fixed prefix |
| `folder: false` | flat — no folder, not even a derived one |
| `folder: 'Guides'` | rooted at that folder, with derived subdirectories appended |
| `group: 'Guides'` | a plain heading above the matches |

### Frontmatter

Titles come from YAML frontmatter, else the first `# heading`, else the
filename. Frontmatter overrides everything derived:

```md
---
title: Configuration
slug: configuration
folder: Guides
group: Basics
order: 1
draft: false
---
```

`draft: true` keeps a page out of the build, so an unfinished guide can sit in
the glob without shipping.

Ordering is two-level: an entry's position in `pages` decides which block of the
sidebar its pages occupy, and frontmatter `order:`, a `01-` filename prefix, or
match position orders them *within* that block. The config decides which section
comes first; the files decide the order inside it.

## Component pages

Point a page at a `.tsx` file that default-exports a SolidJS component and it
becomes a real page — routed, in the sidebar, and pre-rendered by `--static`
like any other. It runs inside the docs providers, so everything exported from
`@lickle/docs/ui` works inside it:

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

Each component page is bundled as its own chunk, so interactive pages cost
nothing on the pages that don't use them.

## Rendering

`components` points at a file that default-exports `defineComponents(...)`,
letting you replace a named slot and leave the rest of the site stock:

```ts
export default defineConfig({
  name: 'My Library',
  components: './docs/components.tsx',
})
```

`transform` runs over each declaration *after* layout has read it — the place to
strip mechanical tags the grouping already consumed, so they don't render on the
page:

```ts
import { Transform } from '@lickle/docs/config'

export default defineConfig({
  name: 'My Library',
  transform: Transform.stripTags('@group'),
})
```

The ordering matters: running transforms after layout means stripping `@group`
cannot hide it from `Select.tag('@group')`.

## llms.txt

Alongside the HTML site, `ldocs` emits a plain-text view for language models,
following the [llmstxt.org](https://llmstxt.org) convention:

- `/llms.txt` — an index of every page, one section per top-level sidebar group,
  each entry a link plus a one-line description;
- `/llms-full.txt` — every page's markdown concatenated;
- `/<slug>.md` — each page on its own, which is what the index links to.

All three are produced by the same serializer behind the "copy as markdown"
button, so a model reads exactly what a human would copy. `ldocs build` writes
them into the output directory and `ldocs dev` serves them, so they can be
checked with `curl` while you write.

It is on by default. The one thing worth setting is `site`, so links come out
absolute — a model may have fetched `llms.txt` with no idea what origin it came
from:

```ts
export default defineConfig({
  name: 'My Library',
  site: 'https://example.com/docs',
})
```

Parts can be switched off individually, or the whole thing with `llms: false`:

```ts
export default defineConfig({
  name: 'My Library',
  llms: { full: false }, // skip the single-file dump, keep the rest
})
```

## Versions

`versions` is a glob of `project.json` files emitted by earlier `ldocs generate`
runs. Matches appear in the header's version switcher alongside the current
build:

```ts
export default defineConfig({
  name: 'My Library',
  versions: './docs/version/*.json',
})
```

Archived versions carry page *data*, not code, so a component page from an older
release shows its title with a note rather than rendering.
