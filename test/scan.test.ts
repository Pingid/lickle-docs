import { expect, it, describe } from 'vitest'

import { multiScanFixture } from './fixture.ts'

// `entry` imports `used`; `orphan` is in the program but nothing imports it.
const FILES = {
  'used.ts': `export const used = (x: number): number => x\n`,
  'orphan.ts': `export const orphan = (x: number): number => x\n`,
  'entry.ts': `export * from './used'\n`,
}
const ENTRIES = [{ as: '.', file: 'entry.ts' }]

const names = (idx: ReturnType<typeof multiScanFixture>) => [...idx.declarations()].map((d) => d.name)

describe('scan modes', () => {
  it("'all' reads every included file, orphans included", () => {
    expect(names(multiScanFixture(FILES, ENTRIES))).toContain('orphan')
  })

  it("'reachable' walks out from the entrypoints and skips orphans", () => {
    const reached = names(multiScanFixture(FILES, ENTRIES, { scan: 'reachable' }))
    expect(reached).toContain('used')
    expect(reached).not.toContain('orphan')
  })
})

describe('reflected paths', () => {
  it('are project-relative and POSIX-separated, so one path base serves everything', () => {
    const idx = multiScanFixture(FILES, ENTRIES)
    const used = [...idx.declarations()].find((d) => d.name === 'used')!
    // Not absolute, not srcDir-relative-but-different: the same string
    // `Match.file` globs, `include` receives, and a repo `fileUrl` appends.
    expect(used.sources[0]!.file).toBe('used.ts')
    expect(used.sources[0]!.file.includes('\\')).toBe(false)
  })
})
