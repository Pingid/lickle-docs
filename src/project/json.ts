import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'
import mm from 'micromatch'
import fg from 'fast-glob'

import * as pkgJson from '../pkg-json/index.ts'
import * as tsconf from '../tsconfig/index.ts'
import * as reflect from '../reflect/index.ts'
import * as naming from './naming.ts'
import * as surface from './surface.ts'

export interface ProjectJson {
  /** The name of the project. */
  name: string
  /** The version of the project. */
  version?: string
  /** The readme of the project. */
  readme?: string
  /** The main entrypoint of the project. */
  main?: string
  /** The exports of the project. */
  exports: { name: string; path: string }[]
  /** Git hash of the project. */
  hash?: string
  /** Entrypoints — relative source paths reachable from `main` / `exports`. */
  entrypoints: string[]
  /** Top-level reflections — one per scanned source file. */
  reflections: reflect.resolve.Module[]
  /** Per-entrypoint public surface (id + kind), precomputed once at scan time. */
  surface: surface.SurfaceEntry[]
  /** Links for the project. */
  links: { label: string; href: string }[]
}

export interface ScanOptions {
  dir: string
  exclude?: string[]
  include?: string[]
  tsConfigPath?: string
}

export const generate = async (options: ScanOptions): Promise<ProjectJson> => {
  const json = await pkgJson.read(path.join(options.dir, 'package.json'))
  const tsConfig = await findAndParseTsConfig(options.tsConfigPath)

  const links: ProjectJson['links'] = []
  if (json.repository?.url) links.push({ label: 'Repository', href: json.repository.url })

  const { files, exports } = await collectEntrypoints(options, json, tsConfig)

  const readme = await fs.readFile(path.join(options.dir, 'README.md'), 'utf-8').catch(() => undefined)
  const version = json.version
  const name = json.name ?? 'Unknown'
  const reflections = reflect.resolve.run(Array.from(files), {
    compilerOptions: tsConfig.options,
    rootDir: options.dir,
    include: { file: (sf) => keepFile(sf, options.exclude) },
  })

  naming.stamp(reflections)

  const entrypoints = Array.from(files).map((f) => path.relative(options.dir, f))
  const surfaceEntries = surface.compute(entrypoints, reflections)

  const hash = readGitHash()

  return {
    name,
    version,
    readme,
    entrypoints,
    reflections,
    exports,
    surface: surfaceEntries,
    links,
    hash,
  }
}

// ============================================================================
// ENTRYPOINT COLLECTION
// ============================================================================

const collectEntrypoints = async (
  options: ScanOptions,
  json: pkgJson.PackageJson,
  tsConfig: ts.ParsedCommandLine,
): Promise<{ files: Set<string>; exports: { name: string; path: string }[] }> => {
  const files = new Set<string>()
  const exports: { name: string; path: string }[] = []

  if (options.include?.length) {
    for (const i of options.include) {
      const matches = await fg.glob(i, { cwd: options.dir, absolute: true })
      for (const p of matches) files.add(p)
    }
    return { files, exports }
  }

  // Default: derive entrypoints from `main`/`module`/`types` and `exports`.
  const root = json.module ?? json.main ?? json.types
  if (root) {
    const r = resolveEntry(options.dir, root, tsConfig)
    if (r.ok) files.add(r.path)
  }

  for await (const e of pkgJson.exports(options.dir, json)) {
    const r = pickConditional(e.candidates, options.dir, tsConfig)
    if (!r.ok) continue
    files.add(r.path)
    exports.push({ name: e.name, path: path.relative(options.dir, r.path) })
  }

  return { files, exports }
}

/**
 * Pick the most accurate conditional subpath. `types` wins when it points at
 * a project source file (typical for libraries that ship `.d.ts` aligned
 * with their `.ts` sources). Otherwise fall back to the standard
 * `import → require → types` order.
 */
const pickConditional = (
  candidates: pkgJson.ConditionalSubpath,
  dir: string,
  tsConfig: ts.ParsedCommandLine,
): ResolveResult => {
  if (candidates.types) {
    const r = resolveEntry(dir, candidates.types, tsConfig)
    if (r.ok) return r
  }
  for (const cond of ['import', 'require'] as const) {
    const c = candidates[cond]
    if (!c) continue
    const r = resolveEntry(dir, c, tsConfig)
    if (r.ok) return r
  }
  if (candidates.types) {
    const r = resolveEntry(dir, candidates.types, tsConfig)
    if (r.ok) return r
  }
  return { ok: false, error: 'not-in-tsconfig' }
}

type ResolveResult =
  | { ok: true; path: string }
  | { ok: false; error: 'not-in-tsconfig' | 'unsupported-path' }

/**
 * Map a `package.json` style spec (e.g. `./lib/src/index.ts`) onto a source
 * file in `tsConfig.fileNames`. Strips `outDir` prefixes and the file
 * extension so a published `.js` path can match its `.ts` source.
 */
const resolveEntry = (dir: string, spec: string, tsConfig: ts.ParsedCommandLine): ResolveResult => {
  let needle = path.isAbsolute(spec) ? path.relative(dir, spec) : spec.replace(/^\.?\//, '')
  if (tsConfig.options.outDir) {
    const relOutDir = path.relative(dir, tsConfig.options.outDir)
    if (relOutDir && needle.startsWith(`${relOutDir}/`)) needle = needle.slice(relOutDir.length + 1)
  }
  const stem = needle.replace(/\.[^./]+$/, '')
  if (!stem) return { ok: false, error: 'unsupported-path' }
  const match = tsConfig.fileNames.find((f) => f.replace(/\.[^./]+$/, '').endsWith(stem))
  return match ? { ok: true, path: match } : { ok: false, error: 'not-in-tsconfig' }
}

const keepFile = (sf: ts.SourceFile, exclude: string[] | undefined): boolean => {
  if (sf.isDeclarationFile) return false
  if (sf.fileName.includes('/node_modules/')) return false
  if (exclude?.some((i) => mm.isMatch(sf.fileName, i))) return false
  return true
}

const findAndParseTsConfig = async (tsconfigPath?: string): Promise<ts.ParsedCommandLine & { json: any }> => {
  let pth = tsconfigPath
  if (!pth) pth = await tsconf.find()
  if (!pth) throw new Error('No tsconfig.json found')
  const json = tsconf.read(pth)
  return { ...tsconf.parse(pth, json), json }
}

const readGitHash = (): string | undefined => {
  try {
    return spawnSync('git', ['rev-parse', 'HEAD', '--short']).stdout.toString().trim() || undefined
  } catch {
    return undefined
  }
}
