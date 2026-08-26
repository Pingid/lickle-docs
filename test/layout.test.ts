import { expect, it, describe } from 'vitest'

import { Match, Select, Place, Outline } from '../src/core/layout/layout/index.ts'
import { effectiveNav, buildTree } from '../src/core/layout/tree.ts'
import { compareRank, minRank } from '../src/core/layout/client.ts'
import type { DeclarationFacade } from '../src/core/layout/facade.ts'
import type {
  Layout,
  Placement,
  PageSource,
  ContentSource,
  SidebarNode,
  GroupedItems,
  TraceEntry,
} from '../src/core/layout/types.ts'
import type * as Reflect from '../src/core/reflect/index.ts'

/**
 * A minimal declaration facade — just the fields the matchers/presets read.
 *
 * Ids are handed out fresh, because the scanner guarantees they are unique and
 * layers are entitled to cache on them: `Outline.of` keys its claim decision by
 * id so the bucket it assigns and the scope checks that read it back can't
 * disagree. Reusing an id here would make two different fixtures look like the
 * same declaration.
 */
let nextId = 0
const facade = (over: Partial<DeclarationFacade> & { raw?: any } = {}): DeclarationFacade =>
  ({
    id: ++nextId as Reflect.Id,
    name: 'Foo',
    kind: 'function',
    raw: { kind: 'function', name: 'Foo', sources: [{ file: 'src/foo.ts' }] },
    tags: new Map(),
    isEntry: () => false,
    exposure: { is: () => true, ancestors: () => [], children: () => [] },
    ...over,
  }) as unknown as DeclarationFacade

/** The corpus-aware half of the context; the presets under test never read it. */
const cx = { index: {} as Reflect.Index, name: 'test' }

/** Run a layout for a doc source whose lower layers produced `base`. */
const run = (layout: Layout, decl: DeclarationFacade, base: Placement): Placement => {
  const source: PageSource = { kind: 'doc', decl }
  return layout(source, { ...cx, default: () => base }) ?? base
}

/** Run a layout for a standalone page source. */
const runPage = (layout: Layout, source: ContentSource, base: Placement): Placement =>
  layout(source, { ...cx, default: () => base }) ?? base

/** A page at root. */
const page = (name = 'Foo'): Placement => ({ page: { parent: { root: true }, name } })

describe('Match algebra', () => {
  const d = facade({ name: 'Foo', kind: 'function' })

  it('all/any/not combine predicates', () => {
    expect(Match.all(Match.name('Foo'), Match.kinds('function'))(d)).toBe(true)
    expect(Match.all(Match.name('Foo'), Match.kinds('variable'))(d)).toBe(false)
    expect(Match.any(Match.name('Bar'), Match.kinds('function'))(d)).toBe(true)
    expect(Match.not(Match.name('Bar'))(d)).toBe(true)
    expect(Match.not(Match.name('Foo'), Match.kinds('variable'))(d)).toBe(false) // none-of: Foo matches
    expect(Match.all()(d)).toBe(true) // unit: always
    expect(Match.any()(d)).toBe(false) // unit: never
  })

  it('selectors read the facade', () => {
    expect(Match.name('Foo')(d)).toBe(true)
    expect(Match.name(/^F/)(d)).toBe(true)
    expect(Match.kinds('interface', 'type-alias')(d)).toBe(false)
    expect(Match.tag('@internal')(facade({ tags: new Map([['@internal', {} as Reflect.CommentTag]]) }))).toBe(true)
    expect(
      Match.tag('@group', 'hooks')(facade({ tags: new Map([['@group', { text: 'hooks' } as Reflect.CommentTag]]) })),
    ).toBe(true)
    expect(Match.exposed()(facade({ exposure: { is: () => false } as DeclarationFacade['exposure'] }))).toBe(false)
    expect(Match.isEntry()(facade({ isEntry: () => true }))).toBe(true)
  })

  it('kind matches a structural pattern over the raw shape', () => {
    const component = facade({
      kind: 'function',
      raw: { kind: 'function', name: 'Foo', signatures: [{ return: { kind: 'reference', name: 'Element' } }] },
    })
    const plain = facade({
      kind: 'function',
      raw: { kind: 'function', signatures: [{ return: { kind: 'reference', name: 'Other' } }] },
    })
    const m = Match.kind('function', { signatures: { return: { reference: { name: 'Element' } } } })
    expect(m(component)).toBe(true)
    expect(m(plain)).toBe(false)
    expect(m(facade({ kind: 'variable' }))).toBe(false) // wrong kind
    expect(Match.kind('function', { name: (n) => n.startsWith('F') })(component)).toBe(true) // leaf predicate
  })

  it('bucket reads the node’s canonical Place.group', () => {
    const inBucket = (group: string | undefined): Placement => ({ page: { parent: { root: true }, name: 'Foo', group: group ? { name: group } : undefined } })
    expect(Match.bucket('components')(d, inBucket('components'))).toBe(true)
    expect(Match.bucket('components', 'hooks')(d, inBucket('hooks'))).toBe(true)
    expect(Match.bucket('components')(d, inBucket('types'))).toBe(false)
    expect(Match.bucket(null)(d, inBucket(undefined))).toBe(true) // null = unbucketed
    expect(Match.bucket(null)(d, inBucket('components'))).toBe(false)
    expect(Match.bucket('components')(d)).toBe(false) // no placement → no match
  })
})

