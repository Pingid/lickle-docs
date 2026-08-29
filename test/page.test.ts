import { expect, it, describe } from 'vitest'

import { Match, Page, Place, Select } from '../src/core/layout/layout/index.ts'
import { buildTree } from '../src/core/layout/tree.ts'
import { createDeclarationFacade, type DeclarationFacade } from '../src/core/layout/facade.ts'
import type { Layout, Placement, PageSource, ContentSource, SidebarNode, GroupedItems } from '../src/core/layout/types.ts'
import type * as Reflect from '../src/core/reflect/index.ts'

/** A minimal declaration facade — just the fields the tree compiler reads. */
let nextId = 0
const facade = (over: Partial<DeclarationFacade> & { raw?: any } = {}): DeclarationFacade =>
  ({
    id: ++nextId as Reflect.Id,
    name: 'Foo',
    kind: 'function',
    raw: { kind: 'function', name: 'Foo', sources: [{ file: 'src/foo.ts' }] },
    tags: new Map(),
    isEntry: () => false,
    entry: () => undefined,
    entryIndex: () => undefined,
    exposure: { is: () => true, ancestors: () => [], children: () => [] },
    ...over,
  }) as unknown as DeclarationFacade

/** A facade exposed beneath `ancestors`, so `Match.under` sees the chain. */
const under = (ancestors: DeclarationFacade[], over: Partial<DeclarationFacade> = {}): DeclarationFacade =>
  facade({
    exposure: { is: () => true, ancestors: () => [ancestors], children: () => [] } as any,
    ...over,
  })

/** A stub index over `decls`, enough for `Place.into` to resolve its target. */
const indexOf = (decls: { id: number; name: string; kind?: string; file?: string }[]) => {
  const rows = decls.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind ?? 'module',
    parent: 0,
    sources: [{ file: d.file ?? `src/${d.name}.ts` }],
  }))
  return {
    declarations: () => rows,
    get: (id: number) => rows.find((d) => d.id === id),
    exposedBy: () => [],
    exposures: () => [],
    exposes: () => [],
    isRoot: () => false,
    children: () => [],
    referencedIn: () => [],
    rootAlias: () => undefined,
    rootIndex: () => undefined,
    commonDir: () => 'src',
  } as unknown as Reflect.Index
}

const cx = { index: indexOf([]), name: 'test' }

const run = (layout: Layout, decl: DeclarationFacade, base: Placement, index?: Reflect.Index): Placement => {
  const source: PageSource = { kind: 'doc', decl }
  return layout(source, { ...cx, ...(index ? { index } : {}), default: () => base }) ?? base
}

const runPage = (layout: Layout, source: ContentSource, base: Placement): Placement =>
  layout(source, { ...cx, default: () => base }) ?? base

const page = (name = 'Foo'): Placement => ({ page: { parent: { root: true }, name } })

const mdPage = (over: Partial<ContentSource> = {}): ContentSource =>
  ({ kind: 'markdown', title: 'Guide', content: '# hi', file: 'docs/guide.md', ...over }) as ContentSource

