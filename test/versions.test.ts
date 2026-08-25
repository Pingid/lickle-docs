import { expect, it, describe } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

import { resolveVersions, latestStable, isPrerelease, compare } from '../src/core/config/versions.ts'

const withTemp = async <T>(files: Record<string, unknown>, fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versions-'))
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content))
  }
  try {
    return await fn(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('compare', () => {
  it('orders numerically, not lexically', () => {
    expect(compare('0.0.9', '0.0.10')).toBeLessThan(0)
    expect(compare('1.2.0', '1.10.0')).toBeLessThan(0)
    expect(compare('2.0.0', '10.0.0')).toBeLessThan(0)
  })

  it('sorts a prerelease below the release it precedes', () => {
    expect(compare('1.0.0-dev.1', '1.0.0')).toBeLessThan(0)
    expect(compare('1.0.0-dev.2', '1.0.0-dev.10')).toBeLessThan(0)
    expect(compare('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0)
  })

  it('tolerates a leading v and falls back to a string compare for non-semver', () => {
    expect(compare('v1.0.0', '1.0.0')).toBe(0)
    expect(compare('nightly', 'stable')).toBeLessThan(0)
  })
})

describe('isPrerelease / latestStable', () => {
  it('treats a semver suffix as a prerelease', () => {
    expect(isPrerelease('0.0.2-dev.3')).toBe(true)
    expect(isPrerelease('1.0.0-rc.1')).toBe(true)
    expect(isPrerelease('1.0.0')).toBe(false)
  })

  it('picks the highest non-prerelease', () => {
    expect(latestStable(['1.0.0', '1.1.0-rc.1', '0.9.0'])).toBe('1.0.0')
    expect(latestStable(['0.0.9', '0.0.10'])).toBe('0.0.10')
  })

  it('falls back to the highest prerelease when there is no stable release', () => {
    expect(latestStable(['1.0.0-rc.1', '1.0.0-rc.2'])).toBe('1.0.0-rc.2')
    expect(latestStable([])).toBeUndefined()
  })
})

describe('resolveVersions', () => {
  const files = {
    'v/a.json': { version: '0.0.9', pages: [] },
    'v/b.json': { version: '0.0.10', pages: [] },
    'v/c.json': { version: '0.1.0-dev.1', pages: [] },
  }

  it('lists newest first, not in glob order', async () => {
    const out = await withTemp(files, (dir) => resolveVersions(dir, './v/*.json', undefined))
    expect(out.map((v) => v.version)).toEqual(['0.1.0-dev.1', '0.0.10', '0.0.9'])
  })

  it('marks prereleases and slugifies the version into a URL prefix', async () => {
    const out = await withTemp(files, (dir) => resolveVersions(dir, './v/*.json', undefined))
    expect(out[0]).toMatchObject({ version: '0.1.0-dev.1', slug: '/0.1.0-dev.1', prerelease: true })
    expect(out[1]!.prerelease).toBeUndefined()
  })

  it('drops the version currently being built, so it is not listed twice', async () => {
    const out = await withTemp(files, (dir) => resolveVersions(dir, './v/*.json', '0.0.10'))
    expect(out.map((v) => v.version)).toEqual(['0.1.0-dev.1', '0.0.9'])
  })

  it('skips unreadable or versionless files rather than failing the build', async () => {
    const out = await withTemp(
      { 'v/ok.json': { version: '1.0.0', pages: [] }, 'v/bad.json': 'not json', 'v/none.json': { pages: [] } },
      (dir) => resolveVersions(dir, './v/*.json', undefined),
    )
    expect(out.map((v) => v.version)).toEqual(['1.0.0'])
  })

  it('is empty when no glob is configured', async () => {
    expect(await withTemp(files, (dir) => resolveVersions(dir, undefined, undefined))).toEqual([])
  })
})
