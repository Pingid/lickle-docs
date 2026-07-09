import { expect, it, describe } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

import { resolvePages } from '../src/core/config/pages.ts'
import * as Frontmatter from '../src/_lib/frontmatter/index.ts'
import type { Diagnostic } from '../src/core/diagnostic/types.ts'

/** Materialise `files` in a temp dir, run `fn`, then clean up. */
const withTemp = async <T>(files: Record<string, string>, fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'))
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  try {
    return await fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

const collect = () => {
  const out: Diagnostic[] = []
  return { emit: (d: Diagnostic) => out.push(d), out }
}

describe('frontmatter', () => {
  it('splits the fenced block from the body and coerces scalars', () => {
    const { data, body } = Frontmatter.parse('---\ntitle: Hello\norder: 3\ndraft: true\n---\n# Body\n')
    expect(data).toEqual({ title: 'Hello', order: 3, draft: true })
    expect(body).toBe('# Body\n')
  })

  it('strips surrounding quotes and ignores comments and blanks', () => {
    const { data } = Frontmatter.parse('---\n# a comment\n\ntitle: "A: colon"\nslug: \'/x\'\n---\nbody')
    expect(data).toEqual({ title: 'A: colon', slug: '/x' })
  })

  it('leaves a body with no frontmatter untouched', () => {
    const { data, body } = Frontmatter.parse('# Just markdown\n')
    expect(data).toEqual({})
    expect(body).toBe('# Just markdown\n')
  })

  it('reads the first heading as a title fallback', () => {
    expect(Frontmatter.heading('intro\n\n# The Title\n\nmore')).toBe('The Title')
    expect(Frontmatter.heading('no heading here')).toBeUndefined()
  })
})

describe('resolvePages', () => {
  it('expands a glob, deriving folder, title and order from the filesystem', async () => {
    const pages = await withTemp(
      {
        'docs/guides/01-getting-started.md': '# Getting started\n\ntext',
        'docs/guides/advanced/deep-dive.md': 'no heading, title comes from the filename',
      },
      (dir) => resolvePages(dir, ['./docs/guides/**/*.md'], collect().emit),
    )

    expect(pages).toEqual([
      expect.objectContaining({
        kind: 'markdown',
        title: 'Getting started',
        folder: undefined,
        order: 1,
        file: 'docs/guides/01-getting-started.md',
      }),
      expect.objectContaining({ kind: 'markdown', title: 'Deep dive', folder: 'advanced' }),
    ])
  })

  it('lets frontmatter override every derived field', async () => {
    const [page] = await withTemp(
      { 'docs/x.md': '---\ntitle: Custom\nslug: custom-slug\nfolder: Guides\ngroup: Basics\norder: 9\n---\n# Ignored\n' },
      (dir) => resolvePages(dir, ['./docs/*.md'], collect().emit),
    )
    expect(page).toMatchObject({
      title: 'Custom',
      slug: 'custom-slug',
      folder: 'Guides',
      group: 'Basics',
      order: 9,
    })
    expect((page as { content: string }).content).toBe('# Ignored\n')
  })

  it('skips drafts', async () => {
    const pages = await withTemp(
      { 'docs/a.md': '# Shipped', 'docs/b.md': '---\ndraft: true\n---\n# Hidden' },
      (dir) => resolvePages(dir, ['./docs/*.md'], collect().emit),
    )
    expect(pages.map((p) => p.title)).toEqual(['Shipped'])
  })

  it('treats a .tsx path as a component page carrying its module path', async () => {
    const [page] = await withTemp({ 'docs/playground.tsx': 'export default () => null' }, (dir) =>
      resolvePages(dir, [{ title: 'Playground', content: './docs/playground.tsx' }], collect().emit),
    )
    expect(page).toMatchObject({ kind: 'component', title: 'Playground', module: 'docs/playground.tsx' })
  })

  it('treats a non-path content string as inline markdown', async () => {
    const [page] = await withTemp({}, (dir) =>
      resolvePages(dir, [{ title: 'Inline', content: '# Written here' }], collect().emit),
    )
    expect(page).toMatchObject({ kind: 'markdown', title: 'Inline', content: '# Written here' })
    expect(page).not.toHaveProperty('file') // nothing on disk to point at
  })

  it('never emits the same file twice across overlapping entries', async () => {
    const pages = await withTemp({ 'docs/a.md': '# A' }, (dir) =>
      resolvePages(dir, ['./docs/*.md', './docs/**/*.md'], collect().emit),
    )
    expect(pages).toHaveLength(1)
  })

  it('reports an unreadable page instead of failing the build', async () => {
    const { emit, out } = collect()
    const pages = await withTemp({}, (dir) => resolvePages(dir, [{ title: 'Gone', content: './missing.md' }], emit))
    expect(pages).toEqual([])
    expect(out.map((d) => d.code)).toEqual(['page-read'])
  })

  it('a glob entry can group its matches instead of foldering them', async () => {
    const pages = await withTemp(
      { 'docs/guides/a.md': '# A', 'docs/guides/deep/b.md': '# B' },
      (dir) => resolvePages(dir, [{ glob: './docs/guides/**/*.md', group: 'Guides', folder: false }], collect().emit),
    )
    // `group` is a plain heading; `folder: false` means no collapsible branch,
    // not even the one the `deep/` directory would otherwise imply.
    expect(pages.map((p) => [p.title, p.group, p.folder])).toEqual([
      ['A', 'Guides', undefined],
      ['B', 'Guides', undefined],
    ])
  })

  it('a glob entry can root its derived folders under one name', async () => {
    const pages = await withTemp({ 'docs/deep/b.md': '# B' }, (dir) =>
      resolvePages(dir, [{ glob: './docs/**/*.md', folder: 'Guides' }], collect().emit),
    )
    expect(pages[0]).toMatchObject({ folder: 'Guides/deep' })
  })

  it('orders by entry position first, then by what each file says', async () => {
    const pages = await withTemp(
      {
        'docs/guides/02-second.md': '# Second',
        'docs/guides/01-first.md': '# First',
        'docs/guides/pinned.md': '---\norder: 0\n---\n# Pinned',
      },
      (dir) =>
        resolvePages(
          dir,
          [{ title: 'Home', content: './README.md' }, './docs/guides/*.md'],
          collect().emit,
        ),
    )
    // The explicit entry failed to read, so only the glob's block remains: a
    // frontmatter `order` and numeric prefixes both outrank match position,
    // and every one of them sits in entry 1's block (1000+).
    const byTitle = Object.fromEntries(pages.map((p) => [p.title, p.order]))
    expect(byTitle).toEqual({ Pinned: 1000, First: 1001, Second: 1002 })
  })
})