describe('Select', () => {
  it('kind yields the plural label, or "" for entrypoints', () => {
    expect(Select.kind(facade({ kind: 'function' }))).toBe('functions')
    expect(Select.kind(facade({ kind: 'interface' }))).toBe('interfaces')
    expect(Select.kind(facade({ isEntry: () => true, kind: 'module' }))).toBe('')
  })

  it('tag yields the tag text, else undefined', () => {
    const tagged = facade({ tags: new Map([['@group', { text: 'hooks' } as Reflect.CommentTag]]) })
    expect(Select.tag('@group')(tagged)).toBe('hooks')
    expect(Select.tag('@group')(facade())).toBeUndefined()
    expect(Select.tag('@group', (t) => t.toUpperCase())(tagged)).toBe('HOOKS')
  })
})

describe('Place.bucket', () => {
  const d = facade({ name: 'Foo', kind: 'function' })

  it('Select form sets the node’s Place.group; undefined leaves it untouched', () => {
    expect(run(Place.bucket(Select.kind), d, page()).page?.group?.name).toBe('functions')
    expect(run(Place.bucket(Select.tag('@group')), d, page()).page?.group).toBeUndefined() // no-op
  })

  it('Match form assigns a fixed bucket to matches, passes others through', () => {
    expect(run(Place.bucket(Match.kinds('function'), 'fns'), d, page()).page?.group?.name).toBe('fns')
    expect(run(Place.bucket(Match.kinds('interface'), 'types'), d, page()).page?.group).toBeUndefined()
  })

  it('a later bucket wins (compose: last is outermost)', () => {
    const layout = Place.compose(Place.bucket(Match.all(), 'a'), Place.bucket(Match.all(), 'b'))
    expect(run(layout, d, page()).page?.group?.name).toBe('b')
  })
})

describe('Place.bucketOrder', () => {
  it('orders buckets by name position, with a regex catch-all', () => {
    const d = facade({ kind: 'function' })
    const layout = Place.compose(Place.bucket(Select.kind), Place.bucketOrder('components', 'hooks', 'types', /.+/))
    // 'functions' is unlisted, so the catch-all at index 3 applies
    expect(run(layout, d, page()).page?.group).toEqual({ name: 'functions', order: 3 })

    const types = facade({ kind: 'interface' })
    const layout2 = Place.compose(Place.bucket(Match.kinds('interface'), 'types'), Place.bucketOrder('components', 'types'))
    expect(run(layout2, types, page()).page?.group?.order).toBe(1)
  })
})

describe('Place.filter', () => {
  it('excludes docs the predicate rejects', () => {
    const keepFns = Place.filter(Match.kinds('function'))
    expect(run(keepFns, facade({ kind: 'function' }), page())).toEqual(page()) // kept
    expect(run(keepFns, facade({ kind: 'variable' }), page())).toEqual({ page: null }) // excluded
  })
})

describe('effectiveNav propagation', () => {
  it('derived nav inherits the page’s group/order', () => {
    const p: Placement = { page: { parent: { root: true }, name: 'Foo', group: { name: 'fns', order: 2 }, order: 5 } }
    expect(effectiveNav(p)).toEqual([{ parent: { root: true }, name: 'Foo', group: { name: 'fns', order: 2 }, order: 5 }])
  })

  it('explicit nav inherits when absent, keeps its own when set', () => {
    const place = { parent: { root: true }, name: 'Foo', group: { name: 'fns' }, order: 5 }
    const p: Placement = {
      page: place,
      nav: [
        { parent: { decl: 1 as Reflect.Id }, name: 'Foo' }, // inherits
        { parent: { decl: 2 as Reflect.Id }, name: 'Foo', group: { name: 'special' }, order: 0 }, // overrides
      ],
    }
    const [inherited, overridden] = effectiveNav(p)
    expect(inherited).toMatchObject({ group: { name: 'fns' }, order: 5 })
    expect(overridden).toMatchObject({ group: { name: 'special' }, order: 0 })
  })
})

// ─────────────────────────────────────────────────────────────────────────
// A page source, for the preset behaviour that treats pages differently
// ─────────────────────────────────────────────────────────────────────────

const mdPage = (over: Partial<ContentSource> = {}): ContentSource =>
  ({ kind: 'markdown', title: 'Guide', content: '# Guide', file: 'docs/guide.md', ...over }) as ContentSource