describe('Page.nav', () => {
  const tree = Page.roots(
    Page.nav('Overview', Match.file('README.md')),
    Page.nav('API', Match.file('src/core.ts')),
  )

  it('places the identity at the tree position, renamed to the label', () => {
    const core = facade({ name: 'core', kind: 'module', raw: { kind: 'module', sources: [{ file: 'src/core.ts' }] } })
    const placed = run(tree, core, { page: { parent: { virtual: 'elsewhere' }, name: 'core' } })
    expect(placed.page?.parent).toEqual({ root: true })
    expect(placed.page?.name).toBe('API')
    expect(placed.page?.order).toEqual([0, 1]) // second in the list
    expect(placed.nav).toBeUndefined() // derived, so the row moves with the page
  })

  it('rows sit in the unheaded run, positioned by their slot', () => {
    const md = mdPage({ title: 'Readme', file: 'README.md' })
    const placed = runPage(tree, md, page('Readme'))
    expect(placed.page?.name).toBe('Overview')
    expect(placed.page?.group).toEqual({ name: '', order: 0 })
  })

  it('keeps the page slug the layers below chose (the home page stays home)', () => {
    const home = runPage(tree, mdPage({ title: 'Readme', file: 'README.md', slug: '/' }), {
      page: { parent: { root: true }, name: 'Readme', slug: '/' },
    })
    expect(home.page?.slug).toBe('/')
    expect(home.page?.name).toBe('Overview')
  })

  it('revives an identity an earlier layer excluded', () => {
    const layout = Place.compose(Place.filter(Match.any()), Page.roots(Page.nav('API', Match.name('core'))))
    const core = facade({ name: 'core', kind: 'module', raw: { kind: 'module', sources: [{ file: 'src/core.ts' }] } })
    expect(run(layout, core, page('core')).page).not.toBeNull()
  })

  it('requires an identity', () => {
    expect(() => Page.nav('API')).not.toThrow() // constructing is fine
    expect(() => Page.roots(Page.nav('API'))).toThrow(/no identity/)
  })

  it('accepts Page.compose as grouping, per the sketch', () => {
    const composed = Page.roots(Page.nav('API', Page.compose(Match.file('src/core.ts'), Page.inline)))
    const core = facade({ name: 'core', kind: 'module', raw: { kind: 'module', sources: [{ file: 'src/core.ts' }] } })
    expect(run(composed, core, page('core')).page?.name).toBe('API')
  })
})

describe('Page.roots totality', () => {
  const tree = Page.roots(Page.nav('API', Match.name('core')))
  const core = facade({ name: 'core', kind: 'module' })

  it('members beneath a row keep their derived sidebar entry', () => {
    const member = under([core], { name: 'helper' })
    const base: Placement = { page: { parent: { decl: core.id }, name: 'helper' } }
    expect(run(tree, member, base).nav).toBeUndefined()
  })

  it('a source the tree does not reach keeps its page and loses its row', () => {
    const stray = facade({ name: 'stray' })
    const placed = run(tree, stray, page('stray'))
    expect(placed.page).not.toBeNull()
    expect(placed.nav).toEqual([])
  })

  it('standalone pages are held to the same totality', () => {
    const placed = runPage(tree, mdPage(), page('Guide'))
    expect(placed.nav).toEqual([])
  })
})

describe('Page.section', () => {
  it('groups its rows under the heading, ordered by list position', () => {
    const tree = Page.roots(
      Page.nav('Overview', Match.file('README.md')),
      Page.section('API', Page.nav('core', Match.name('core')), Page.nav('string', Match.name('string'))),
    )
    const core = run(tree, facade({ name: 'core', kind: 'module' }), page('core'))
    expect(core.page?.group).toEqual({ name: 'API', order: 1 })
    expect(core.page?.order).toEqual([0, 0])
    const str = run(tree, facade({ name: 'string', kind: 'module' }), page('string'))
    expect(str.page?.group).toEqual({ name: 'API', order: 1 })
    expect(str.page?.order).toEqual([0, 1])
  })

  it('gathered children take the heading but keep their own name and order', () => {
    const tree = Page.roots(Page.section('Guides', Page.children(Match.file('docs/**'))))
    const placed = runPage(tree, mdPage(), { page: { parent: { root: true }, name: 'Guide', order: [0, 2, 5] } })
    expect(placed.page?.group).toEqual({ name: 'Guides', order: 0 })
    expect(placed.page?.name).toBe('Guide')
    expect(placed.page?.order).toEqual([0, 2, 5])
  })
})

