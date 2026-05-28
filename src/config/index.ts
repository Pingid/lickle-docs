import path from 'node:path'

import type { Entry, UserConfig } from './types.ts'
import { pkgJson, tsconfig } from '../core/workspace/index.ts'

export const defineConfig = (config: UserConfig | (() => UserConfig) | (() => Promise<UserConfig>)) => {
  const c = typeof config === 'function' ? config() : config
  return Promise.resolve(c)
}

export interface ExportsOptions {
  /** package.json file path, defaults to the nearest one from cwd. */
  packageJson?: string
  /** tsconfig.json file path, defaults to the nearest one from the package dir. */
  tsconfig?: string
  /** Source directory, e.g. `src`. Disambiguates when several sources match. */
  srcDir?: string
}

/**
 * One `Entry` per `package.json#exports` entry. Built export paths
 * (e.g. `dist/ts/ui/index.d.ts`) are mapped back onto the matching tsconfig
 * source file (`src/ui/index.ts`), falling back to the published path.
 */
export const pagesFromExports = async (p?: ExportsOptions): Promise<Entry[]> => {
  const pkgPath = p?.packageJson ?? pkgJson.find()
  if (!pkgPath) return []
  const pkg = await pkgJson.read(pkgPath).catch(() => undefined)
  if (!pkg) return []

  const dir = path.dirname(pkgPath)
  const toSource = sourceResolver(dir, p)
  const entries: Entry[] = []
  for await (const e of pkgJson.getExports(dir, pkg)) {
    const candidate = e.candidates.types ?? e.candidates.import ?? e.candidates.require
    if (!candidate) continue
    entries.push({ label: e.name, content: toSource(candidate) })
  }
  return entries
}

const stripExt = (f: string): string => f.replace(/\.d\.ts$|\.[^./]+$/, '')

/**
 * Build a candidate → source-file mapper from the project's tsconfig. A built
 * path like `dist/ts/ui/index.d.ts` is matched to the source whose
 * root-relative tail (`ui/index`) is the longest suffix of it — so the actual
 * output dir never has to be known. Identity mapping when no tsconfig.
 */
const sourceResolver = (dir: string, p?: ExportsOptions): ((candidate: string) => string) => {
  const tsc = parseTsconfig(p?.tsconfig ?? tsconfig.find(dir))
  if (!tsc) return (c) => c

  const root = relDir(dir, tsc.options.rootDir) ?? p?.srcDir
  const sources = tsc.fileNames.map((f) => ({ file: f, tail: tail(path.relative(dir, f), root) }))
  return (candidate) => {
    const stem = stripExt(path.relative(dir, candidate))
    let best: string | undefined
    let bestLen = -1
    for (const s of sources) {
      if ((stem === s.tail || stem.endsWith(`/${s.tail}`)) && s.tail.length > bestLen) {
        best = s.file
        bestLen = s.tail.length
      }
    }
    return best ?? candidate
  }
}

/** Source path minus its extension and leading `root/` segment. */
const tail = (rel: string, root: string | undefined): string => {
  const stem = stripExt(rel)
  return root && stem.startsWith(`${root}/`) ? stem.slice(root.length + 1) : stem
}

const relDir = (dir: string, abs: string | undefined): string | undefined =>
  abs ? path.relative(dir, abs) : undefined

const parseTsconfig = (pth: string | undefined) => {
  if (!pth) return undefined
  try {
    return tsconfig.parse(pth, tsconfig.read(pth))
  } catch {
    return undefined
  }
}
