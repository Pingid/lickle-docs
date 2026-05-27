import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'

/**
 * Walk parent directories starting at `searchPath` and return the path to
 * the nearest `package.json`, or undefined if none exists up to the
 * filesystem root.
 */
export const find = (searchPath: string = process.cwd()): string | undefined => {
  let dir = path.resolve(searchPath)
  while (true) {
    const candidate = path.join(dir, 'package.json')
    if (existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

export const read = async (configPath: string): Promise<PackageJson> => {
  const content = await fs.readFile(configPath, 'utf-8')
  return JSON.parse(content) as PackageJson
}

export type PackageJson = {
  name?: string
  version?: string
  description?: string
  author?: string
  repository?: { type: string; url: string }
  main?: string
  module?: string
  types?: string
  exports?: { [key: string]: ConditionalSubpath }
}

export type ConditionalSubpath = { types?: string; import?: string; require?: string }

export interface ExportEntry {
  name: string
  /** Absolute paths for each conditional that the manifest specified. */
  candidates: ConditionalSubpath
}

/**
 * Walk every entry in `package.json#exports`, expanding wildcards. Each
 * match yields one `ExportEntry` whose `candidates` carries the resolved
 * absolute path for each conditional subpath the manifest declared.
 *
 * The caller picks which conditional to consume — see `pickEntry` in the
 * project builder.
 */
export const getExports = async function* (dir: string, json: PackageJson): AsyncGenerator<ExportEntry> {
  for (const [name, sub] of Object.entries(json.exports || {})) {
    const primary = sub.import ?? sub.require ?? sub.types
    if (!primary) continue
    const primaryPattern = primary.replace(/^\.\//, '')
    if (!primaryPattern.includes('*')) {
      yield { name, candidates: resolveCandidates(sub, dir, undefined) }
      continue
    }
    for await (const match of fg.globStream(primaryPattern, { cwd: dir })) {
      const entry = match.toString()
      const subPath = entry.substring(primaryPattern.indexOf('*'))
      const stem = subPath.replace(/\.[^./]+$/, '')
      const resolvedName = name.replace('*', stem)
      yield { name: resolvedName, candidates: resolveCandidates(sub, dir, stem) }
    }
  }
}

const resolveCandidates = (
  sub: ConditionalSubpath,
  dir: string,
  wildcardStem: string | undefined,
): ConditionalSubpath => {
  const out: ConditionalSubpath = {}
  for (const cond of ['types', 'import', 'require'] as const) {
    const pat = sub[cond]
    if (!pat) continue
    const rel = pat.replace(/^\.\//, '')
    const filled = wildcardStem !== undefined ? rel.replace('*', wildcardStem) : rel
    out[cond] = path.resolve(dir, filled)
  }
  return out
}