describe('Page.folder', () => {
  it('attaches children under a virtual folder carrying the label and slot order', () => {
    const tree = Page.roots(Page.nav('Overview', Match.file('README.md')), Page.folder('My Guides', Page.children(Match.file('docs/**'))))
    const placed = runPage(tree, mdPage(), page('Guide'))
    expect(placed.page?.parent).toEqual({ virtual: 'my-guides', label: 'My Guides', order: [0, 1] })
  })

  it('nests under an enclosing folder', () => {
    const tree = Page.roots(Page.folder('Docs', Page.folder('Guides', Page.children(Match.file('docs/**')))))
    const placed = runPage(tree, mdPage(), page('Guide'))
    expect(placed.page?.parent).toEqual({ virtual: 'docs/guides', label: 'Guides', order: [0, 0] })
  })

  it('cannot sit inside a page row', () => {
    expect(() => Page.roots(Page.nav('API', Match.name('core'), Page.folder('Extras')))).toThrow(/cannot sit inside/)
  })
})

describe('modifiers', () => {
  const core = facade({ name: 'core', kind: 'module' })

  it('bucket groups the members beneath a row, never the row itself', () => {
    const tree = Page.roots(Page.nav('API', Match.name('core'), Page.bucket(Select.tag('@group'))))
    const member = under([core], {
      name: 'helper',
      tags: new Map([['@group', { text: 'hooks' } as Reflect.CommentTag]]),
    })
    expect(run(tree, member, page('helper')).page?.group?.name).toBe('hooks')
    // The row itself keeps its own (unheaded) group.
    expect(run(tree, core, page('core')).page?.group).toEqual({ name: '', order: 0 })
  })

  it('inline collapses members onto the page, leaving the row a page', () => {
    const tree = Page.roots(Page.nav('API', Match.name('core'), Page.inline))
    const member = under([core], { name: 'helper' })
    expect(run(tree, member, page('helper')).page?.render).toBe('inline')
    expect(run(tree, core, page('core')).page?.render).toBeUndefined()
  })

  it('inline reaches gathered children too', () => {
    const index = indexOf([{ id: 900, name: 'prims', file: 'src/prims/index.ts' }])
    const tree = Page.roots(
      Page.nav('primitives', Match.file('src/prims/index.ts'), Page.children(Match.tag('@prim')), Page.inline),
    )
    const child = facade({ name: 'Button', tags: new Map([['@prim', {} as Reflect.CommentTag]]) })
    const placed = run(tree, child, page('Button'), index)
    expect(placed.page?.parent).toEqual({ decl: 900 })
    expect(placed.page?.render).toBe('inline')
    // Not `nav: []` — the derived edge is what parents it on the host's page.
    expect(placed.nav).toBeUndefined()
  })

  it('modifiers at the root apply to every source', () => {
    const tree = Page.roots(Page.nav('API', Match.name('core')), Page.layer(Place.qualify(Match.all(), false)))
    expect(run(tree, facade({ name: 'other', kind: 'namespace' }), page('other')).page?.qualify).toBe(false)
  })
})

describe('nested rows', () => {
  it('a row inside a row parents under the enclosing identity', () => {
    const index = indexOf([{ id: 800, name: 'ui', file: 'src/ui/index.ts' }])
    const tree = Page.roots(
      Page.nav('ui', Match.file('src/ui/index.ts'), Page.nav('primitives', Match.name('primitives'))),
    )
    const prims = facade({ name: 'primitives', kind: 'module', raw: { kind: 'module', sources: [{ file: 'src/prims.ts' }] } })
    const placed = run(tree, prims, page('primitives'), index)
    expect(placed.page?.parent).toEqual({ decl: 800 })
    expect(placed.page?.name).toBe('primitives')
  })
})

