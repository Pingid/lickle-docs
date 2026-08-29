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

Five vocabularies combine:

| Namespace | Answers | Example |
| --- | --- | --- |
| `Match` | *which* — a yes/no predicate | `Match.kinds('interface')` |
| `Select` | *what* — a value derived per declaration | `Select.tag('@group')` |
| `Place` | *do* — a layer that refines the placement | `Place.folder(…, 'Types')`, `Place.into(…, Match.entry('ui'))` |
| `Outline` | *shape* — the whole sidebar as an ordered list | `Outline.of({ name: 'API', … })` |
| `Page` | *shape* — the whole sidebar as a nested tree | `Page.roots(Page.nav('API', …))` |

`Page` and `Outline` are the declarative faces of the other three: start with
`Page.roots` if you know what the sidebar should look like, and drop to `Place`
layers for the parts a tree doesn't say.

Two rules explain most surprises:

1. **Later layers win.** `Place.compose` applies left to right, and each layer
   sees what the ones below it produced. A second `Place.bucket` overrides the
   first.
2. **Supplying a layout replaces the default entirely** — filtering included.
   Compose `Place.defaultFilter` back in to keep the stock behaviour.

## The tree: the definition mirrors the site

A composed chain is a sequence of *edits*, which is the right shape when you
are refining one thing and an indirect one when what you want to state is the
shape of the site. `Page.roots` states the shape as a tree — the nesting of the
definition **is** the nesting of the generated sidebar:

```ts
import { defineConfig, Place, Match, Select, Page } from '@lickle/docs/config'

export default defineConfig({
  name: 'My Library',
  layout: Place.compose(
    Place.defaultFilter,
    Page.roots(
      Page.nav('Overview', Match.file('README.md')),
      Page.section('Guides', Page.children(Match.file('docs/guides/**'))),
      Page.nav('API', Match.file('src/core.ts'), Page.bucket(Select.tag('@group'))),
      Page.nav('String', Match.file('src/string.ts'), Page.bucket(Select.tag('@group')), Page.inline),
    ),
  ),
})
```

Three words, three sidebar shapes, plus a gatherer:

| Part | Is |
| --- | --- |
| `Page.nav(label, match, …parts)` | a **row** — the one source the `Match` names, renamed to the label, its members nested beneath it |
| `Page.section(label, …parts)` | a **heading** grouping its child rows |
| `Page.folder(label, …parts)` | a **collapsible folder** with no page of its own |
| `Page.children(match)` | a **set** gathered under the enclosing node, keeping their own names and order |

The rest of a `nav`'s parts are modifiers over everything beneath it:
`Page.bucket` groups the members under headings, `Page.inline` renders them on
the node's page, `Page.order` pins their order, `Page.depth(n, beyond?)` cuts
the expansion, and `Page.layer(…)` scopes any raw `Place` layer to the subtree.
(`Page.compose(…)` bundles parts into one value when you want to build them up
separately.)

Three properties make a tree predictable:

1. **List order is display order**, at every level.
2. **The first part to name a source owns it** — two overlapping matches never
   fight, exactly as an ordered list reads.
3. **The tree is total over the sidebar**: a source it doesn't reach — not a
   row, not gathered, not exposed beneath a row — keeps its page and simply
   gets no sidebar row. Which pages *exist* is still the filter's call
   (`Place.defaultFilter` above).

A row's identity `Match` names **one** source. Where it matches several —
`Match.file('src/string.ts')` matches the module *and* everything declared in
that file — the row is the container (an entrypoint, else a module or
namespace), and the file-mates are simply reached by the tree. Naming a row
also revives it if a filter or `export *` flattening dropped it, which is what
lets a module the export graph erased host a page again.

This site is built with a `Page.roots` tree — see `lickle.ts` in the
repository root for the real thing, including a nested `nav` that gathers 55
presentational components onto one inlined page.

## The outline: the site as a list

`Outline.of` states one level of the same thing — an ordered list of sections,
each saying what is in it, in what order, and how deep it goes:

```ts
import { defineConfig, Place, Match, Outline } from '@lickle/docs/config'

export default defineConfig({
  name: 'My Library',
  layout: Place.compose(
    Place.defaultFilter,
    Outline.of(
      { name: 'Guides', include: Match.file('docs/guides/**'), order: ['Getting started'] },
      { name: 'API', include: Match.isEntry(), depth: 2, beyond: 'inline' },
      { name: 'components', include: Match.tag('@group', 'components') },
      { name: 'types', include: Match.kinds('interface', 'type-alias'), nav: false },
      { name: /.+/ },
    ),
  ),
})
```

The list order is the sidebar order. Within it, **the first section to match a
source claims it** — the opposite of `Place.compose`'s "later layers win", and
the natural reading of an ordered list — so write the specific sections first
and the catch-alls last.

| Field | Says |
| --- | --- |
| `name` | the heading; omit it for the unheaded lead run |
| `include` | what belongs here (a `Match`) |
| `order` | the running order inside the section |
| `folder` | nest the entries in a collapsible folder rather than under a heading; the folder takes the section's position, so its contents keep their own order |
| `into` | render the entries on the page of the declaration this `Match` names, instead of one page each |
| `depth` | how many levels of the tree stay navigable |
| `beyond` | what happens past `depth` — `'nav'`, `'inline'` or `'hidden'` |
| `render` | `'page'`, `'inline'` or `'hidden'` for the entries themselves |
| `nav` | `false` keeps the pages, drops the sidebar rows |
| `qualify` | whether nested labels read `Reflect.Module` or `Module` |
| `layers` | any `Place` layer, scoped to this section |

A section with no `include` is a **placeholder**: it claims nothing and only
positions a bucket some other layer assigned. A bare string is the same thing,
which is what keeps a list of them a list:

```ts
Place.compose(
  // One layer decides every bucket: an explicit `@group`, else the kind.
  Place.bucket(Select.first(Select.tag('@group'), Select.kind)),
  Outline.of(
    { name: 'API', include: Match.isEntry() },
    'providers', 'hooks', 'utilities',  // position only — the layer above named them
    { name: /.+/ },                     // then everything else
  ),
)
```

Writing those as `{ name: 'hooks', include: Match.tag('@group', 'hooks') }` says
the same thing twice and leaves two places to keep in step. Let one layer assign
the buckets and let the outline order them.

### A section on one page

`folder` gives a section a collapsible sidebar branch; `into` gives it a **page**
— the declaration it names hosts the entries, rendered in full rather than
linked:

```ts
Outline.of(
  { name: 'primitives', include: Match.tag('@group', 'primitives'), into: Match.file('src/ui/primitives/index.ts') },
)
```

That is one sidebar row and one screen instead of fifty rows and fifty pages.
The host is revived if the export graph flattened it away — `export * from
'./primitives'` leaves the module itself unexposed — but *where the host sits* is
still yours to say, with a `Place.into` after the outline:

```ts
Place.into(Match.file('src/ui/primitives/index.ts'), Match.entry('ui')),
```

Nothing is hidden behind this. Each field compiles to the presets below — the
claim to a bucket, the list order to `Place.bucketOrder`, `depth` to
`Place.depth`, the rest into a `Place.within` scope — and `ldocs why` names the
claiming section rather than an anonymous layer. An outline *is* a `Layout`, so
it composes with layers before it (a `Place.bucket` fallback) and after it (a
one-off override).

A section's `depth` and `qualify` reach its whole subtree, but only what that
section actually **claimed** and the descendants of those. A broad `include`
therefore doesn't reach into a later section's territory: `{ include:
Match.isEntry(), depth: 2 }` governs the entrypoints it claimed, not every
declaration that happens to sit under an entrypoint.

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
Place.hide(Match.tag('@deprecated'))

