/**
 * An interactive tour of the layout combinators.
 *
 * The real thing runs over a TypeScript program, which the browser has no way
 * to compile. So this page runs the *actual* layout engine — `buildTree`, the
 * same function the build calls — over a small hand-built corpus of
 * declarations. Every combinator behaves exactly as it would on real code; only
 * the input is synthetic.
 *
 * Imports reach into `../src` rather than `@lickle/docs/config` so the demo
 * always reflects this checkout's source instead of a published build. In your
 * own project the algebra comes from `@lickle/docs/config`.
 */

import { transform } from 'sucrase'

import * as Place from '../../src/core/layout/layout/place.ts'
import * as Match from '../../src/core/layout/layout/match.ts'
import * as Select from '../../src/core/layout/layout/select.ts'
import { buildTree } from '../../src/core/layout/tree.ts'
import type { DeclarationFacade } from '../../src/core/layout/facade.ts'
import type { GroupedItems, Layout, PageSource, SidebarNode, ContentSource } from '../../src/core/layout/types.ts'
import type * as Reflect from '../../src/core/reflect/index.ts'

// ─────────────────────────────────────────────────────────────────────────
// The corpus
// ─────────────────────────────────────────────────────────────────────────

/** One synthetic declaration, in the shape the presets actually read. */
type Spec = {
  name: string
  kind: Reflect.Declaration['kind']
  file: string
  /** Doc tags, e.g. `{ '@group': 'hooks' }`. */
  tags?: Record<string, string>
  /** Return type name, for the structural `Match.kind` demo. */
  returns?: string
  /** Left out of the export graph, so `Match.exposed()` rejects it. */
  unexposed?: boolean
}

const MODULE_ID = 1

export const SPECS: Spec[] = [
  { name: 'defineConfig', kind: 'function', file: 'src/config.ts' },
  { name: 'defineComponents', kind: 'function', file: 'src/ui/define.ts' },
  { name: 'Button', kind: 'function', file: 'src/ui/Button.tsx', returns: 'Element' },
  { name: 'Card', kind: 'function', file: 'src/ui/Card.tsx', returns: 'Element' },
  { name: 'useTheme', kind: 'function', file: 'src/hooks/useTheme.ts', tags: { '@group': 'hooks' } },
  { name: 'usePages', kind: 'function', file: 'src/hooks/usePages.ts', tags: { '@group': 'hooks' } },
  { name: 'Config', kind: 'interface', file: 'src/config.ts' },
  { name: 'Theme', kind: 'type-alias', file: 'src/theme.ts' },
  { name: 'debugOnly', kind: 'function', file: 'src/internal.ts', unexposed: true },
  { name: 'legacyApi', kind: 'function', file: 'src/legacy.ts', tags: { '@internal': '' } },
]

/** The entry module every declaration hangs off. */
const MODULE: Spec = { name: 'my-library', kind: 'module', file: 'src/index.ts' }

const specById = new Map<number, Spec>([[MODULE_ID, MODULE]])
SPECS.forEach((s, i) => specById.set(MODULE_ID + 1 + i, s))

/** Raw reflection data — only the fields the combinators inspect. */
const rawOf = (id: number, spec: Spec): Record<string, unknown> => ({
  id,
  name: spec.name,
  kind: spec.kind,
  parent: id === MODULE_ID ? 0 : MODULE_ID,
  path: spec.kind === 'module' ? spec.file : undefined,
  sources: [{ file: spec.file, line: 1, column: 1 }],
  // `Match.kind('function', { signatures: { return: { reference: … } } })`
  // walks this, so it has to be a real `reference` type node.
  ...(spec.returns ? { signatures: [{ kind: 'signature', return: { kind: 'reference', name: spec.returns } }] } : {}),
})

const facadeOf = (id: number, spec: Spec): DeclarationFacade => {
  const exposed = id === MODULE_ID || !spec.unexposed
  const entry = id === MODULE_ID ? { as: '.', index: 0 } : undefined
  const self = {
    id,
    name: spec.name,
    kind: spec.kind,
    raw: rawOf(id, spec),
    tags: new Map(Object.entries(spec.tags ?? {}).map(([tag, text]) => [tag, { tag, kind: tag, text }])),
    isEntry: () => id === MODULE_ID,
    entryIndex: () => (id === MODULE_ID ? 0 : undefined),
    entry: () => entry,
    alias: () => undefined,
    parent: () => (id === MODULE_ID ? undefined : facades.get(MODULE_ID)),
    members: () => (id === MODULE_ID ? [...facades.values()].filter((f) => f.id !== MODULE_ID) : []),
    referenced: () => [],
    get: (other: number) => facades.get(other),
    exposure: {
      is: () => exposed,
      parents: () => (exposed && id !== MODULE_ID ? [facades.get(MODULE_ID)] : []),
      ancestors: () => [],
      children: () => (id === MODULE_ID ? [...facades.values()].filter((f) => f.id !== MODULE_ID) : []),
      root: () => (id === MODULE_ID ? [] : [facades.get(MODULE_ID)]),
    },
  }
  return self as unknown as DeclarationFacade
}

const facades = new Map<number, DeclarationFacade>()
for (const [id, spec] of specById) facades.set(id, facadeOf(id, spec))