describe('the whole tree, resolved', () => {
  // A corpus the size of the sketch: an entry exposing two modules, `string`
  // declaring a tagged helper in its own file (so the identity match hits both
  // and has to pick the module); plus a readme page and a guide + declaration
  // the tree ignores.
  const rows = [
    { id: 1, name: 'lib', kind: 'module', parent: 0, path: './src/index.ts', sources: [{ file: 'src/index.ts' }] },
    { id: 2, name: 'core', kind: 'module', parent: 1, path: './src/core.ts', sources: [{ file: 'src/core.ts' }] },
    { id: 3, name: 'string', kind: 'module', parent: 1, path: './src/string.ts', sources: [{ file: 'src/string.ts' }] },
    {
      id: 4,
      name: 'camel',
      kind: 'function',
      parent: 3,
      sources: [{ file: 'src/string.ts' }],
      comment: { tags: [{ tag: '@group', text: 'casing' }] },
    },
    { id: 5, name: 'parse', kind: 'function', parent: 2, sources: [{ file: 'src/core.ts' }] },
    { id: 6, name: 'stray', kind: 'function', parent: 1, sources: [{ file: 'src/stray.ts' }] },
  ]
  /** Exposure chains, entrypoint first: who re-exports each declaration. */
  const chains: Record<number, number[][]> = { 2: [[1]], 3: [[1]], 4: [[1, 3]], 5: [[1, 2]] }
  const index = {
    declarations: () => rows,
    get: (id: number) => rows.find((r) => r.id === id),
    exposedBy: (id: number) => (chains[id] ?? []).map((c) => ({ exposer: c[c.length - 1] })),
    exposures: (id: number) => (chains[id] ?? []).map((c) => c.map((exposer) => ({ exposer }))),
    exposes: () => [],
    isRoot: (id: number) => id === 1,
    children: (id: number) => rows.filter((r) => r.parent === id),
    referencedIn: () => [],
    rootAlias: (id: number) => (id === 1 ? { as: '.', index: 0 } : undefined),
    rootIndex: (id: number) => (id === 1 ? 0 : undefined),
    commonDir: () => 'src',
  } as unknown as Reflect.Index

  const sources: PageSource[] = [
    { kind: 'markdown', title: 'Readme', content: '# hi', file: 'README.md', slug: '/' },
    { kind: 'markdown', title: 'Old guide', content: '# old', file: 'docs/old.md' },
    ...rows.map((r): PageSource => ({ kind: 'doc', decl: createDeclarationFacade(index, r.id)! })),
  ]

  const layout = Page.roots(
    Page.nav('Overview', Match.file('README.md')),
    Page.section(
      'API',
      Page.nav('Core', Match.file('src/core.ts')),
      Page.nav('String', Match.file('src/string.ts'), Page.bucket(Select.tag('@group')), Page.inline),
    ),
  )

  const flat = (groups: GroupedItems<SidebarNode>[]): string[] =>
    groups.flatMap((g) => g.items.map((i) => `${g.group}/${i.label}`))

  it('the sidebar is the tree that was written', () => {
    const { sidebar, resolved } = buildTree(sources, layout, { docs: index, name: 'test' }, () => {})
    expect(flat(sidebar)).toEqual(['/Overview', 'API/Core', 'API/String'])

    // The identity matched the module and the helper declared in its file; the
    // row is the module, so only it was renamed.
    expect(resolved.find((r) => r.id === 3)?.placement.page?.name).toBe('String')
    expect(resolved.find((r) => r.id === 4)?.placement.page?.name).toBe('camel')

    // The inlined member: no row of its own, bucketed by its tag, hosted under String.
    const camel = resolved.find((r) => r.id === 4)!
    expect(camel.placement.page?.render).toBe('inline')
    expect(camel.placement.page?.group?.name).toBe('casing')

    // Core's member keeps its ordinary row beneath the Core row.
    const core = sidebar.flatMap((g) => g.items).find((i) => i.label === 'Core')!
    expect(core.children.flatMap((g) => g.items.map((i) => i.label))).toEqual(['parse'])

    // Out-of-tree sources keep pages but no rows.
    expect(resolved.find((r) => r.id === 6)?.placement.nav).toEqual([])
    expect(
      resolved.find((r) => r.source.kind === 'markdown' && r.source.title === 'Old guide')?.placement.nav,
    ).toEqual([])
  })

  it('slugs follow the tree', () => {
    const { resolved } = buildTree(sources, layout, { docs: index, name: 'test' }, () => {})
    const slugOf = (name: string) => resolved.find((r) => r.placement.page?.name === name)?.slug
    expect(slugOf('Overview')).toBe('/')
    expect(slugOf('Core')).toBe('/core')
    expect(slugOf('String')).toBe('/string')
    expect(slugOf('parse')).toBe('/core/parse')
  })
})