// Keeps its page, drops the sidebar row.
Place.visibility(Match.kinds('type-alias'), { nav: false })
```

`Place.visibility` is the primitive behind both. It asks two independent
questions — `render` (`'page'`, `'inline'` or `'hidden'`) and `nav` — and an
omitted one is left as the layers below decided it, so `{ nav: false }` drops a
row without promoting an inlined declaration back to a page.

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

A folder can also be given a position of its own. Without one it has no rank and
borrows its earliest child's — right when the contents should decide, wrong when
the folder belongs somewhere specific:

```ts
Place.folder(Match.file('docs/**'), 'Guides', { order: [0, 0] })
```

A folder is synthetic — it exists only in the sidebar. When the parent should be
a **real** declaration with a page of its own, name it with a `Match` instead:

```ts
Place.into(Match.tag('@group', 'primitives'), Match.file('src/ui/primitives/index.ts'))
Place.into(Match.kinds('interface'), Match.entry('config'))
```

`Place.into` resolves the target once against the reflection index and takes the
first match, so narrow it to one declaration. Note `Match.entry` rather than
`Match.name` for an entrypoint: a module's intrinsic name comes from its
declaration and a file has none, so every entrypoint answers to `'unknown'` —
the label the config gave it is the only handle that works.

Two things follow from moving a node this way. Its parent's page lists it, even
though the export graph never said so — placement decides where documentation
*lives*, exposure decides what a module *links to*. And a node set to
`render: 'inline'` renders on the parent its placement names, once, rather than
on every module that happens to re-export it.

The parent has to survive the filter to be a parent at all. `export * from
'./primitives'` flattens the members into the entrypoint and leaves the module
unexposed, so `defaultFilter` drops it — `Place.keep` brings it back:

```ts
Place.compose(
  Place.defaultFilter,
  Place.keep(Match.file('src/ui/primitives/index.ts')),
  Place.into(Match.file('src/ui/primitives/index.ts'), Match.entry('ui')),
  Place.into(Match.tag('@group', 'primitives'), Match.file('src/ui/primitives/index.ts')),
)
```

That is the whole recipe for "give this flattened module a page and put its
members on it". Anywhere a preset takes a string it also takes a `Select`, so
the folder can be derived. `Select.dir` mirrors the source tree, optionally truncated:

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

### How a position is actually stored

An order is a **rank**: a number, or a tuple compared element-wise with a
missing element reading as `0` — so `2`, `[2]` and `[2, 0]` are the same rank.
The tuple exists so composite keys stay composite. "Third entry in `pages`,
second file within it" is `[0, 3, 2]`: two levels, no arithmetic, and no way for
a large frontmatter `order:` to spill into the next entry's range.

The leading element is a **band**, which is how unrelated schemes stay out of
each other's way:

| Band | Holds |
| --- | --- |
| `0` | content positioned deliberately — pages the config listed, anything `Place.order` pins |
| `1` | entrypoint modules the scan discovered |

That is why entrypoints trail your hand-written pages by default, and why
`Place.order` outranks them without needing a large number. Ties fall back to
alphabetical, so siblings are stable rather than arbitrary.

## Names and URLs

```ts
Place.rename(Match.name('UserConfig'), 'Config')   // sidebar label + page title
Place.slug(Match.name('defineConfig'), 'config')   // URL segment only
Place.rename(Match.all(), Select.tag('@name'))     // derive from a doc tag
```

A `Select` returning `undefined` means "no opinion", so the layer leaves that
declaration alone.

### Qualified labels

A declaration nested inside a namespace shows a qualified label in the sidebar —
`Reflect.Module`, not `Module` — because the bare name means little away from its
container. Which levels contribute a prefix is a placement decision, so it is a
layer:

```ts
Place.qualify(Match.all(), false)                                  // flat labels everywhere
Place.qualify(Match.all(Match.isEntry(), Match.name('client')))    // …or one more level
```

The default is "every namespace and nested module qualifies; entrypoints don't",
since an entrypoint's members *are* the public surface and read better bare. Note
this targets the **container**: a node's label is qualified when an ancestor
qualifies, so `Place.qualify` names the level that lends the prefix, not the one
that shows it.

In an outline it is one field per section:

```ts
Outline.of({ name: 'API', include: Match.isEntry(), qualify: false })
```

## Pages, or inline

A declaration either earns a route of its own or reads in place on its parent's
page. `Place.inline` moves it in place; `Place.hide` drops the page while keeping
it resolvable for `{@link}`:

```ts
Place.inline(Match.tag('@inline'))
Place.hide(Match.tag('@deprecated'))
```

Stating the *rule* rather than the exceptions reads better in the other
direction — which declarations deserve a page, with everything else inline:

```ts
Place.pagesFor(Match.bucket('components', 'hooks'))
```

`Place.pagesFor` is the positive form of `Place.inline(Match.not(…))`, minus its
two traps: standalone pages are never touched, and containers (modules and
namespaces) keep their pages, since they are what the inlined members render
*on*. Inline a container deliberately if that is what you mean:

```ts
Place.inline(Match.all(Match.kinds('module'), Match.members({ max: 2 })))
```

### How deep

`Place.depth` cuts by **exposure depth** — re-export hops from an entrypoint, the
same number the sidebar nests by. An entrypoint is `0`, what it exports is `1`, a
member of a namespace it exports is `2`:

```ts
Place.depth(1)                          // entrypoints and their members, nothing deeper
Place.depth(2, { beyond: 'inline' })    // …and level 3 reads on the page above it
Place.depth(2, { beyond: 'hidden' })    // …or not at all
```

`beyond` says what happens past the cut:

| `beyond` | Past the cut |
| --- | --- |
| `'nav'` *(default)* | keeps its page, loses its sidebar row — the parent page still links to it |
| `'inline'` | leaves render on their parent's page; containers keep a page, since inlining one would strand its members |
| `'hidden'` | no route at all, still resolvable for `{@link}` |

Depth is ordinary data, not a special case, so it is available wherever a
predicate or a value is:

```ts
Match.depth({ min: 3 })                             // as a predicate
Select.depth()                                      // as a number
Place.bucket(Match.depth({ min: 2 }), 'Internals')  // …and so as a bucket
```

In an outline it is `depth` and `beyond` per section, which is where it usually
belongs: the API section expands two levels, the guides are flat anyway.

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

## Rules for part of the site

`Place.within` scopes layers to a subset, so a predicate written once covers all
of them. Everything outside the scope passes through untouched:

```ts
Place.within(
  Match.any(Match.name('experimental'), Match.under(Match.name('experimental'))),
  Place.folder(Match.all(), 'Advanced'),
  Place.depth(1),
)
```

`Match.under` matches everything exposed *beneath* a container, at any depth —
the piece that turns "this entrypoint" into "this entrypoint's subtree". Inside
a scope the set is already narrowed, so `Match.all()` — the unit of a
conjunction, and so a match for every source including markdown pages — is the
natural inner match.

An outline's sections are exactly this, named: section rules go through a
`Place.within` scope, and `depth` and `qualify` are scoped to the whole subtree
rather than to the entries alone.

When a decision needs arbitrary code but not a whole hand-written `Layout`,
`Place.map` hands you the `Place` and takes one back:

```ts
Place.map(Match.file('docs/guides/**'), (place, source) => ({
  ...place,
  order: Number(source.kind === 'doc' ? 0 : (source.file?.match(/(\d+)-/)?.[1] ?? 0)),
}))
```

## Decisions that need the whole set

Layers see one source at a time by design — though "one source" includes what the
export graph says about it, so several decisions that look global are not:
`Match.members({ max: 2 })` finds thin containers and `Match.depth` finds the deep
tail without a whole-set pass.

When a decision really does depend on everything else — "inline any *section*
with fewer than three members" — use `refine`, which runs once with every
placement in hand, before slugs are computed:

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

Slug collisions are reported as warnings, and every colliding declaration falls
back to its source path so the outcome doesn't depend on scan order. Because
that quietly rewrites URLs, a project that cares about stable links should make
it fatal:

```bash
npx ldocs generate --strict
```