/** The slice of `Reflect.Index` the default layout and the fallbacks consult. */
const index = {
  get: (id: number) => (id === 0 ? undefined : rawOf(id, specById.get(id)!)),
  isRoot: (id: number) => id === MODULE_ID,
  rootIndex: (id: number) => (id === MODULE_ID ? 0 : undefined),
  rootAlias: (id: number) => (id === MODULE_ID ? { as: '.', index: 0 } : undefined),
  roots: () => [],
  commonDir: () => 'src',
  languages: () => [],
  children: () => [],
  declarations: () => [],
  referencedIn: () => [],
  isExposed: (id: number) => id === MODULE_ID || !specById.get(id)?.unexposed,
  exposures: () => [],
  exposes: () => [],
  // The one the default layout actually reads: who re-exports this declaration.
  exposedBy: (id: number) =>
    id === MODULE_ID || specById.get(id)?.unexposed ? [] : [{ exposer: MODULE_ID, alias: specById.get(id)!.name }],
} as unknown as Reflect.Index

const PAGES: ContentSource[] = [
  { kind: 'markdown', title: 'Overview', slug: '/', content: '# Overview', file: 'README.md', order: 0 },
  { kind: 'markdown', title: 'Getting started', content: '# Getting started', file: 'docs/start.md', order: 1 },
]

const SOURCES: PageSource[] = [...PAGES, ...[...facades.values()].map((decl): PageSource => ({ kind: 'doc', decl }))]

// ─────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT = `Place.compose(
  Place.defaultFilter,
  Place.bucket(Select.kind),
)`

export const PRESETS: { name: string; blurb: string; code: string }[] = [
  {
    name: 'Default',
    blurb: 'What you get with no layout at all: drop what the API does not expose, bucket the rest by kind.',
    code: DEFAULT_LAYOUT,
  },
  {
    name: 'Group by tag',
    blurb: '`@group hooks` wins over the kind bucket, because a later layer overrides an earlier one.',
    code: `Place.compose(
  Place.defaultFilter,
  Place.bucket(Select.kind),
  Place.bucket(Select.tag('@group')),
)`,
  },
  {
    name: 'Components section',
    blurb: 'A structural match finds every function returning an `Element` — no tagging required.',
    code: `Place.compose(
  Place.defaultFilter,
  Place.bucket(Select.kind),
  Place.bucket(
    Match.kind('function', { signatures: { return: { reference: { name: 'Element' } } } }),
    'components',
  ),
  Place.bucketOrder('components', /.*/),
)`,
  },
  {
    name: 'Folders for types',
    blurb: 'A folder is a collapsible branch; the types move out of the flat list into one.',
    code: `Place.compose(
  Place.defaultFilter,
  Place.bucket(Select.kind),
  Place.folder(Match.kinds('interface', 'type-alias'), 'Types'),
)`,
  },
  {
    name: 'Mirror the source tree',
    blurb: "`Select.dir()` derives each folder from the declaration's own directory.",
    code: `Place.compose(
  Place.defaultFilter,
  Place.folder(Match.all(), Select.dir()),
)`,
  },
  {
    name: 'Inline the small stuff',
    blurb: 'Anything outside the hooks bucket renders on its parent instead of getting a page of its own.',
    code: `Place.compose(
  Place.defaultFilter,
  Place.bucket(Select.kind),
  Place.bucket(Select.tag('@group')),
  Place.visibility(Match.not(Match.bucket('hooks')), { inline: true }),
)`,
  },
  {
    name: 'Rename and order',
    blurb: 'Pin the guides above everything generated, and give a declaration a friendlier label.',
    code: `Place.compose(
  Place.defaultFilter,
  Place.bucket(Select.kind),
  Place.order(Match.page(), /.*/),
  Place.rename(Match.name('defineConfig'), 'Configuration'),
)`,
  },
  {
    name: 'Document internals',
    blurb: 'Leave `defaultFilter` out and nothing is dropped — `debugOnly` and `legacyApi` appear.',
    code: `Place.compose(
  Place.bucket(Select.kind),
)`,
  },
]

// ─────────────────────────────────────────────────────────────────────────
// Running it
// ─────────────────────────────────────────────────────────────────────────

export type Result = {
  sidebar: GroupedItems<SidebarNode>[]
  slugs: Map<number, string>
  pages: number
  warnings: string[]
}

/**
 * Compile the editor's expression to a {@link Layout} and run the real tree
 * builder over the corpus.
 *
 * The source is wrapped in a `const` so sucrase sees a whole program — that way
 * a typed arrow (`(d: DeclarationFacade) => …`) compiles like it would in a
 * config file, rather than being a syntax error.
 */
export const run = (source: string): Result => {
  const js = transform(`const __layout = (\n${source}\n)`, { transforms: ['typescript'] }).code
  const layout = new Function('Place', 'Match', 'Select', `${js}\nreturn __layout`)(Place, Match, Select) as Layout
  if (typeof layout !== 'function') throw new Error('Expected a Layout — did you forget `Place.compose(...)`?')

  const warnings: string[] = []
  const tree = buildTree(SOURCES, layout, { docs: index, name: 'my-library' }, (d) => warnings.push(d.message))
  const pages = tree.resolved.filter((r) => (r.placement.page?.render ?? 'page') === 'page').length
  return { sidebar: tree.sidebar, slugs: tree.slugOf, pages, warnings }
}