describe('Place.bucket dispatch', () => {
  const d = facade({ name: 'Foo', kind: 'function' })

  // Regression: the two forms used to be told apart by a runtime brand that the
  // type system never required, so an unbranded lambda silently took the Match
  // branch and produced a bucket named `undefined`.
  it('treats an unbranded lambda as a Select, not a Match', () => {
    const layout = Place.bucket((decl) => (decl.kind === 'function' ? 'widgets' : undefined))
    expect(run(layout, d, page()).page?.group?.name).toBe('widgets')
    expect(run(layout, facade({ kind: 'interface' }), page()).page?.group).toBeUndefined()
  })

  it('still takes the Match branch when a name is supplied', () => {
    expect(run(Place.bucket(Match.kinds('function'), 'fns'), d, page()).page?.group?.name).toBe('fns')
  })

  it('accepts a Select in the name position', () => {
    const layout = Place.bucket(Match.all(), Select.kind)
    expect(run(layout, d, page()).page?.group?.name).toBe('functions')
  })
})

describe('Place.order', () => {
  it('orders by the index of the first matching name, regex or Match', () => {
    const layout = Place.order('Alpha', /^B/, Match.kinds('interface'))
    // Band 0 — content positioned deliberately — then the index within it.
    expect(run(layout, facade({ name: 'Alpha' }), page('Alpha')).page?.order).toEqual([0, 0])
    expect(run(layout, facade({ name: 'Beta' }), page('Beta')).page?.order).toEqual([0, 1])
    expect(run(layout, facade({ kind: 'interface' }), page('Zeta')).page?.order).toEqual([0, 2])
    expect(run(layout, facade({ name: 'Zeta' }), page('Zeta')).page?.order).toBeUndefined()
  })

  it('orders standalone pages too, so a guide can outrank generated entries', () => {
    const layout = Place.order(Match.page(), /.*/)
    expect(runPage(layout, mdPage(), page('Guide')).page?.order).toEqual([0, 0])
    expect(run(layout, facade({ name: 'Foo' }), page('Foo')).page?.order).toEqual([0, 1])
  })
})

describe('Select values in placement presets', () => {
  it('rename and folder accept a Select', () => {
    const tagged = facade({ tags: new Map([['@group', { text: 'hooks' } as Reflect.CommentTag]]) })
    expect(run(Place.rename(Match.all(), Select.tag('@group')), tagged, page()).page?.name).toBe('hooks')
    expect(run(Place.folder(Match.all(), Select.tag('@group')), tagged, page()).page?.parent).toEqual({
      virtual: 'hooks',
    })
  })

  it('an undefined Select result leaves the field alone', () => {
    expect(run(Place.rename(Match.all(), Select.tag('@group')), facade(), page('Foo')).page?.name).toBe('Foo')
    expect(run(Place.folder(Match.all(), Select.tag('@group')), facade(), page()).page?.parent).toEqual({ root: true })
  })

  it('Select.dir derives the source directory, depth-limited', () => {
    const d = facade({ raw: { sources: [{ file: 'src/core/layout/place.ts' }] } as any })
    expect(Select.dir()(d)).toBe('src/core/layout')
    expect(Select.dir({ depth: 2 })(d)).toBe('src/core')
    expect(Select.dir()(facade({ raw: { sources: [{ file: 'index.ts' }] } as any }))).toBeUndefined()
  })

  it('Select.first returns the first defined result', () => {
    const tagged = facade({ kind: 'function', tags: new Map([['@group', { text: 'hooks' } as Reflect.CommentTag]]) })
    const sel = Select.first(Select.tag('@group'), Select.kind)
    expect(sel(tagged)).toBe('hooks')
    expect(sel(facade({ kind: 'function' }))).toBe('functions')
  })
})

describe('page-aware matching', () => {
  it('a declaration-only match never touches a standalone page', () => {
    const layout = Place.folder(Match.kinds('function'), 'fns')
    expect(runPage(layout, mdPage(), page('Guide')).page?.parent).toEqual({ root: true })
  })

  it('Match.page reaches pages and never declarations', () => {
    const layout = Place.folder(Match.page(), 'Guides')
    expect(runPage(layout, mdPage(), page('Guide')).page?.parent).toEqual({ virtual: 'Guides' })
    expect(run(layout, facade(), page()).page?.parent).toEqual({ root: true })
  })

  it('Match.page narrows by kind, folder and predicate', () => {
    expect(Match.page({ kind: 'component' }).page!(mdPage())).toBe(false)
    expect(Match.page({ kind: 'markdown' }).page!(mdPage())).toBe(true)
    expect(Match.page({ folder: 'guides' }).page!(mdPage({ folder: 'guides' }))).toBe(true)
    expect(Match.page({ where: (p) => p.title === 'Guide' }).page!(mdPage())).toBe(true)
  })

  it('Match.file globs a page’s own source file', () => {
    expect(Match.file('docs/**').page!(mdPage())).toBe(true)
    expect(Match.file('src/**').page!(mdPage())).toBe(false)
  })

  it('combinators propagate the page aspect only when a child has one', () => {
    expect(Match.all(Match.kinds('function')).page).toBeUndefined() // declaration-only
    // A page is not a function, so `all` is false even though `page()` matches.
    expect(Match.all(Match.kinds('function'), Match.page()).page!(mdPage())).toBe(false)
    expect(Match.any(Match.kinds('function'), Match.page()).page!(mdPage())).toBe(true)
    expect(Match.not(Match.page({ kind: 'component' })).page!(mdPage())).toBe(true)
  })

  it('Place.filter drops pages only when the predicate mentions them', () => {
    expect(runPage(Place.filter(Match.kinds('function')), mdPage(), page('Guide'))).toEqual(page('Guide'))
    expect(runPage(Place.filter(Match.not(Match.page())), mdPage(), page('Guide'))).toEqual({ page: null })
  })
})

