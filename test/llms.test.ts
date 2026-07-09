import { expect, it, describe } from 'vitest'

import { llmsFiles, llmsTxt, llmsFullTxt, pageFiles } from '../src/core/llms/index.ts'
import type { ProjectVersion } from '../src/core/config/types.ts'
import type * as Reflect from '../src/core/reflect/types.ts'

/**
 * A small hand-built site: a home page, a guide under a "Guides" heading, and
 * one declaration under "API". Hand-built rather than scanned so the shape
 * under test is obvious and the assertions can be exact.
 */
const project = (over: Partial<ProjectVersion> = {}): ProjectVersion => ({
  name: 'My Library',
  version: '1.0.0',
  prefix: { doc: '', page: '' },
  pages: [
    { kind: 'page', title: 'Overview', slug: '/', body: ['# My Library\n\nDoes a useful thing.'] },
    { kind: 'page', title: 'Getting started', slug: 'getting-started', body: ['Install it, then run it.'] },
    { kind: 'doc', title: 'add', slug: 'add', decl: 1 as Reflect.Id, links: [], referenced: [] },
  ],
  sidebar: [
    {
      group: '',
      items: [{ kind: 'page', slug: '/', label: 'Overview', children: [] }],
    },
    {
      group: 'Guides',
      items: [{ kind: 'page', slug: 'getting-started', label: 'Getting started', children: [] }],
    },
    {
      group: 'API',
      items: [{ kind: 'doc', id: 1 as Reflect.Id, slug: 'add', label: 'add', children: [] }],
    },
  ],
  redirects: [],
  declarations: [
    {
      id: 1,
      parent: 0,
      kind: 'function',
      name: 'add',
      sources: [{ file: 'src/add.ts', line: 1, column: 1 }],
      signatures: [],
      comment: { parts: [{ kind: 'text', text: 'Add two numbers.' }] },
    } as unknown as Reflect.Declaration,
  ],
  ...over,
})

describe('llms.txt', () => {
  it('titles the project, summarises it, and mirrors the sidebar sections', () => {
    const txt = llmsTxt(project())
    expect(txt.split('\n')[0]).toBe('# My Library')
    expect(txt).toContain('> Does a useful thing.')
    // Sections come from the sidebar groups, in sidebar order. The unnamed
    // leading run has no heading in the UI, so it is titled "Overview" here.
    expect(txt.match(/^## .+$/gm)).toEqual(['## Overview', '## Guides', '## API'])
  })

  it('lists each page as a link with a one-line description', () => {
    const txt = llmsTxt(project())
    expect(txt).toContain('- [Getting started](/getting-started.md): Install it, then run it.')
    expect(txt).toContain('- [add](/add.md): Add two numbers.')
  })

  it('links to the markdown files it emits, so a reader lands on prose', () => {
    expect(llmsTxt(project())).toContain('(/getting-started.md)')
    // …unless the per-page markdown isn't being emitted, in which case the
    // page URL is the only thing that exists.
    expect(llmsTxt(project(), { pages: false })).toContain('(/getting-started)')
  })

  it('makes links absolute when a site origin is configured', () => {
    const txt = llmsTxt(project(), { site: 'https://example.com/docs/' })
    expect(txt).toContain('(https://example.com/docs/getting-started.md)')
    // The home page is the origin itself, not `origin + '/'`.
    expect(txt).toContain('(https://example.com/docs/index.md)')
  })

  it('takes an explicit description over the home page prose', () => {
    expect(llmsTxt(project(), { description: 'Custom summary.' })).toContain('> Custom summary.')
  })
})

describe('llms-full.txt', () => {
  it('concatenates every page, rule-separated, in sidebar order', () => {
    const full = llmsFullTxt(project())
    expect(full).toContain('# My Library')
    expect(full).toContain('Install it, then run it.')
    expect(full).toContain('Add two numbers.')
    expect(full.indexOf('Install it, then run it.')).toBeLessThan(full.indexOf('Add two numbers.'))
    expect(full).toContain('\n---\n')
  })
})

describe('per-page markdown', () => {
  it('writes the home page to index.md and everything else to <slug>.md', () => {
    const paths = pageFiles(project()).map((f) => f.path)
    expect(paths).toEqual(['index.md', 'getting-started.md', 'add.md'])
  })

  it('renders a declaration page through the same serializer as "copy as markdown"', () => {
    const add = pageFiles(project()).find((f) => f.path === 'add.md')!
    expect(add.content).toContain('# add')
    expect(add.content).toContain('*function*')
    expect(add.content).toContain('src/add.ts:1')
  })
})

describe('llmsFiles', () => {
  it('emits the index, the full dump and every page by default', () => {
    const paths = llmsFiles(project()).map((f) => f.path)
    expect(paths.slice(0, 2)).toEqual(['llms.txt', 'llms-full.txt'])
    expect(paths).toContain('getting-started.md')
  })

  it('honours each part being switched off', () => {
    expect(llmsFiles(project(), { full: false }).map((f) => f.path)).not.toContain('llms-full.txt')
    expect(llmsFiles(project(), { pages: false }).map((f) => f.path)).toEqual(['llms.txt', 'llms-full.txt'])
    expect(llmsFiles(project(), { index: false, full: false, pages: false })).toEqual([])
  })

  it('every link in the index points at a file it also emits', () => {
    const files = llmsFiles(project())
    const emitted = new Set(files.map((f) => f.path))
    const index = files.find((f) => f.path === 'llms.txt')!.content
    const links = [...index.matchAll(/\]\(\/([^)]*)\)/g)].map((m) => m[1]!)
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(emitted).toContain(link)
  })
})
