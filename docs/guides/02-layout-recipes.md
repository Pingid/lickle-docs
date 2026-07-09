---
title: Layout recipes
slug: layout-recipes
---

# Layout recipes

The layout is the whole page-generation policy in one composed function: which
declarations get pages, what they are called, where they live, how the sidebar
groups them. There are no separate fields for filtering, folders or ordering —
they are all layers.

```ts
import { defineConfig, Place, Match, Select } from '@lickle/docs/config'

export default defineConfig({
  name: 'My Library',
  layout: Place.compose(
    Place.defaultFilter,
    Place.bucket(Select.kind),
  ),
})
```

Three vocabularies combine:

| Namespace | Answers | Example |
| --- | --- | --- |
| `Match` | *which* — a yes/no predicate | `Match.kinds('interface')` |
| `Select` | *what* — a value derived per declaration | `Select.tag('@group')` |
| `Place` | *do* — a layer that refines the placement | `Place.folder(…, 'Types')` |

Two rules explain most surprises:

1. **Later layers win.** `Place.compose` applies left to right, and each layer
   sees what the ones below it produced. A second `Place.bucket` overrides the
   first.
2. **Supplying a layout replaces the default entirely** — filtering included.
   Compose `Place.defaultFilter` back in to keep the stock behaviour.

## Document more, or less

`Place.defaultFilter` is "exposed in the public API, and not `@internal`". It is
an ordinary layer, so widening means leaving it out:

```ts
// Document internals too — nothing is dropped.
layout: Place.bucket(Select.kind)
```

and narrowing means adding to it:

```ts
layout: Place.compose(
  Place.defaultFilter,
  Place.filter(Match.not(Match.tag('@alpha'))),
)
```

`Place.filter` removes a declaration outright, so `{@link}` references to it
break. When you only want it out of the sidebar, hide it instead:

```ts
// No route, but still resolvable for links and breadcrumbs.
Place.visibility(Match.tag('@deprecated'), { page: false })

// Keeps its page, drops the sidebar row.
Place.visibility(Match.kinds('type-alias'), { nav: false })
```

## Sections

`Place.bucket` assigns the heading a declaration lists under. Two forms — derive
it from the declaration, or pin matching declarations to a fixed name:

```ts
Place.compose(
  Place.bucket(Select.kind),                                    // "functions", "interfaces", …
  Place.bucket(Match.kinds('interface', 'type-alias'), 'types'), // collapse both into one
  Place.bucket(Select.tag('@group')),                           // @group wins where present
)
```

`Select.first` expresses the same fallback chain in one layer:

```ts
Place.bucket(Select.first(Select.tag('@group'), Select.kind))
```

Buckets are ordered separately, by name, with a regex catch-all to sweep the
rest:

```ts
Place.bucketOrder('components', 'hooks', 'types', /.*/)
```

The unnamed bucket always leads — it renders without a heading, so anything
below a heading belongs to that heading.

### A section for components

`Match.kind` takes a structural pattern over the raw reflection, which is how
you find "functions that return an `Element`" without tagging every one:

```ts
Place.bucket(
  Match.any(
    Match.kind('function', { signatures: { return: { reference: { name: 'Element' } } } }),
    Match.kind('variable', { type: { reference: { name: 'Component' } } }),
  ),
  'components',
)
```

### A section for the API surface

Entrypoint modules bucket as `''` by default, which puts them in the unlabelled
run. Give them their own heading:

```ts
Place.compose(
  Place.bucket(Select.kind),
  Place.bucket(Match.isEntry(), 'API'), // after Select.kind — later wins
  Place.bucketOrder('Guides', 'API', /.*/),
)
```

## Folders

A folder is a collapsible branch, created on demand by naming it. A `/` nests:

```ts
Place.folder(Match.kinds('type-alias', 'interface'), 'Types')
Place.folder(Match.tag('@experimental'), 'Advanced/Experimental')
```

Anywhere a preset takes a string it also takes a `Select`, so the folder can be
derived. `Select.dir` mirrors the source tree, optionally truncated:

```ts
Place.folder(Match.all(), Select.dir({ depth: 2 })) // src/core, src/ui, …
Place.folder(Match.all(), Select.entry())           // group by entrypoint
```

Folders with no surviving children are dropped, so filtering a whole directory
away never leaves an empty section behind.

## Order

`Place.bucketOrder` orders the sections; `Place.order` orders siblings inside
one. Each argument is a display name, a regex over it, or a `Match`, and a node
sorts by the index of its first match — unmatched nodes stay alphabetical after
them:

```ts
Place.order('Getting started', 'Configuration', Match.name('defineConfig'))
```

It applies to pages as well as declarations, so a hand-written guide can be
pinned above generated API entries:

```ts
Place.order(Match.page(), /.*/)
```

## Names and URLs

```ts
Place.rename(Match.name('UserConfig'), 'Config')   // sidebar label + page title
Place.slug(Match.name('defineConfig'), 'config')   // URL segment only
Place.rename(Match.all(), Select.tag('@name'))     // derive from a doc tag
```

A `Select` returning `undefined` means "no opinion", so the layer leaves that
declaration alone.

## Collapse small types onto their owner

`inline` renders a declaration in full on its parent's page, with no route of
its own — good for an options interface nobody wants to navigate to:

```ts
Place.visibility(Match.tag('@inline'), { inline: true })
```

`Match.bucket` reads the bucket earlier layers assigned, which lets you say
"everything *except* these sections":

```ts
Place.compose(
  Place.bucket(Select.kind),
  Place.visibility(Match.not(Match.bucket('components', 'hooks')), { inline: true }),
)
```

## Extra URLs

An alias is a second navigable URL for the same page — either a redirect to the
canonical one, or the same body rendered in place:

```ts
Place.alias(Match.name('defineConfig'), { name: 'config', parent: { root: true } })
Place.alias(Match.name('App'), { name: 'start', mode: 'render' })
```

## Pages, not just declarations

A preset touches standalone pages only when its match *mentions* them. That is
why `Place.folder(Match.kinds('function'), 'fns')` leaves your markdown exactly
where it was. Reach pages deliberately:

```ts
Place.folder(Match.page({ kind: 'markdown' }), 'Guides')
Place.bucket(Match.file('docs/reference/**'), 'Reference')
Place.order(Match.title('Getting started'), /.*/)
```

## Decisions that need the whole set

Layers see one source at a time by design. When a decision depends on everything
else — "inline any section with fewer than three members" — use `refine`, which
runs once with every placement in hand, before slugs are computed:

```ts
export default defineConfig({
  name: 'My Library',
  refine: (nodes) => {
    const counts = new Map<string, number>()
    for (const n of nodes) {
      const g = n.placement.page?.group?.name
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1)
    }
    for (const n of nodes) {
      const g = n.placement.page?.group?.name
      if (g && counts.get(g)! < 3 && n.placement.page) n.placement.page.render = 'inline'
    }
  },
})
```

## When it doesn't do what you expected

A composed layout is a stack of small functions, so an unexpected slug is hard
to attribute by reading the config. `ldocs why` re-runs the *same* layout with
tracing on and prints every layer that changed the outcome:

```bash
npx ldocs why UserConfig
```

```bash
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

Two `Place.bucket` layers competed here and the later one won — exactly rule 1.

Slug collisions are reported as warnings, and every colliding declaration falls
back to its source path so the outcome doesn't depend on scan order. Because
that quietly rewrites URLs, a project that cares about stable links should make
it fatal:

```bash
npx ldocs generate --strict
```