describe('Place.compose tracing', () => {
  it('reports each layer that changed the placement', () => {
    const trace: { layer: string }[] = []
    const layout = Place.compose(Place.bucket(Select.kind), Place.bucketOrder('functions'), Place.rename(Match.name('nope'), 'x'))
    layout({ kind: 'doc', decl: facade({ kind: 'function' }) }, { ...cx, default: () => page(), trace: (e) => trace.push(e) })
    // The `rename` layer matched nothing, so it never appears.
    expect(trace.map((t) => t.layer)).toEqual(['Place.bucket', 'Place.bucketOrder'])
  })

  it('a transparent scope reports its layers, not itself', () => {
    // `Place.within` is a scope the config wrote, so the useful attribution is
    // what ran inside it — the wrapper stays out of the trace entirely.
    const trace: TraceEntry[] = []
    const layout = Place.compose(Place.within(Match.all(), Place.bucket(Match.all(), 'a')))
    layout({ kind: 'doc', decl: facade() }, { ...cx, default: () => page(), trace: (e) => trace.push(e) })
    expect(trace.map((t) => t.layer)).toEqual(['Place.bucket'])
  })

  it('an opaque preset reports itself, not its internals', () => {
    // `Place.depth` composes two visibility layers to express one idea; the
    // reader wants the idea.
    const trace: TraceEntry[] = []
    const deep = facade({ exposure: { is: () => true, ancestors: () => [[{}, {}, {}]], children: () => [] } as any })
    Place.compose(Place.depth(1, { beyond: 'inline' }))(
      { kind: 'doc', decl: deep },
      { ...cx, default: () => page(), trace: (e) => trace.push(e) },
    )
    expect(trace.map((t) => t.layer)).toEqual(['Place.depth'])
  })
})

describe('refine — the whole-set pass', () => {
  const sources: PageSource[] = [
    mdPage({ title: 'One', folder: 'guides' }),
    mdPage({ title: 'Two', folder: 'guides' }),
    mdPage({ title: 'Three' }),
  ]
  const baseCx = { docs: {} as Reflect.Index, name: 'test' }

  it('sees every placement at once and can relocate before slugs resolve', () => {
    const { resolved } = buildTree(
      sources,
      Place.compose(),
      baseCx,
      () => {},
      // A decision impossible in a per-source layer: only nodes in a folder
      // that has more than one member keep it.
      (nodes) => {
        const counts = new Map<string, number>()
        for (const n of nodes) {
          const p = n.placement.page?.parent
          if (p && 'virtual' in p) counts.set(p.virtual, (counts.get(p.virtual) ?? 0) + 1)
        }
        return nodes.map((n) => {
          const p = n.placement.page?.parent
          if (!p || !('virtual' in p) || counts.get(p.virtual)! > 1) return n
          return { ...n, placement: { ...n.placement, page: { ...n.placement.page!, parent: { root: true } } } }
        })
      },
    )
    expect(resolved.map((r) => r.slug)).toEqual(['/guides/one', '/guides/two', '/three'])
  })

  it('can exclude a node by nulling its page', () => {
    const { resolved } = buildTree(sources, Place.compose(), baseCx, () => {}, (nodes) =>
      nodes.map((n) => (n.source.kind !== 'doc' && n.source.title === 'Two' ? { ...n, placement: { page: null } } : n)),
    )
    expect(resolved.map((r) => r.slug)).toEqual(['/guides/one', '/three'])
  })
})

