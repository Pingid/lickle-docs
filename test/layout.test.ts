import { expect, it, describe } from 'vitest'

import { Match, Select, Place } from '../src/core/layout/layout/index.ts'
import { effectiveNav } from '../src/core/layout/tree.ts'
import type { DeclarationFacade } from '../src/core/layout/facade.ts'
import type { Layout, Placement, PageSource } from '../src/core/layout/types.ts'
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

/** Run a layout for a doc source whose lower layers produced `base`. */
const run = (layout: Layout, decl: DeclarationFacade, base: Placement): Placement => {
  const source: PageSource = { kind: 'doc', decl }
  return layout(source, { default: () => base }) ?? base
}

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
