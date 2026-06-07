import { exports as resolveExports, type Package } from 'resolve.exports'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import * as tsconfig from '../tsconfig/index.ts'
import { memo1 } from '../util/index.ts'

export interface PackageJson extends Package {
  repository?: { type: string; url: string; directory?: string } | string
}

export const read = memo1(async (projectDir: string) => {
  const pkg = JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'))
  return pkg as PackageJson
})

export const repo = (pkg: PackageJson): { url?: string; directory?: string } | undefined => {
  const repo = pkg.repository
  if (!repo) return undefined
  const url = typeof repo === 'string' ? repo : repo.url
  if (typeof url !== 'string') return undefined
  return { url, directory: typeof repo === 'object' ? repo.directory : undefined }
}

export type ExportedSource = { path: string; as: string }

interface Options {
  /** Resolve "require"/"node" conditions instead of "import". @default false */
  require?: boolean
  /** Extra user conditions to match (e.g. "development"). */
  conditions?: readonly string[]

  tsconfig?: string
}

/**
 * Returns the source files corresponding to a package's published entry points,
 * resolving `exports` (with conditions/wildcards) or `main`, mapping each emitted
 * file back to its source via `.d.ts.map`/`.js.map` source maps when available,
 * and otherwise via the tsconfig `outDir`/`rootDir` swap.
 */
export const resolveExportedSources = async (
  projectDir: string,
  pkg: PackageJson,
  options: Options = {},
): Promise<ExportedSource[]> => {
  // --- 1. enumerate (subpath -> dist file) -------------------------------
  const entries: { as: string; dist: string }[] = []

  if (pkg.exports != null) {
    for (const subpath of listExportSubpaths(pkg.exports)) {
      // resolve.exports applies condition + wildcard logic for this subpath.
      const resolved = resolveExports(pkg, subpath, {
        require: options.require,
        conditions: options.conditions,
      })
      const dist = resolved?.[0]
      if (dist) entries.push({ as: subpath, dist })
    }
  } else if (typeof pkg.main === 'string') {
    entries.push({ as: '.', dist: pkg.main })
  } else if (typeof pkg.module === 'string') {
    entries.push({ as: '.', dist: pkg.module })
  }

  // --- 2. tsconfig fallback paths ----------------------------------------
  const { outDir, rootDir } = tsconfig.resolve(projectDir, options.tsconfig)

  // --- 3. dist -> source --------------------------------------------------
  const results: ExportedSource[] = []
  const seen = new Set<string>()

  for (const { as, dist } of entries) {
    const distAbs = path.resolve(projectDir, dist)
    const src =
      (await resolveViaSourceMap(distAbs, projectDir)) ??
      (await resolveViaTsconfig(distAbs, projectDir, outDir, rootDir))
    if (!src) continue

    const key = `${as}\0${src}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ as, path: src })
  }

  return results
}

// --- exports enumeration --------------------------------------------------

/** List the subpath keys of an `exports` field (".", "./foo", ...). */
const listExportSubpaths = (exportsField: unknown): string[] => {
  if (typeof exportsField === 'string') return ['.']
  if (exportsField == null || typeof exportsField !== 'object') return []

  const keys = Object.keys(exportsField as Record<string, unknown>)
  const subpathKeys = keys.filter((k) => k === '.' || k.startsWith('./'))

  // If no subpath-style keys, the object is a bare conditions map for ".".
  return subpathKeys.length > 0 ? subpathKeys : ['.']
}

// --- dist -> source: source maps -----------------------------------------

const resolveViaSourceMap = async (distAbs: string, projectDir: string): Promise<string | null> => {
  // Prefer the declaration map, then the js map.
  const mapCandidates = [
    distAbs.replace(/\.d\.ts$/, '.d.ts.map'),
    distAbs + '.map',
    distAbs.replace(/\.(js|mjs|cjs|jsx)$/, (m) => m + '.map'),
  ]

  for (const mapPath of mapCandidates) {
    let raw: string
    try {
      raw = await fs.readFile(mapPath, 'utf8')
    } catch {
      continue
    }

    let map: { sources?: string[]; sourceRoot?: string }
    try {
      map = JSON.parse(raw)
    } catch {
      continue
    }

    const first = map.sources?.[0]
    if (!first) continue

    const sourceAbs = path.resolve(path.dirname(mapPath), map.sourceRoot ?? '', first)
    return toPosixRelative(projectDir, sourceAbs)
  }

  return null
}

// --- dist -> source: tsconfig outDir/rootDir swap ------------------------

const resolveViaTsconfig = async (
  distAbs: string,
  projectDir: string,
  outDir: string,
  rootDir: string,
): Promise<string | null> => {
  const rel = path.relative(outDir, distAbs)
  if (rel.startsWith('..')) return null

  const base = rel.replace(/\.d\.ts$/, '').replace(/\.(js|mjs|cjs|jsx)$/, '')
  const candidateBase = path.join(rootDir, base)

  for (const ext of ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx']) {
    for (const candidate of [candidateBase + ext, path.join(candidateBase, 'index' + ext)]) {
      if (await exists(candidate)) {
        return toPosixRelative(projectDir, candidate)
      }
    }
  }
  return null
}

// --- helpers --------------------------------------------------------------

function toPosixRelative(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join('/')
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}