describe('slug collisions', () => {
  const decl = (id: number, name: string, kind: any, file: string): PageSource => ({
    kind: 'doc',
    decl: facade({
      id: id as Reflect.Id,
      name,
      kind,
      raw: { kind, name, sources: [{ file }] } as any,
      entryIndex: () => undefined,
    }),
  })
  // Enough of an index for the source-path fallback: `lexicalSegments` walks
  // `get`/`parent` and stops when a parent is missing.
  const stub = (decls: { id: number; name: string; kind: string }[]): Reflect.Index =>
    ({
      get: (id: number) => decls.find((d) => d.id === id && id !== 0),
      isRoot: () => false,
      commonDir: () => '',
      exposedBy: () => [],
      declarations: () => decls,
    }) as unknown as Reflect.Index
  const at = (name: string) => Place.rename(Match.name(name), name)

  it('disambiguates a fallback that still collides, rather than relying on case', () => {
    // `select` (function) and `Select` (type) in one file: both slugify to the
    // same path, so case was the only thing separating them — which is nothing
    // at all on a case-insensitive host.
    const sources = [decl(1, 'select', 'function', 'x.ts'), decl(2, 'Select', 'type-alias', 'x.ts')]
    const baseCx = {
      docs: stub([
        { id: 1, name: 'select', kind: 'function' },
        { id: 2, name: 'Select', kind: 'type-alias' },
      ]),
      name: 'test',
    }
    const warnings: string[] = []
    const { resolved } = buildTree(sources, Place.compose(at('select'), at('Select')), baseCx, (d) =>
      warnings.push(d.code),
    )
    const slugs = resolved.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length) // distinct
    expect(slugs.every((s) => s === s.toLowerCase())).toBe(true) // and lowercase
    expect(warnings.filter((w) => w === 'slug-collision').length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Graph shape: how deep a declaration sits, and what sits under what
// ─────────────────────────────────────────────────────────────────────────

/**
 * A facade at a given exposure depth. `Select.depth` reads chain *length*, so
 * the chain only has to be the right size — except for `Match.under`, which
 * reads the ancestors themselves, so they are real facades.
 */
const atDepth = (n: number, over: Partial<DeclarationFacade> = {}): DeclarationFacade => {
  const chain = Array.from({ length: n }, (_, i) => facade({ name: `ancestor${i}`, kind: 'module' }))
  return facade({
    isEntry: () => n === 0,
    exposure: { is: () => true, ancestors: () => (n === 0 ? [] : [chain]), children: () => [] } as any,
    ...over,
  })
}

describe('exposure depth', () => {
  it('counts re-export hops, entrypoints at zero and the unexposed at nothing', () => {
    expect(Select.depth()(atDepth(0))).toBe(0)
    expect(Select.depth()(atDepth(1))).toBe(1)
    expect(Select.depth()(atDepth(3))).toBe(3)
    expect(Select.depth()(facade())).toBeUndefined() // no chains, not an entrypoint
  })

  it('a declaration reachable by several chains takes the shortest', () => {
    const two = [facade({ name: 'a' }), facade({ name: 'b' })]
    const d = facade({ exposure: { is: () => true, ancestors: () => [two, [two[0]!]] } as any })
    expect(Select.depth()(d)).toBe(1)
  })

  it('Match.depth bounds it, and never matches the unexposed', () => {
    expect(Match.depth({ min: 2 })(atDepth(2))).toBe(true)
    expect(Match.depth({ min: 2 })(atDepth(1))).toBe(false)
    expect(Match.depth({ max: 1 })(atDepth(0))).toBe(true)
    expect(Match.depth({ min: 1, max: 2 })(atDepth(3))).toBe(false)
    expect(Match.depth({ min: 0 })(facade())).toBe(false)
  })

  it('Match.members / Match.leaf count exposed members', () => {
    const container = (n: number) =>
      facade({ kind: 'module', exposure: { is: () => true, children: () => Array.from({ length: n }) } as any })
    expect(Match.members({ max: 2 })(container(2))).toBe(true)
    expect(Match.members({ max: 2 })(container(3))).toBe(false)
    expect(Match.members({ min: 1 })(container(0))).toBe(false)
    expect(Match.leaf()(container(0))).toBe(true)
    expect(Match.leaf()(facade({ kind: 'function' }))).toBe(true) // exposes nothing
  })

  it('Match.under matches anything beneath a matching container', () => {
    const chain = [facade({ name: 'config', kind: 'module' }), facade({ name: 'Place', kind: 'namespace' })]
    const nested = facade({ exposure: { is: () => true, ancestors: () => [chain] } as any })
    expect(Match.under(Match.name('Place'))(nested)).toBe(true)
    expect(Match.under(Match.name('config'))(nested)).toBe(true)
    expect(Match.under(Match.name('ui'))(nested)).toBe(false)
    expect(Match.under(Match.all())(atDepth(0))).toBe(false) // an entrypoint is under nothing
  })

  it('the combinator units are the right units, pages included', () => {
    // `all()` is a conjunction's unit, so it matches everything — including
    // standalone pages, which is what makes it the inner match for a scope.
    expect(Match.all()(facade())).toBe(true)
    expect(Match.all().page!(mdPage())).toBe(true)
    expect(Match.not()(facade())).toBe(true)
    expect(Match.not().page!(mdPage())).toBe(true)
    expect(Match.any()(facade())).toBe(false)
    expect(Match.any().page!(mdPage())).toBe(false)
    // With arguments the old rule stands: a declaration-only child keeps the
    // composite off pages, so markdown is never disturbed by accident.
    expect(Match.all(Match.kinds('function')).page).toBeUndefined()
    expect(Match.all(Match.kinds('function'), Match.page()).page!(mdPage())).toBe(false)
    expect(Match.any(Match.kinds('function'), Match.page()).page!(mdPage())).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Scoping and the render-mode presets
// ─────────────────────────────────────────────────────────────────────────

describe('Place.within', () => {
  it('runs its layers only for sources the scope accepts', () => {
    const layout = Place.within(Match.kinds('function'), Place.bucket(Match.all(), 'scoped'))
    expect(run(layout, facade({ kind: 'function' }), page()).page?.group?.name).toBe('scoped')
    expect(run(layout, facade({ kind: 'interface' }), page()).page?.group).toBeUndefined()
  })

  it('scopes pages by the scope’s page aspect, so a declaration-only scope leaves them alone', () => {
    const declOnly = Place.within(Match.kinds('function'), Place.bucket(Match.all(), 'scoped'))
    expect(runPage(declOnly, mdPage(), page('Guide')).page?.group).toBeUndefined()
    const pages = Place.within(Match.file('docs/**'), Place.bucket(Match.all(), 'Guides'))
    expect(runPage(pages, mdPage(), page('Guide')).page?.group?.name).toBe('Guides')
  })
})

describe('Place.map', () => {
  it('maps matching sources’ Place, passing the rest through', () => {
    const layout = Place.map(Match.kinds('function'), (place) => ({ ...place, name: place.name.toUpperCase() }))
    expect(run(layout, facade({ kind: 'function' }), page('foo')).page?.name).toBe('FOO')
    expect(run(layout, facade({ kind: 'interface' }), page('foo')).page?.name).toBe('foo')
  })
})

describe('render modes', () => {
  const inlined: Placement = { page: { parent: { root: true }, name: 'Foo', render: 'inline' } }

  it('an omitted visibility field leaves the render mode alone', () => {
    // Regression: `{ nav: false }` used to reset render to 'page', silently
    // promoting an inlined declaration back to a route.
    const layout = Place.visibility(Match.all(), { nav: false })
    expect(run(layout, facade(), inlined).page?.render).toBe('inline')
    expect(run(layout, facade(), inlined).nav).toEqual([])
  })

  it('render forces a mode back on', () => {
    expect(run(Place.visibility(Match.all(), { render: 'page' }), facade(), inlined).page?.render).toBe('page')
    expect(run(Place.visibility(Match.all(), { render: 'hidden' }), facade(), inlined).page?.render).toBe('hidden')
  })

  it('inline and hide are the readable spellings', () => {
    expect(run(Place.inline(Match.all()), facade(), page()).page?.render).toBe('inline')
    expect(run(Place.hide(Match.all()), facade(), page()).page?.render).toBe('hidden')
  })

  it('pagesFor keeps pages for matches and inlines the other declarations', () => {
    const layout = Place.pagesFor(Match.bucket('components'))
    const bucketed = (name?: string): Placement => ({
      page: { parent: { root: true }, name: 'Foo', ...(name ? { group: { name } } : {}) },
    })
    expect(run(layout, facade(), bucketed('components')).page?.render).toBeUndefined() // untouched
    expect(run(layout, facade(), bucketed('types')).page?.render).toBe('inline')
    expect(run(layout, facade(), bucketed()).page?.render).toBe('inline')
  })

  it('pagesFor never inlines a container, nor a standalone page', () => {
    const layout = Place.pagesFor(Match.name('nothing'))
    expect(run(layout, facade({ kind: 'module' }), page()).page?.render).toBeUndefined()
    expect(run(layout, facade({ kind: 'namespace' }), page()).page?.render).toBeUndefined()
    expect(run(layout, facade({ kind: 'module', isEntry: () => true }), page()).page?.render).toBeUndefined()
    expect(runPage(layout, mdPage(), page('Guide')).page?.render).toBeUndefined()
  })

  it('pagesFor can hide the rest instead', () => {
    const layout = Place.pagesFor(Match.name('nothing'), { rest: 'hidden' })
    expect(run(layout, facade(), page()).page?.render).toBe('hidden')
  })
})

describe('Place.depth', () => {
  it('drops the sidebar row past the cut, keeping the page', () => {
    const layout = Place.depth(1)
    expect(run(layout, atDepth(1), page()).nav).toBeUndefined() // within the cut
    const deep = run(layout, atDepth(2), page())
    expect(deep.nav).toEqual([])
    expect(deep.page?.render).toBeUndefined() // page kept
  })

  it('beyond: inline collapses leaves onto their parent but leaves containers a page', () => {
    const layout = Place.depth(1, { beyond: 'inline' })
    expect(run(layout, atDepth(2), page()).page?.render).toBe('inline')
    const container = facade({
      kind: 'module',
      exposure: {
        is: () => true,
        ancestors: () => [[facade({ kind: 'module' }), facade({ kind: 'namespace' })]], // depth 2
        children: () => [facade()], // …with a member, so inlining it would strand one
      } as any,
    })
    const placed = run(layout, container, page())
    expect(placed.page?.render).toBeUndefined() // a container keeps its page…
    expect(placed.nav).toEqual([]) // …and loses only its row
  })

  it('beyond: hidden drops the route entirely', () => {
    expect(run(Place.depth(1, { beyond: 'hidden' }), atDepth(2), page()).page?.render).toBe('hidden')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Qualified labels
// ─────────────────────────────────────────────────────────────────────────

describe('qualified sidebar labels', () => {
  /** A namespace with one member, both pinned so the sidebar nests them. */
  const nested = (qualify?: boolean): GroupedItems<SidebarNode>[] => {
    const ns = facade({ id: 1 as Reflect.Id, name: 'Reflect', kind: 'namespace' })
    const member = facade({ id: 2 as Reflect.Id, name: 'Module', kind: 'interface' })
    const pinned: Layout = (source) => {
      if (source.kind !== 'doc') return undefined
      const parent = source.decl.id === 1 ? { root: true as const } : { decl: 1 as Reflect.Id }
      const name = source.decl.name
      return { page: { parent, name, ...(qualify === undefined ? {} : {}) }, nav: [{ parent, name }] }
    }
    const layout =
      qualify === undefined ? pinned : Place.compose(pinned, Place.qualify(Match.kinds('namespace'), qualify))
    const sources: PageSource[] = [
      { kind: 'doc', decl: ns },
      { kind: 'doc', decl: member },
    ]
    return buildTree(sources, layout, { docs: {} as Reflect.Index, name: 'test' }, () => {}).sidebar
  }

  const labelOf = (tree: GroupedItems<SidebarNode>[]) => {
    const root = tree[0]!.items[0]!
    const child = root.children[0]!.items[0]!
    return child.kind === 'doc' ? (child.display ?? child.label) : child.label
  }

  it('a namespace qualifies its members by default', () => {
    expect(labelOf(nested())).toBe('Reflect.Module')
  })

  it('Place.qualify(…, false) turns it off without un-pruning the container', () => {
    expect(labelOf(nested(false))).toBe('Module')
  })

  it('Place.qualify sets the flag the tree reads', () => {
    expect(run(Place.qualify(Match.all()), facade(), page()).page?.qualify).toBe(true)
    expect(run(Place.qualify(Match.all(), false), facade(), page()).page?.qualify).toBe(false)
    expect(run(Place.qualify(Match.name('other')), facade(), page()).page?.qualify).toBeUndefined()
  })
})

describe('empty-container prune', () => {
  /** A namespace with one member, rendered `page` or `inline`. */
  const tree = (render: 'page' | 'inline'): GroupedItems<SidebarNode>[] => {
    const pinned: Layout = (source) => {
      if (source.kind !== 'doc') return undefined
      if (source.decl.id === 1)
        return { page: { parent: { root: true }, name: 'Ns' }, nav: [{ parent: { root: true }, name: 'Ns' }] }
      const parent = { decl: 1 as Reflect.Id }
      return { page: { parent, name: 'member', render }, nav: [{ parent, name: 'member' }] }
    }
    const sources: PageSource[] = [
      { kind: 'doc', decl: facade({ id: 1 as Reflect.Id, name: 'Ns', kind: 'namespace' }) },
      { kind: 'doc', decl: facade({ id: 2 as Reflect.Id, name: 'member', kind: 'function' }) },
    ]
    return buildTree(sources, pinned, { docs: {} as Reflect.Index, name: 'test' }, () => {}).sidebar
  }

  it('keeps a container whose members render inline on its page', () => {
    // Regression: the prune counted sidebar rows, so `Place.depth(n, { beyond:
    // 'inline' })` deleted the very page its members had just moved onto.
    expect(tree('inline')[0]!.items.map((n) => n.label)).toEqual(['Ns'])
    expect(tree('page')[0]!.items.map((n) => n.label)).toEqual(['Ns'])
  })
})

// ─────────────────────────────────────────────────────────────────────────
// The declarative form
// ─────────────────────────────────────────────────────────────────────────

describe('Outline.of', () => {
  const outline = Outline.of(
    { name: 'Guides', include: Match.file('docs/**') },
    { name: 'API', include: Match.isEntry() },
    { name: 'types', include: Match.kinds('interface', 'type-alias'), nav: false },
    { name: /.+/ },
  )

  it('buckets each source into the first section that claims it', () => {
    expect(run(outline, facade({ kind: 'interface' }), page()).page?.group?.name).toBe('types')
    expect(run(outline, facade({ isEntry: () => true, kind: 'module' }), page()).page?.group?.name).toBe('API')
    expect(runPage(outline, mdPage(), page('Guide')).page?.group?.name).toBe('Guides')
    expect(run(outline, facade({ kind: 'function' }), page()).page?.group).toBeUndefined() // claimed by none
  })

  it('an entrypoint that is also a match for a later section keeps the earlier one', () => {
    const order = Outline.of(
      { name: 'API', include: Match.isEntry() },
      { name: 'modules', include: Match.kinds('module') },
    )
    expect(run(order, facade({ isEntry: () => true, kind: 'module' }), page()).page?.group?.name).toBe('API')
    expect(run(order, facade({ kind: 'module' }), page()).page?.group?.name).toBe('modules')
  })

  it('list order is bucket order, placeholders included', () => {
    expect(runPage(outline, mdPage(), page('Guide')).page?.group?.order).toBe(0)
    expect(run(outline, facade({ isEntry: () => true, kind: 'module' }), page()).page?.group?.order).toBe(1)
    expect(run(outline, facade({ kind: 'interface' }), page()).page?.group?.order).toBe(2)
    // A placeholder claims nothing but still positions the bucket a lower layer assigned.
    const withKinds = Place.compose(Place.bucket(Select.kind), outline)
    expect(run(withKinds, facade({ kind: 'function' }), page()).page?.group).toEqual({ name: 'functions', order: 3 })
  })

  it('applies a section’s own rules to its entries', () => {
    const sections = Outline.of({
      name: 'Guides',
      include: Match.file('docs/**'),
      order: ['Guide'],
      render: 'inline',
      nav: false,
    })
    const placed = runPage(sections, mdPage(), page('Guide'))
    expect(placed.page?.order).toEqual([0, 0])
    expect(placed.page?.render).toBe('inline')
    expect(placed.nav).toEqual([])
  })

  it('a folder section carries the label itself, and sorts by its position', () => {
    // `folder: true` asks for a folder *instead of* a heading, so the entries
    // take the unheaded bucket — otherwise every one would sit under a heading
    // inside a folder of the same name. The folder carries the section's
    // position itself, so its contents keep whatever order they earned.
    const sections = Outline.of({ name: 'Guides' }, { name: 'Types', include: Match.kinds('interface'), folder: true })
    const placed = run(sections, facade({ kind: 'interface' }), page())
    expect(placed.page?.parent).toEqual({ virtual: 'Types', order: [0, 1] })
    expect(placed.page?.group?.name).toBe('')
    expect(placed.page?.order).toBeUndefined() // the folder moved, not its contents

    // An explicit folder name is a folder *and* a heading, and its entries keep
    // the section's own running order under it.
    const named = Outline.of({ name: 'Types', include: Match.kinds('interface'), folder: 'Reference' })
    const under = run(named, facade({ kind: 'interface' }), page())
    expect(under.page?.parent).toEqual({ virtual: 'Reference', order: [0, 0] })
    expect(under.page?.group?.name).toBe('Types')
  })

  it('applies depth and qualify to the whole subtree, not just the entries', () => {
    const sections = Outline.of({ name: 'API', include: Match.isEntry(), depth: 1, qualify: false })
    const entry = facade({ isEntry: () => true, kind: 'module', name: 'config' })
    // A member two hops down, exposed by the entrypoint this section claims.
    const deep = facade({
      kind: 'function',
      exposure: { is: () => true, ancestors: () => [[entry, facade({ kind: 'namespace' })]], children: () => [] } as any,
    })
    expect(run(sections, deep, page()).nav).toEqual([])
    expect(run(sections, deep, page()).page?.qualify).toBe(false)
    // Outside the section entirely: untouched.
    const elsewhere = atDepth(2)
    expect(run(sections, elsewhere, page()).nav).toBeUndefined()
  })

  it('scopes a section’s structural rules to what it claimed, not what it matches', () => {
    // Both sections match a module; the first claims it. The second's `qualify`
    // must not reach it, nor its descendants — otherwise a broad `include` on
    // one section silently governs declarations another section owns.
    const owned = facade({ kind: 'module', name: 'owned' })
    const sections = Outline.of(
      { name: 'First', include: Match.name('owned') },
      { name: 'Second', include: Match.kinds('module'), qualify: false },
    )
    expect(run(sections, owned, page()).page?.group?.name).toBe('First')
    expect(run(sections, owned, page()).page?.qualify).toBeUndefined()

    const child = facade({
      kind: 'function',
      exposure: { is: () => true, ancestors: () => [[owned]], children: () => [] } as any,
    })
    expect(run(sections, child, page()).page?.qualify).toBeUndefined()

    // A module the first section does *not* claim falls to the second, and its
    // rules apply there.
    const other = facade({ kind: 'module', name: 'other' })
    expect(run(sections, other, page()).page?.group?.name).toBe('Second')
    expect(run(sections, other, page()).page?.qualify).toBe(false)
  })

  it('is a Layout, so it composes with layers before and after it', () => {
    const layout = Place.compose(outline, Place.bucket(Match.kinds('interface'), 'overridden'))
    expect(run(layout, facade({ kind: 'interface' }), page()).page?.group?.name).toBe('overridden')
  })
})

describe('Rank', () => {
  it('compares element-wise, reading a missing element as 0', () => {
    // The three spellings of the same rank.
    expect(compareRank(2, [2])).toBe(0)
    expect(compareRank([2], [2, 0])).toBe(0)
    expect(compareRank(undefined, [0, 0])).toBe(0)

    expect(compareRank([0, 3], [1])).toBeLessThan(0) // band 0 leads band 1
    expect(compareRank([0, 1, 5], [0, 2, 0])).toBeLessThan(0) // entry beats slot
    expect(compareRank([1, 0], [0, 999])).toBeGreaterThan(0)
  })

  it('has no ceiling, which is the point of a tuple over a stride', () => {
    // A slot larger than any stride still cannot reach the next entry's block.
    expect(compareRank([0, 0, 10_000_000], [0, 1, 0])).toBeLessThan(0)
  })

  it('minRank picks the lowest, an absent rank reading as 0 like everywhere else', () => {
    expect(minRank([[0, 2], [0, 1]])).toEqual([0, 1])
    // Not "ignored": an unranked sibling *is* rank 0, so it wins — which is
    // what makes a folder holding one sort as early as that child does.
    expect(minRank([[0, 2], [0, 1], undefined])).toBeUndefined()
    expect(minRank([])).toBeUndefined()
  })
})
