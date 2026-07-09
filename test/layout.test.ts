import { expect, it, describe } from 'vitest'

import { Match, Select, Place } from '../src/core/layout/layout/index.ts'
import { effectiveNav, buildTree } from '../src/core/layout/tree.ts'
import type { DeclarationFacade } from '../src/core/layout/facade.ts'
import type { Layout, Placement, PageSource, ContentSource } from '../src/core/layout/types.ts'
import type * as Reflect from '../src/core/reflect/index.ts'

/** A minimal declaration facade — just the fields the matchers/presets read. */
const facade = (over: Partial<DeclarationFacade> & { raw?: any } = {}): DeclarationFacade =>
  ({
    id: 1 as Reflect.Id,
    name: 'Foo',
    kind: 'function',
    raw: { kind: 'function', name: 'Foo', sources: [{ file: 'src/foo.ts' }] },
    tags: new Map(),
    isEntry: () => false,
    exposure: { is: () => true },
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
    expect(run(layout, facade({ name: 'Alpha' }), page('Alpha')).page?.order).toBe(0)
    expect(run(layout, facade({ name: 'Beta' }), page('Beta')).page?.order).toBe(1)
    expect(run(layout, facade({ kind: 'interface' }), page('Zeta')).page?.order).toBe(2)
    expect(run(layout, facade({ name: 'Zeta' }), page('Zeta')).page?.order).toBeUndefined()
  })

  it('orders standalone pages too, so a guide can outrank generated entries', () => {
    const layout = Place.order(Match.page(), /.*/)
    expect(runPage(layout, mdPage(), page('Guide')).page?.order).toBe(0)
    expect(run(layout, facade({ name: 'Foo' }), page('Foo')).page?.order).toBe(1)
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
