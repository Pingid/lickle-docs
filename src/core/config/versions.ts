import path from 'node:path'
import fg from 'fast-glob'

import { Node, Slug } from '../../_lib/index.ts'
import type { ConfigVersion, ProjectVersion } from './types.ts'

/**
 * Resolve the `versions` glob into the switcher's entries.
 *
 * Each match is a `project.json` emitted by an earlier `ldocs generate` — one
 * released version's data. The current build is not among them; it is added by
 * the client plugin and always serves at `/`, so an archived file for the
 * version being built is dropped rather than listed twice.
 *
 * Ordering is newest-first by version, not filesystem order, because the
 * dropdown is read top-down and a glob's order is arbitrary.
 */
export const resolveVersions = async (
  dir: string,
  glob: string | undefined,
  current: string | undefined,
): Promise<ConfigVersion[]> => {
  if (!glob) return []
  const files = await fg.glob(path.resolve(dir, glob))

  const found = await Promise.all(files.map((file) => read(file)))
  const seen = new Set<string>(current ? [current] : [])

  const versions: ConfigVersion[] = []
  for (const v of found) {
    if (!v || seen.has(v.version)) continue
    seen.add(v.version)
    versions.push({
      path: v.path,
      version: v.version,
      slug: Slug.normalize(Slug.toSlug(v.version)),
      ...(isPrerelease(v.version) ? { prerelease: true } : {}),
    })
  }

  return versions.sort((a, b) => compare(b.version, a.version))
}

const read = async (file: string): Promise<{ path: string; version: string } | null> => {
  try {
    const content = await Node.Fs.readFile(file, 'utf-8')
    const project = JSON.parse(content) as ProjectVersion
    return project.version ? { path: file, version: project.version } : null
  } catch {
    return null
  }
}

/**
 * Whether a version is a prerelease — a semver `-` suffix (`1.2.0-dev.3`,
 * `2.0.0-rc.1`). Used to label the entry, and to answer "latest stable" when
 * choosing which version a deployment should lead with.
 */
export const isPrerelease = (version: string): boolean => /-/.test(version)

/**
 * Compare two versions, ascending. Numeric segments compare numerically so
 * `0.0.10` sorts above `0.0.9`; a prerelease sorts below the release it
 * precedes, per semver. Anything unparseable falls back to a string compare,
 * so a non-semver tag still lands somewhere stable rather than throwing.
 */
export const compare = (a: string, b: string): number => {
  const pa = parse(a)
  const pb = parse(b)
  if (!pa || !pb) return a.localeCompare(b)

  for (let i = 0; i < 3; i++) {
    const diff = pa.parts[i]! - pb.parts[i]!
    if (diff !== 0) return diff
  }

  // Equal core versions: a release outranks its prereleases, and prereleases
  // compare by their dot-separated identifiers.
  if (!pa.pre && !pb.pre) return 0
  if (!pa.pre) return 1
  if (!pb.pre) return -1
  return comparePre(pa.pre, pb.pre)
}

/** Highest version by {@link compare}, ignoring prereleases unless there is nothing else. */
export const latestStable = (versions: string[]): string | undefined => {
  const stable = versions.filter((v) => !isPrerelease(v))
  const pool = stable.length ? stable : versions
  return pool.slice().sort(compare).pop()
}

const parse = (version: string): { parts: number[]; pre?: string } | null => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(version.trim())
  if (!m) return null
  return { parts: [Number(m[1]), Number(m[2]), Number(m[3])], ...(m[4] ? { pre: m[4] } : {}) }
}

const comparePre = (a: string, b: string): number => {
  const as = a.split('.')
  const bs = b.split('.')
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const x = as[i]
    const y = bs[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = Number(x)
    const ny = Number(y)
    const numeric = !Number.isNaN(nx) && !Number.isNaN(ny)
    const diff = numeric ? nx - ny : x.localeCompare(y)
    if (diff !== 0) return diff
  }
  return 0
}
